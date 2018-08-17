
/* Dasca, an idle game by @CylonicRaider (github.com/CylonicRaider/dasca)
 * Game implementation */

"use strict";

/* *** Utilities *** */

function $id(id) {
  return document.getElementById(id);
}
function $idx(id, elem) {
  return elem.querySelector("#" + id);
}
function $sel(sel, elem) {
  return (elem || document).querySelector(sel);
}
function $selAll(sel, elem) {
  return (elem || document).querySelectorAll(sel);
}
function $listen(elem, event, callback) {
  if (typeof elem == "string") elem = $id(elem);
  elem.addEventListener(event, callback);
}

function $query(str) {
  str = str.replace(/^[#?]/, "");
  var ret = {}, entries = str.split("&");
  for (var i = 0; i < entries.length; i++) {
    var m = /^([^=]*)(?:=(.*))?$/.exec(entries[i]);
    var name = m[1], value = m[2] || null;
    ret[decodeURIComponent(name)] =
      (value) ? decodeURIComponent(value) : value;
  }
  return ret;
}
var QUERY = $query(location.search);

/* Create a DOM element */
function $makeNode(tag, className, attrs, children) {
  /* Allow omitting parameters */
  if (Array.isArray(className)) {
    if (! attrs && ! children) {
      children = className;
      attrs = null;
      className = null;
    }
  } else if (typeof className == "object" && className != null) {
    if (! children) {
      children = attrs;
      attrs = className;
      className = null;
    }
  } else if (Array.isArray(attrs) || typeof attrs == "string") {
    if (! children) {
      children = attrs;
      attrs = null;
    }
  }
  /* Create node */
  var ret = document.createElement(tag);
  /* Set classes */
  if (className) ret.className = className;
  /* Set additional attributes */
  if (attrs) {
    for (var name in attrs) {
      if (! attrs.hasOwnProperty(name)) continue;
      ret.setAttribute(name, attrs[name]);
    }
  }
  /* Add children */
  if (children) {
    if (typeof children == "string") children = [children];
    for (var i = 0; i < children.length; i++) {
      var e = children[i];
      if (! e) {
        /* Allow conditional node omission */
      } else if (typeof e == "string") {
        /* Strings become text nodes */
        ret.appendChild(document.createTextNode(e));
      } else if (typeof e != "object") {
        /* Other primitive types are not allowed */
        throw new Error("Bad child encountered during DOM node creation");
      } else if (Array.isArray(e)) {
        /* Arrays are handled recursively */
        ret.appendChild($makeNode.apply(null, e));
      } else {
        /* Everything else is assumed to be a DOM node */
        ret.appendChild(e);
      }
    }
  }
  return ret;
}

/* Replace a CSS class with another */
function $replaceClass(elem, fromCls, toCls) {
  if (elem.classList.contains(fromCls)) {
    elem.classList.remove(fromCls);
    elem.classList.add(toCls);
  }
}

/* Round a numeric value for display */
function displayRound(v) {
  return Math.round(v * 1e4) / 1e4;
}

/* base64-encode a string with line wrapping */
function b64encw(s) {
  // "Binary" to "ASCII"?
  return btoa(s).replace(/.{78}/g, "$&\n").trim();
}

/* Undo b64encw */
function b64decw(s) {
  // atob is tolerant enough. :}
  return atob(s);
}

/* *** UI control functions *** */

/* Show the given UI element, hiding any siblings and showing all its
 * showable parents */
function showNode(node) {
  if (! node) return;
  /* Resolve ID-s */
  if (typeof node == "string") node = $id(node);
  /* Hide siblings */
  var prev = node.previousElementSibling, next = node.nextElementSibling;
  while (prev) {
    if (prev.classList.contains("selectable"))
      prev.classList.remove("selected");
    prev = prev.previousElementSibling;
  }
  while (next) {
    if (next.classList.contains("selectable"))
      next.classList.remove("selected");
    next = next.nextElementSibling;
  }
  /* Show parent */
  showNode(node.parentNode);
  /* Show node */
  if (node.classList && node.classList.contains("selectable"))
      node.classList.add("selected");
}

/* Hide all selectable children of node
 *
 * Approximate opposite of showNode. */
function hideChildren(node) {
  if (! node) return;
  /* Resolve ID-s */
  if (typeof node == "string") node = $id("node");
  /* Hide children */
  for (var ch = node.firstElementChild; ch; ch = ch.nextElementSibling) {
    if (ch.classList.contains("selectable"))
      ch.classList.remove("selected");
  }
}

/* *** Game mechanics *** */

/* The main game object
 *
 * state is a game state to restore (see below for details); storage is a
 * StorageCell instance used for state persistence (or absent for none).
 * If state is falsy, a new one is created; otherwise, state is deserialized.
 * If storage is truthy and state is null, the constructor attempts to load
 * a state from the storage (thus, passing an empty string as the state
 * forces creating a new one). */
function Game(state, storage) {
  this._env = Object.create(window);
  this._env.game = this;
  if (storage && state == null) {
    state = storage.loadRaw();
  }
  if (! state) {
    this.state = new GameState(this);
    this.state.scheduler.addContTask(this.createTask("_updateVars"));
  } else {
    this.state = deserialize(state, this._env);
  }
  this.state.scheduler._onerror = this._onerror.bind(this);
  this.storage = storage;
  this.ui = new GameUI(this);
  this.story = new GameStory(this);
  this.animator = new Animator(0.2);
  this.running = true;
  this.paused = false;
  this.ui.render();
  if (state) {
    this.pause(false);
  } else {
    this.story.init();
  }
  this.state.scheduler.run();
  this.animator.run();
}

Game.prototype = {
  /* Save the game state into a string */
  save: function() {
    var st = serialize(this.state);
    if (this.storage) this.storage.saveRaw(st);
    return st;
  },

  /* Mount the game into the given node */
  mount: function(node) {
    return this.ui.mount(node);
  },

  /* Unmount the game from its current parent node, if any */
  unmount: function() {
    return this.ui.unmount();
  },

  /* Get the value of a flag */
  getFlag: function(name) {
    return this.state.flags.get(name);
  },

  /* Set a flag; return whether the value changed */
  setFlag: function(name) {
    return this.state.flags.set(name, true);
  },

  /* Clear a flag; return whether the value changed */
  clearFlag: function(name) {
    return this.state.flags.set(name, false);
  },

  /* Create a task for addTask
   *
   * Arguments are passed as an array. */
  createTaskEx: function(method, args) {
    var m = ("game." + method).match(/^(.+)\.([^.]+)$/);
    return new CachingAction(m[1], m[2], args, this._env);
  },

  /* Create a task for addTask
   *
   * Arguments are passed variadically. */
  createTask: function(method) {
    return this.createTaskEx(method,
      Array.prototype.slice.call(arguments, 1));
  },

  /* Schedule an Action to be run */
  addTaskEx: function(delay, subject, method, args) {
    var task = new CachingAction(subject, method, args, this._env);
    return this.state.scheduler.addTaskIn(task, delay);
  },

  /* Convenience wrapper for addTaskEx()
   *
   * Arguments are passed variadically. */
  addTask: function(delay, method) {
    var m = ("game." + method).match(/^(.+)\.([^.]+)$/);
    var args = Array.prototype.slice.call(arguments, 2);
    return this.addTaskEx(delay, m[1], m[2], args);
  },

  /* Schedule an Action to be run repeatedly */
  addContTaskEx: function(subject, method, args) {
    var task = new CachingAction(subject, method, args, this._env);
    return this.state.scheduler.addContTask(task);
  },

  /* Schedule a function to be run repeatedly
   *
   * Arguments are passed variadically. */
  addContTask: function(method) {
    var m = ("game." + method).match(/^(.+)\.([^.]+)$/);
    var args = Array.prototype.slice.call(arguments, 2);
    return this.addContTaskEx(m[1], m[2], args);
  },

  /* Show a log message */
  showMessage: function(msg) {
    this.state.messages.push(msg);
    this.ui._showMessage(msg);
  },

  /* Add a UI tab */
  addTab: function(name, dispname, options) {
    if (! options) options = {};
    options.name = dispname;
    if (! options.items) options.items = [];
    if (! options.gauges) options.gauges = [];
    if (this.state.tabOrder.indexOf(name) == -1)
      this.state.tabOrder.push(name);
    this.state.tabs[name] = options;
    this.ui._addTab(name, dispname, options);
    this.ui._updateItems(name, "items");
    this.ui._updateItems(name, "gauges");
  },

  /* Select a UI tab */
  showTab: function(name, hidden) {
    if (hidden != null) this.state.tabs[name].hidden = hidden;
    this.state.currentTab = name;
    this.ui._updateItems(name, "items");
    this.ui._updateItems(name, "gauges");
    this.ui._showTab(name, this.state.tabs[name].hidden);
  },

  /* Create a Variable */
  makeVariable: function(name, value, min, max) {
    var v = new Variable(value, min, max);
    this.state.variables[name] = v;
    return v;
  },

  /* Return an object to hook up to other Variables as a derivative */
  makeVariableHandler: function(name, factor) {
    return this.createTaskEx("state.variables." + name + ".getValue",
                             factor);
  },

  /* Return the Variable with the given name */
  getVariable: function(name) {
    return this.state.variables[name];
  },

  /* Add an item */
  addItem: function(type, name) {
    var ctor = Item[type];
    // HACK HACK HACK: Behold the finest JS magic!
    var args = [null, this].concat(
      Array.prototype.slice.call(arguments, 1));
    var item = new (ctor.bind.apply(ctor, args))();
    this.state.items[name] = item;
    return item;
  },

  /* Show an item in a given UI tab, or hide it from there
   *
   * Items can be in multiple tabs; their nodes are transparently reparented
   * on tab switches. */
  showItem: function(tab, name, show) {
    if (show == null) show = true;
    var items = this.state.tabs[tab].items;
    var idx = items.indexOf(name);
    if (idx != -1) items.splice(idx, 1);
    if (show) items.push(name);
    this.ui._showItem(tab, name);
  },

  /* Hide the given item from sight */
  hideItem: function(tab, name) {
    /* Actually already implemented */
    this.showItem(tab, name, false);
  },

  /* Remove the named item from storage and display */
  removeItem: function(name) {
    if (this.state.items[name])
      this.state.items[name].__remove__();
    delete this.state.items[name];
    for (var t in this.state.tabs) {
      if (! this.state.tabs.hasOwnProperty(t)) continue;
      var items = this.state.tabs[t].items;
      var idx = items.indexOf(name);
      if (idx != -1) items.splice(idx, 1);
      var gauges = this.state.tabs[t].gauges;
      idx = gauges.indexOf(name);
      if (idx != -1) gauges.splice(idx, 1);
    }
    this.ui._removeItem(name);
  },

  /* Show a gauge in a given UI tab or hide it */
  showGauge: function(tab, name, show) {
    if (show == null) show = true;
    var items = this.state.tabs[tab].gauges;
    var idx = items.indexOf(name);
    if (idx != -1) items.splice(idx, 1);
    if (show) items.push(name);
    this.ui._showGauge(tab, name);
  },

  /* Hide the given gauge from sight */
  hideGauge: function(tab, name) {
    this.showGauge(tab, name, false);
  },

  /* Remove the given gauge from storage and display */
  removeGauge: function(name) {
    this.removeItem(name);
  },

  /* Pause the game */
  pause: function(doPause) {
    if (doPause == null) doPause = (! this.paused);
    this.paused = doPause;
    this.state.scheduler.running = (! doPause);
    this.ui._updatePause();
    if (! doPause) this.state.scheduler.run();
  },

  /* Stop running the game */
  exit: function() {
    this.save();
    this.running = false;
    this.state.scheduler.stop();
    this.animator.stop();
  },

  /* Update the variables */
  _updateVars: function(now) {
    var v = this.state.variables, s = this.state.scheduler;
    for (var name in v) {
      if (! v.hasOwnProperty(name)) continue;
      v[name].update(s);
    }
    for (var name in v) {
      if (! v.hasOwnProperty(name)) continue;
      v[name].updateLate();
    }
  },

  /* Error handler */
  _onerror: function(exc) {
    console.error("Error in game:", exc);
    this.state.scheduler.stop();
  },

  constructor: Game
};

/* Story-oriented functionality */
function GameStory(game) {
  this.game = game;
}

GameStory.prototype = {
  /* Intro sequence */
  INTRO: [
    [null, 1],
    [["i", null, "Darkness."], 2],
    [["i", null, "Silence."], 2],
    [["i", null, "Confinement."], 3],
    [["i", null, "Amnesia."], 2],
    [null, 0, "story._finishIntro"]
  ],

  /* Description of surroundings */
  DESCRIPTION_START: [
    ["You are on the bridge of a spacecraft.", 4],
    ["The windows would provide a wide panorama onto (presumably) space " +
      "if they were not blocked by dark shutters.", 8],
    ["The large instrument panel is lifeless; all needles are resting at " +
      "zero.", 8],
    ["You are strapped into a comfortable chair.", 4],
    ["Behind you, there is a plain wall, pierced by a closed rectangular " +
      "door, through which a round window peeks into a dark room.", 8],
    [null, 0, "story._finishLookAroundStart"]
  ],

  /* Description of corridor */
  DESCRIPTION_CORRIDOR: [
    ["The room's walls are covered by semitranslucent panels. The labels " +
      "are hardly decipherable under the weak light.", 8],
    ["Three doors lead out of the room; apart from the one to the bridge, " +
      "there is one opposite to it, and one leads through the " +
      "\u201cfloor\u201d.", 8],
    ["On the wall to the bridge, a big button of an unrecognizable color " +
      "stands out.", 8],
    ["There is a small handcrank nearby. It looks stiff, but still " +
      "operational.", 8],
    [null, 0, "story._finishLookAroundCorridor"]
  ],

  /* Show a story fragment */
  _showStoryFragment: function(parts, delayIfNot) {
    this.game.state.scheduler.addContTask(new StoryFragment(this.game,
      parts, delayIfNot));
  },

  /* Create a Task for invoking a particular method of the story */
  _createTask: function(funcname) {
    return this.game.createTaskEx("story." + funcname,
      Array.prototype.slice.call(arguments, 1));
  },

  /* Start */
  init: function() {
    this.game.addTab("start", "Bridge", {hidden: true});
    this._showStoryFragment(this.INTRO);
  },

  /* Show the first tab */
  _finishIntro: function() {
    this.game.ui.showControls();
    this.game.addItem("Button", "show-lighter", "Check pockets",
                      "story.showLighter");
    this.game.showItem("start", "show-lighter");
    this.game.showTab("start");
  },

  /* Show the lighter */
  showLighter: function() {
    this.game.removeItem("show-lighter");
    this.game.showMessage("You find a lighter.");
    this.game.addItem("Lighter", "lighter", 100, 70).bindFlag("lighter-lit");
    this.game.state.flags.derive("lit", "or", "lighter-lit");
    this.game.state.flags.addLateHandler("lit",
      this._createTask("_updateLighting"));
    this.game.showItem("start", "lighter");
    this.game.addItem("Button", "look-around-start", "Look around",
      "story.lookAroundStart").showWhenActive("start", "lighter");
  },

  /* Write a message when lighting conditions change */
  _updateLighting: function(state) {
    if (! state) {
      this.game.showMessage("It is dark again.");
    }
  },

  /* Gather first impressions of the player's surroundings */
  lookAroundStart: function() {
    this.game.showTab("start", false);
    this.game.removeItem("look-around-start");
    this._showStoryFragment(this.DESCRIPTION_START,
                            "state.items.lighter.active");
  },

  /* Finish the first story fragment */
  _finishLookAroundStart: function() {
    this.game.addItem("Button", "pass-door", "Float through door",
                      "story.goToCorridor");
    this.game.showItem("start", "pass-door");
  },

  /* Move to the next room */
  goToCorridor: function() {
    this.game.removeItem("pass-door");
    if (this.game.state.items.lighter.active)
      this.game.showMessage("The air flow lets the flame flare to a " +
        "bright yellow.");
    this.game.showMessage("You open the door and float through it.");
    this.game.addTab("corridor", "Corridor");
    this.game.showItem("corridor", "lighter");
    this.game.addItem("Button", "look-around-corridor", "Look around",
      "story.lookAroundCorridor").showWhenActive("corridor", "lighter");
    this.game.showTab("corridor");
  },

  /* Look around there */
  lookAroundCorridor: function() {
    this.game.removeItem("look-around-corridor");
    this._showStoryFragment(this.DESCRIPTION_CORRIDOR,
                            "state.items.lighter.active");
  },

  /* Finish looking around the corridor */
  _finishLookAroundCorridor: function() {
    this.game.makeVariable("energy", 0, 0, null);
    this.game.addItem("Crank", "crank", 1, 2, 1).attachTo("energy");
    this.game.showItem("corridor", "crank");
    var r = this.game.addItem("Reactor", "reactor");
    r.attachTo("energy");
    r.getVariable("power").addLateHandler(
      this._createTask("_checkReactorPower"));
    this.game.showItem("corridor", "reactor");
    this.game.addItem("Gauge", "total-energy", "energy", 100, "ENERGY",
                      [1, 10, 100]);
    this.game.showGauge("corridor", "total-energy");
  },

  /* Check if the reactor has reached full power output */
  _checkReactorPower: function(value, variable) {
    if (value == variable.max && this.game.setFlag("reactor-full-power"))
      this.toBeContinued();
  },

  /* Story is not developed beyond this point */
  toBeContinued: function() {
    this.game.showMessage(["i", null, "\u2014 T.B.C. \u2014"]);
  },

  constructor: GameStory
};

/* Show some messages with delays and optionally perform actions */
function StoryFragment(game, parts, delayIfNot) {
  this._game = game;
  this.parts = parts;
  this.delayIfNot = delayIfNot;
  this.nextTime = null;
  this.nextIndex = 0;
}

StoryFragment.prototype = {
  /* Check whether a new story fragment should be displayed
   *
   * ...And do so if necessary. Return true when nothing further has to be
   * done. */
  cb: function(now, scheduler) {
    // Debugging hook.
    if (this.nextTime != null && now < this.nextTime && ! QUERY.fast) return;
    if (this.nextIndex >= this.parts.length) return true;
    if (this.delayIfNot && ! findObject(this.delayIfNot, this._game)) {
      this.nextTime = now + 1;
      return;
    }
    var part = this.parts[this.nextIndex++];
    if (part[0] != null) this._game.showMessage(part[0]);
    this.nextTime = now + part[1];
    if (part.length > 2) {
      var task = this._game.createTaskEx.apply(this._game, part.slice(2));
      task.cb.apply(task, arguments);
    }
  },

  constructor: StoryFragment,

  /* Deserialization */
  __reinit__: function(env) {
    this._game = env.game;
  }
};

/* The (serializable) state of a game
 *
 * The constructor creates a new state; for restoring a saved one, use the
 * deserialization function (in a suitable environment, which is created by
 * the constructor of Game). */
function GameState(game) {
  this._game = game;
  // Scheduler.
  this.scheduler = new Scheduler(10);
  // FlagSet. Can be used to show one-off messages.
  this.flags = new FlagSet();
  // [string]. Stores log messages.
  this.messages = [];
  // {string -> Item}. The home of the items.
  this.items = {};
  // {string -> {string -> *}}. Name is the codename of a tab; value contains
  // the display name of the tab as "name", the names of the items in this
  // tab as "items", the names of the gauges in this tab as "gauges", and,
  // optionally, whether its button should not be displayed as "hidden".
  this.tabs = {};
  // [string]. The order in which the tab buttons should be arranged.
  this.tabOrder = [];
  // string. Contains the codename of the current tab, or null for none.
  this.currentTab = null;
  // {string -> Variable}. The home of the variables.
  this.variables = {};
  // {string -> *}. Miscellaneous values.
  this.misc = {};
}

GameState.prototype = {
  constructor: GameState,

  /* Deserialization */
  __reinit__: function(env) {
    this._game = env.game;
  }
};

/* The DOM-based user interface of the game */
function GameUI(game) {
  this.game = game;
  this.root = null;
  this.parent = null;
  this._tabs = {};
  this._tabButtons = {};
  this._items = {};
}

GameUI.prototype = {
  /* Produce the DOM tree corresponding to this object */
  render: function() {
    if (this.root == null) {
      this.root = $makeNode("div", {id: "game-content"}, [
        ["div", "pane row-all", {id: "game-layers"}, [
          ["div", "layer selected row", [
            ["div", "col col-3of10 scroll-inset", [
              ["div", {id: "messagebar", lang: "en-US"}]
            ]],
            ["div", "col col-all", [
              ["div", "row row-small row-btn inset", {id: "tabbar"}],
              ["div", "row row-all pane", {id: "mainpane"}]
            ]]
          ]],
          ["div", "selectable layer text-popup shade", {id: "pausescreen"}, [
            ["h3", null, "Paused"]
          ]]
        ]],
        ["div", "row row-small inset hidden", {id: "bottombar"}, [
          ["button", "btn btn-small dim", {id: "credits-game"}, "Credits"],
          ["div", "col col-all"],
          ["button", "btn btn-small", {id: "pause-game"}, "Pause"],
          ["hr"],
          ["button", "btn btn-small", {id: "exit-game",
            title: "Save game and exit"}, "Exit"]
        ]]
      ]);
      $listen($idx("pause-game", this.root), "click", function() {
        this.game.pause();
      }.bind(this));
      $listen($idx("exit-game", this.root), "click", function() {
        this.game.exit();
        showNode("titlescreen");
      }.bind(this));
      $listen($idx("credits-game", this.root), "click", function() {
        this.game.pause(true);
        showNode("creditscreen");
      }.bind(this));
      var state = this.game.state;
      if (state.messages.length) {
        var m = state.messages;
        for (var i = 0; i < m.length; i++)
          this._showMessage(m[i]);
      }
      for (var key in state.tabs) {
        if (! state.tabs.hasOwnProperty(key)) continue;
        this._addTab(key, state.tabs[key].name, state.tabs[key]);
      }
      var curTab = this.game.state.currentTab;
      if (curTab) {
        this._updateItems(curTab, "items");
        this._updateItems(curTab, "gauges");
        this._showTab(curTab, this.game.state.tabs[curTab].hidden);
      }
      if (this.game.getFlag('controlsVisible')) {
        $idx("bottombar", this.root).classList.remove("hidden");
      }
      this._updatePause();
    }
    return this.root;
  },

  /* Perform additional adjustments that must happen when the root node is in
   * the DOM */
  _postRender: function() {
    var msgbar = $idx("messagebar", this.root);
    msgbar.scrollTop = msgbar.scrollHeight;
  },

  /* Embed the game's UI into the given DOM node
   *
   * If not already done, the UI is constructed. */
  mount: function(parent) {
    this.parent = parent;
    parent.appendChild(this.render());
    this._postRender();
    return this.root;
  },

  /* Remove the game's UI from the given DOM node */
  unmount: function() {
    if (! this.root || ! this.parent) return;
    var oldParent = this.parent;
    this.parent.removeChild(this.root);
    this.parent = null;
    return oldParent;
  },

  /* Reveal the game controls */
  showControls: function() {
    var bar = $idx("bottombar", this.root);
    this.game.setFlag('controlsVisible');
    bar.classList.remove("hidden");
  },

  /* Message showing backend */
  _showMessage: function(text) {
    var msgnode = $makeNode("p", "log-message", [text]);
    var msgbar = $idx("messagebar", this.root);
    msgbar.appendChild(msgnode);
    msgbar.scrollTop = msgbar.scrollHeight;
  },

  /* Add a UI tab */
  _addTab: function(name, dispname, options) {
    if (! options) options = {};
    this._tabButtons[name] = $makeNode("button",
      "btn btn-small fade-in", {id: "tabbtn-" + name}, [dispname]);
    $listen(this._tabButtons[name], "click", function() {
      this.game.showTab(name);
    }.bind(this));
    var tabbar = $idx("tabbar", this.root);
    if (! options.hidden && ! tabbar.contains(this._tabButtons[name])) {
      $idx("tabbar", this.root).appendChild(this._tabButtons[name]);
      this._sortTabs();
    }
    this._tabs[name] = $makeNode("div", "selectable layer inset game-tab col",
        {id: "tab-" + name}, [
      ["div", "items row-all"],
      ["div", "gauges row row-wrap"]
    ]);
    $idx("mainpane", this.root).appendChild(this._tabs[name]);
  },

  /* Show a UI tab */
  _showTab: function(name, hidden) {
    function suppressAnimation(node) {
      $replaceClass(node, "fade-in", "fade-in-suppressed");
    }
    var tabbtn = this._tabButtons[name];
    var tabbar = $idx("tabbar", this.root);
    if (! hidden && ! tabbar.contains(tabbtn)) {
      tabbar.appendChild(tabbtn);
      this._sortTabs();
    }
    Array.prototype.forEach.call($selAll("#tab-" + name + " > * > *",
                                         this.root), suppressAnimation);
    showNode(this._tabs[name]);
  },

  /* Ensure the UI tab buttons are in the correct order */
  _sortTabs: function() {
    var indices = {}, order = this.game.state.tabOrder;
    for (var i = 0; i < order.length; i++)
      indices[order[i]] = i + 1;
    var last = order.length + 1;
    var tabbar = $idx("tabbar", this.root);
    var nodes = Array.prototype.slice.call(tabbar.children);
    nodes.sort(function(a, b) {
      var ka = indices[a.id.replace(/^tabbtn-/, "")] || last;
      var kb = indices[b.id.replace(/^tabbtn-/, "")] || last;
      return (ka < kb) ? -1 : (ka > kb) ? 1 : 0;
    });
    nodes.forEach(function(el) {
      tabbar.appendChild(el);
    });
  },

  /* Get the UI node of an item */
  _getItem: function(name) {
    if (! this._items.hasOwnProperty(name))
      this._items[name] = this.game.state.items[name].render();
    return this._items[name];
  },

  /* Show an item in a tab */
  _showItem: function(tabname, name) {
    if (tabname == this.game.state.currentTab)
      $replaceClass(this._getItem(name), "fade-in-suppressed", "fade-in");
    this._updateItems(tabname, "items");
  },

  /* Show a gauge in a tab */
  _showGauge: function(tabname, name) {
    if (tabname == this.game.state.currentTab)
      $replaceClass(this._getItem(name), "fade-in-suppressed", "fade-in");
    this._updateItems(tabname, "gauges");
  },

  /* Ensure all items are correctly present in a tab */
  _updateItems: function(tabname, section) {
    var container = $sel("#tab-" + tabname + " ." + section, this.root);
    var order = this.game.state.tabs[tabname][section];
    order = (order) ? order.slice() : [];
    order.reverse();
    var lastNode = null;
    for (var i = 0; i < order.length; i++) {
      var node = this._getItem(order[i]);
      if (node.parentNode != container) {
        container.insertBefore(node, lastNode);
      }
      while (node.nextElementSibling != lastNode) {
        container.removeChild(node.nextElementSibling);
      }
      lastNode = node;
    }
    if (lastNode) {
      while (lastNode.previousElementSibling)
        container.removeChild(lastNode.previousElementSibling);
    }
  },

  /* Remove the named item again */
  _removeItem: function(name) {
    var it = this._items[name];
    if (it && it.parentNode) it.parentNode.removeChild(it);
    delete this._items[name];
  },

  /* Update the text of the pause button */
  _updatePause: function() {
    var t = (this.game.paused) ? "Resume" : "Pause";
    $idx("pause-game", this.root).textContent = t;
    if (this.game.paused) {
      showNode($idx("pausescreen", this.root));
    } else {
      hideChildren($idx("game-layers", this.root));
    }
  },

  constructor: GameUI
};

/* An Item encapsulates a single object the player can interact with
 *
 * Item-s must be serializable; hence, non-serializable properties must be
 * prefixed with underscores.
 * Arguments after game and name are passed to the __init__ method (if any)
 * variadically.
 * The special method __remove__ is invoked with no arguments and the return
 * value ignored when the item is being removed from the game; it should not
 * be used thereafter. */
function Item(game, name) {
  this._game = game;
  this.name = name;
  this._vars = {};
  if (this.__init__)
    this.__init__.apply(this, Array.prototype.slice.call(arguments, 2));
}

Item.prototype = {
  /* Return the DOM node representing the UI of the item or null if none */
  render: function() {
    if (this._node === undefined && this._render)
      this._node = this._render();
    return this._node;
  },

  /* Use the item in some specific way */
  use: function() {
    /* NOP */
  },

  /* Return a wrapper around a method of this item */
  _makeAction: function(method) {
    return this._game.createTaskEx("state.items." + this.name + "." + method,
      Array.prototype.slice.call(arguments, 1));
  },

  /* Create a Variable for this item */
  _makeVariable: function(name, value, min, max) {
    var ret = this._game.makeVariable(this.name + "/" + name, value,
                                      min, max);
    this._vars[name] = ret;
    return ret;
  },

  /* Create a handler for a Variable tracking the value of another Variable */
  _makeVariableHandler: function(name, factor) {
    return this._game.makeVariableHandler(this.name + "/" + name, factor);
  },

  /* Retrieve a Variable on this item */
  getVariable: function(name) {
    if (! (name in this._vars)) {
      this._vars[name] = this._game.getVariable(this.name + "/" + name);
    }
    return this._vars[name];
  },

  constructor: Item,

  /* Deserialize an item */
  __reinit__: function(env) {
    this._game = env.game;
    this._vars = {};
  }
};

/* An item that can be activated and deactivated
 *
 * The use() method is specified to toggle the activity state (subtypes may
 * override this); changing the activity triggers listeners. */
function ActiveItem(game, name) {
  this.active = false;
  this.listeners = [];
  Item.apply(this, arguments);
}

ActiveItem.prototype = Object.create(Item.prototype);

/* Use the item in some generic way */
ActiveItem.prototype.use = function() {
  this.setActive(! this.active);
};

/* Set the activity flag
 *
 * Returns whether the change has been successful. */
ActiveItem.prototype.setActive = function(state) {
  if (state == this.active) return false;
  this.active = state;
  for (var i = 0; i < this.listeners.length; i++) {
    this.listeners[i].cb(this.active, this);
  }
};

/* Convenience function for adding an Action as a change listener
 *
 * The invoked method receives -- aside from fixed arguments that are given
 * to this method variadically -- two arguments, namely this Item's activity
 * state, and this Item. */
ActiveItem.prototype.addListener = function(method) {
  this.listeners.push(this._game.createTask.apply(this._game, arguments));
};

/* Remove a listener for the named method
 *
 * Since the identities of Action objects are not preserved, this method is
 * named differently and performs fuzzy matching on the subject and method
 * name. */
ActiveItem.prototype.removeListenerFor = function(method) {
  var probe = this._game.createTask(method);
  for (var i = 0; i < this.listeners.length; i++) {
    var l = this.listeners[i];
    if (l instanceof Action && l.self == probe.self && l.func == probe.func) {
      this.listeners.splice(i, 1);
      break;
    }
  }
};

/* Set the flag whenever this item is active and clear it otherwise */
ActiveItem.prototype.bindFlag = function(flag) {
  this.addListener("state.flags.set", flag);
};

ActiveItem.prototype.constructor = ActiveItem;

/* An Item with a specific structure */
function MeterItem(game, name) {
  this._labelNode = null;
  this._buttonNode = null;
  this._bufferNode = null;
  this._meterAnim = null;
  ActiveItem.apply(this, arguments);
}

MeterItem.prototype = Object.create(ActiveItem.prototype);

/* Generate the UI for this item */
MeterItem.prototype._render = function() {
  var ret = $makeNode("div", "item-card fade-in", [
      ["b", "item-name", "..."],
      ["button", "btn btn-small item-use", "..."],
      ["div", "item-bar", [
        ["div", "item-bar-buffer"],
        ["div", "item-bar-content"]
      ]]
    ]);
  this._labelNode = $sel(".item-name", ret);
  this._buttonNode = $sel(".item-use", ret);
  this._bufferNode = $sel(".item-bar-buffer", ret);
  var meterNode = $sel(".item-bar-content", ret);
  $listen(this._buttonNode, "click", this.use.bind(this));
  this._meterAnim = this._game.animator.register(function(value) {
    value = value * 100 + "%";
    if (meterNode.style.width != value)
      meterNode.style.width = value;
  });
  this._updateButton();
  this._updateMeter();
  return ret;
};

/* Update the button label of this item */
MeterItem.prototype._updateButton = function(text) {
  if (text == null) text = 'N/A';
  if (this._buttonNode == null) this.render();
  if (this._buttonNode.textContent != text)
    this._buttonNode.textContent = text;
};

/* Update this item's meter */
MeterItem.prototype._updateMeter = function(value, variable) {
  if (this._meterAnim == null) this.render();
  if (variable != null) value = displayRound(value / variable.max);
  this._meterAnim(value);
};

/* Wire the given variable to update this item's meter */
MeterItem.prototype._setMeterVar = function(variable) {
  variable.addLateHandler(this._makeAction("_updateMeter"));
};

/* Set the label of this item */
MeterItem.prototype.setLabel = function(text) {
  if (text == null) text = 'N/A';
  if (this._labelNode == null) this.render();
  if (this._labelNode.textContent != text)
    this._labelNode.textContent = text;
};

/* Set the activity state of this item */
MeterItem.prototype.setActive = function(state) {
  var ret = ActiveItem.prototype.setActive.call(this, state);
  this._updateButton();
  return ret;
};

MeterItem.prototype.constructor = MeterItem;

/* Define an Item subtype
 *
 * A constructor with the given name is created; (own) properties are copied
 * from props into the prototype. The constructor and __sername__ properties
 * are set automatically. */
Item.defineType = function(name, props) {
  /* Allow subclasses of Item to use this */
  var base = this;
  /* Create constructor function
   *
   * There seems not to be any method actually supported by reasonably recent
   * browsers to do that but manual construction. */
  var func = eval(
    "(function " + name + "(game, name) {\n" +
    "  base.apply(this, arguments);\n" +
    "})");
  /* Create prototype */
  func.prototype = Object.create(base.prototype);
  for (var k in props) {
    if (props.hasOwnProperty(k))
      func.prototype[k] = props[k];
  }
  /* Add special properties
   *
   * All concrete item types (including those of subclasses) are intentionally
   * stored in Item. */
  func.prototype.constructor = func;
  func.prototype.__sername__ = "Item." + name;
  /* Install into Item */
  Item[name] = func;
  /* Return something */
  return func;
};

/* Allow deriving concrete item types from ActiveItem */
ActiveItem.defineType = Item.defineType;
MeterItem.defineType = Item.defineType;

/* A featureless piece of text */
Item.defineType("Label", {
  /* Initialize an instance */
  __init__: function(text) {
    this.text = text;
  },

  /* Turn into a UI node */
  _render: function() {
    return $makeNode("span", [this.text]);
  }
});

/* A button that submits an Action when clicked.
 *
 * Function arguments are passed variadically. */
Item.defineType("Button", {
  /* Initialize an instance. */
  __init__: function(text, funcname) {
    this.text = text;
    this.funcname = funcname;
    this.delay = 0;
    this.classes = "fade-in";
    this.args = Array.prototype.slice.call(arguments, 2);
  },

  /* Remove the item from the game */
  __remove__: function() {
    if (this.anchorItem) this.showWhenActive(null, null);
  },

  /* Render the item into a UI node */
  _render: function() {
    var ret = $makeNode("button", "btn", [this.text]);
    if (this.classes) ret.className += " " + this.classes;
    $listen(ret, "click", this.use.bind(this));
    return ret;
  },

  /* Use the item */
  use: function() {
    this._game.addTask.apply(this._game,
      [this.delay, this.funcname].concat(this.args));
  },

  /* Conditional showing/hiding */
  showWhenActive: function(tab, item) {
    var methName = "state.items." + this.name + "._updateVisibility";
    if (this.anchorItem) {
      var anchorObj = this._game.state.items[this.anchorItem];
      if (anchorObj)
        anchorObj.removeListenerFor(methName);
    }
    this.anchorItem = item;
    if (item != null) {
      var itemObj = this._game.state.items[item];
      itemObj.addListener(methName, tab);
      this._updateVisibility(tab, itemObj.active);
    }
  },

  /* Update the text of the button */
  setText: function(newText) {
    this.text = newText;
    var node = this.render();
    node.textContent = newText;
  },

  /* Conditional visibility backend */
  _updateVisibility: function(tab, active) {
    this._game.showItem(tab, this.name, (!! active));
  }
});

/* The lighter */
MeterItem.defineType("Lighter", {
  /* The rate at which the lighter consumes fuel */
  CONSUMPTION_PER_SECOND: 0.5,

  /* Initialize instance */
  __init__: function(capacity, fill) {
    if (! fill) fill = 0;
    this.setLabel("Lighter");
    var v = this._makeVariable("fill", fill, 0, capacity);
    v.addHandler(this._makeAction("_deplete"));
    this._setMeterVar(v);
  },

  /* Deplete the lighter's fuel */
  _deplete: function(variable, sched) {
    return (this.active) ? -this.CONSUMPTION_PER_SECOND / sched.fps : 0;
  },

  /* Update the action button */
  _updateButton: function() {
    var text = (this.active) ? "Extinguish" : "Ignite";
    MeterItem.prototype._updateButton.call(this, text);
  },

  /* Update the fill meter */
  _updateMeter: function(value, variable) {
    if (value == 0 && this.active) this.setActive(false);
    MeterItem.prototype._updateMeter.call(this, value, variable);
  },

  /* Set the burning state */
  setActive: function(state) {
    var v = this.getVariable("fill");
    if (state && v.value < 1e-6) {
      this._game.showMessage("The lighter is burnt out.");
      return false;
    } else if (state == this.active) {
      return false;
    }
    if (state) {
      if (this._game.setFlag("lighter-space")) {
        this._game.showMessage("The flame looks funny... Oh, right.");
        this._game.showMessage(["i", null, "Weightlessness."]);
      } else {
        this._game.showMessage("The flame is blue and spherical.");
      }
    }
    return MeterItem.prototype.setActive.call(this, state);
  }
});

/* The crank
 *
 * The ship is designed with much forethought, and in particular includes a
 * means of manual power input for bootstrapping the reactor should all other
 * ones fail. */
ActiveItem.defineType("Crank", {
  /* Initialize instance */
  __init__: function(speedcap, speedincr, speeddecr) {
    var vs = this._makeVariable("speed", 0, 0, speedcap);
    vs.addHandler(this._makeAction("_getIncrement"));
    vs.addLateHandler(this._makeAction("_updateSpeed"));
    var vr = this._makeVariable("rotation", 0);
    vr.addHandler(this._makeVariableHandler("speed", 1));
    vr.addLateHandler(this._makeAction("_updateRotation"));
    // speedcap is stored in the variable.
    this._speedcap = speedcap;
    this.speedincr = speedincr;
    this.speeddecr = speeddecr;
    this._turning = false;
    this._iconAnim = null;
    this._meterAnim = null;
  },

  /* Render the item into a UI node */
  _render: function() {
    var ret = $makeNode("div", "item-card fade-in", [
      ["span", "item-icon item-icon-interactive", {tabIndex: 0}, [
        CRANK_NODE.cloneNode(true)
      ]],
      ["div", "item-rows", [
        ["b", "item-name", "Crank"],
        ["hr"],
        ["button", "btn btn-small item-use", "Turn"],
        ["div", "item-bar", [
          ["div", "item-bar-buffer"],
          ["div", "item-bar-content"]
        ]]
      ]]
    ]);
    var bufferContent = $sel(".item-bar-buffer", ret);
    bufferContent.style.width = "100%";
    var self = this;
    var icon = $sel(".item-icon", ret), button = $sel(".item-use", ret);
    [icon, button].forEach(function(node) {
      $listen(node, "mousedown", self._turn.bind(self, true));
      $listen(node, "mouseup", self._turn.bind(self, false));
      $listen(node, "mouseout", function(evt) {
        if (evt.target == node) self._turn(false);
      });
      $listen(node, "blur", function(evt) {
        if (evt.relatedTarget != icon && evt.relatedTarget != button)
          self._turn(false);
      });
    });
    var iconContent = $sel(".item-icon .handle", ret);
    var meterContent = $sel(".item-bar-content", ret);
    this._iconAnim = this._game.animator.register(function(value) {
      iconContent.style.transform = "rotate(" + (value % 1 * 360) + "deg)";
    });
    this._meterAnim = this._game.animator.register(function(value) {
      meterContent.style.width = (value * 100) + "%";
    });
    /* Do not modulo-reduce while running to avoid problems with
     * transitions */
    this.getVariable("rotation").value %= 1;
    this._updateSpeed();
    this._updateRotation();
    return ret;
  },

  /* Get the current increment for the variable */
  _getIncrement: function(variable, sched) {
    return (this._turning) ? this.speedincr / sched.fps :
      -this.speeddecr / sched.fps;
  },

  /* Update the rotation speed */
  _updateSpeed: function() {
    var v = this.getVariable("speed");
    if (this._meterAnim == null) this.render();
    this._meterAnim(displayRound(v.value / v.max));
  },

  /* Update the display angle */
  _updateRotation: function(now) {
    var v = this.getVariable("rotation");
    if (this._iconAnim == null) this.render();
    this._iconAnim(displayRound(v.value));
  },

  /* Start or stop turning the crank */
  _turn: function(state) {
    this._turning = state;
  },

  /* Install the crank's speed as a derivative to varname */
  attachTo: function(varname, factor) {
    if (factor == null) factor = 1;
    this._game.getVariable(varname).addHandler(
      this._makeVariableHandler("speed", factor));
  }
});

/* The reactor
 *
 * Or at least what's visible of it. */
MeterItem.defineType("Reactor", {
  /* Power consumption per unit of time */
  POWER_CONSUMPTION: 10,

  /* How quickly the power output increases */
  POWER_CLIMB: 1,

  /* How quickly the power output decreases (as an absolute value) */
  POWER_FALL: 3,

  /* Maximal power output of the reactor */
  POWER_MAX: 20,

  /* Initialize instance */
  __init__: function() {
    this.setLabel("Reactor");
    var v = this._makeVariable("power", 0, 0, this.POWER_MAX);
    v.addHandler(this._makeAction("_updatePower"));
    this._setMeterVar(v);
    this._powerVar = v;
  },

  /* Turn this item into a DOM node */
  _render: function() {
    var ret = MeterItem.prototype._render.call(this);
    var bufferSize = 1 - this.POWER_CONSUMPTION / this.POWER_MAX;
    this._bufferNode.style.width = (bufferSize * 100) + "%";
    return ret;
  },

  /* Compute the current energy output */
  _updateEnergy: function(energy) {
    var ret = this.getVariable("power").value;
    if (this.active) {
      if (energy.value <= 0) {
        this.setActive(false);
      } else {
        ret -= this.POWER_CONSUMPTION;
      }
    }
    return ret;
  },

  /* Update the current power output */
  _updatePower: function() {
    if (this.active) {
      return this.POWER_CLIMB;
    } else {
      return -this.POWER_FALL;
    }
  },

  /* Update the action button */
  _updateButton: function() {
    var text = (this.active) ? "Shut down" : "Start up";
    MeterItem.prototype._updateButton.call(this, text);
  },

  /* Funnel this reactor's power output into the given variable */
  attachTo: function(varname, factor) {
    if (factor == null) factor = 1;
    this._game.getVariable(varname).addHandler(
      this._makeAction("_updateEnergy", factor));
  }
});

/* A gauge that displays the value of a Variable
 *
 * Currently, the Variable must have a minimum of zero. */
Item.defineType("Gauge", {
  /* Initialize instance */
  __init__: function(varname, max, description, scales) {
    this.varname = varname;
    this.max = max;
    this.description = description;
    this.scales = scales;
    this.autoScale = true;
    this._game.getVariable(varname).addLateHandler(
      this._makeAction("_updatePointer"));
    this._currentScale = null;
    this._pointer = null;
    this._descNode = null;
    this._scaleNode = null;
    this._pointerAnim = null;
  },

  /* Render the Item into a DOM node */
  _render: function() {
    var ret = $makeNode("span", "gauge fade-in", [
      GAUGE_NODE.cloneNode(true)
    ]);
    this._pointer = $sel(".pointer", ret);
    this._descNode = $sel(".desc", ret);
    this._scaleNode = $sel(".scale", ret);
    this._pointerAnim = this._game.animator.register(function(value) {
      this._pointer.style.transform = "rotate(" + (value * 180) + "deg)";
    }.bind(this));
    $listen(this._scaleNode, "click", function(evt) {
      this.selectNextScale();
    }.bind(this));
    var v = this._game.getVariable(this.varname);
    this._updatePointer();
    this.setDescription(this.description);
    this.setScales(this.scales);
    return ret;
  },

  /* Update the pointer of the gauge */
  _updatePointer: function(value, variable) {
    if (variable == null) {
      variable = this._game.getVariable(this.varname);
      value = variable.value;
    }
    var cap = (this.max == null) ? variable.max : this.max;
    if (this.autoScale && this.scales.length) {
      var idx = this.scales.indexOf(this.currentScale);
      if (idx == -1) idx = 0;
      var midx = this.scales.length - 1;
      while (idx < midx && value / this.scales[idx] > cap) idx++;
      while (idx > 0 && value / this.scales[idx - 1] < cap) idx--;
      if (this.scales[idx] != this._currentScale) {
        this.setScale(this.scales[idx]);
        // setScale calls _updatePointer recursively.
        return;
      }
    }
    value /= this._currentScale;
    if (value > cap) value = cap;
    if (this._pointerAnim == null) this.render();
    this._pointerAnim(displayRound(value / cap),
      this._game.animator.transitionDuration, 'cubic');
  },

  /* Change the description of this gauge */
  setDescription: function(desc) {
    this.description = desc;
    if (this._descNode == null) this.render();
    this._descNode.textContent = desc || '';
  },

  /* Set the possible values the gauge can be scaled with */
  setScales: function(values) {
    if (values == null) values = [];
    this.scales = values;
    if (! values.length) {
      this.setScale(null);
    } else {
      this.setScale(values[0]);
    }
    this._updatePointer();
  },

  /* Let the gauge have the given scale as its scale */
  setScale: function(scale) {
    if (this._scaleNode == null) {
      this.render();
    }
    if (scale == null) {
      this._currentScale = 1;
      this._scaleNode.textContent = "";
    } else {
      this._currentScale = scale;
      this._scaleNode.textContent = "\u00d7 " + scale;
    }
    if (scale != null && ! this.autoScale) {
      this._scaleNode.classList.add("clickable");
    } else {
      this._scaleNode.classList.remove("clickable");
    }
    this._updatePointer();
  },

  /* Select the next scale in the list */
  selectNextScale: function() {
    if (! this.scales.length) return;
    if (this._scaleNode == null) this.render();
    var idx = this.scales.indexOf(this._currentScale);
    idx = (idx + 1) % this.scales.length;
    this._currentScale = this.scales[idx];
    this._scaleNode.textContent = "\u00d7 " + this._currentScale;
    this._updatePointer();
  }
});

/* *** Initialization *** */

var Dasca = {
  game: null,
  storage: null
};

function init() {
  function startgame(restore) {
    if (game) game.unmount();
    game = new Game((restore ? null : ""), storage);
    Dasca.game = game;
    game.mount($id("mainscreen"));
    showNode("mainscreen");
  }
  var game = null, storage = new StorageCell("dasca-save-v1");
  Dasca.storage = storage;
  $listen("exportsave", "click", function() {
    var data = storage.loadRaw();
    if (data) {
      data = b64encw(json2ascii(data));
    } else {
      data = "";
    }
    $id("text-export").value = data;
  });
  $listen("importsave", "click", function() {
    storage.saveRaw(b64decw($id("text-export").value));
  });
  $listen("downloadsave", "click", function() {
    var data = storage.loadRaw();
    if (! data) {
      alert("Nothing saved");
      return;
    }
    var link = $id("file-download");
    link.href = "data:text/base64," + encodeURI(b64encw(json2ascii(data)));
    link.click();
  });
  $listen("uploadsave", "click", function() {
    $id("file-upload").click();
  });
  $listen("file-upload", "change", function() {
    var sel = $id("file-upload");
    var file = sel.files[0];
    if (! file) return;
    var reader = new FileReader();
    reader.onload = function(evt) {
      storage.saveRaw(b64decw(reader.result));
      alert("OK");
    };
    reader.readAsText(file);
  });
  $listen("credits-title", "click", function() {
    if (game) game.pause(true);
    showNode("creditscreen");
  });
  $listen("back-credits", "click", function() {
    if (game && game.running) {
      game.pause(false);
      showNode("mainscreen");
    } else {
      showNode("titlescreen");
    }
  });
  // jQuery? Naaah...
  Array.prototype.forEach.call($selAll("[data-switch]"), function(elem) {
    $listen(elem, "click", function() {
      showNode(elem.dataset.switch);
    });
  });
  Array.prototype.forEach.call($selAll("[data-newgame]"), function(elem) {
    $listen(elem, "click", function() {
      startgame(elem.dataset.newgame == "load");
    });
  });
  showNode("titlescreen");
}

$listen(window, "load", init);
