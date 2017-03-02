
/* Dasca, an idle game by @CylonicRaider (github.com/CylonicRaider/dasca)
 * Game implementation */

'use strict';

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
 * Approximate opposite of showNode. */
function hideNodes(node) {
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

/* A value changing over time
 * A variable has a value, and a set of handlers which are invoked on every
 * update of it that return increments which are applied to the variable
 * cumulatively.
 * Handlers are objects whose "cb" method is called with three parameters:
 * variable: The Variable object.
 * delta   : The time difference since the last update.
 * now     : The current time.
 * The return values are differences whose sum is added to the value of the
 * variable after each update.
 * If the handler has a rate property, the callback is not invoked, and
 * the change is instead calculated as the product of the time passed and
 * the rate.
 * Late handlers cannot influence the value of the variable, but instead act
 * upon its "final" value after the invocation of all "normal" handlers.
 * Their "run" methods are invoked with the Variable object as the only
 * argument. */
function Variable(value) {
  this.value = value;
  this.handlers = [];
  this.lateHandlers = [];
  this.lastUpdate = null;
}

Variable.prototype = {
  /* Aggregate the results of the handlers' return values and increment the
   * value by them. */
  update: function(now) {
    if (this.lastUpdate == null) this.lastUpdate = now;
    var delta = now - this.lastUpdate, incr = 0, hnd = this.handlers;
    for (var i = 0; i < hnd.length; i++) {
      if (hnd[i].rate != null) {
        incr += hnd[i].rate * delta;
      } else {
        incr += hnd[i].cb(this, delta, now);
      }
    }
    this.value += incr;
    this.lastUpdate = now;
  },

  /* Add a handler to the variable */
  addHandler: function(hnd) {
    this.handlers.push(hnd);
  },

  /* Remove a handler form the variable again */
  removeHandler: function(hnd) {
    var idx = this.handlers.indexOf(hnd);
    if (idx != -1) this.handlers.splice(idx, 1);
  },

  /* Run the late handlers associated with this variable */
  runLateHandlers: function() {
    var hnd = this.lateHandlers;
    for (var i = 0; i < hnd.length; i++)
      hnd[i].cb(this);
  },

  /* Add a late handler */
  addLateHandler: function(hnd) {
    this.lateHandlers.push(hnd);
  },

  /* Remove a late handler */
  removeLateHandler: function(hnd) {
    var idx = this.lateHandlers.indexOf(hnd);
    if (idx != -1) this.lateHandlers.splice(idx, 1);
  },

  /* OOP */
  constructor: Variable
};

/* The main game object */
function Game(state) {
  this._env = Object.create(window);
  this._env.game = this;
  if (state == null) {
    this.state = new GameState(this);
    this.state.scheduler.addContTask(this.createTask("_updateVars"));
  } else {
    this.state = deserialize(state, this._env);
  }
  this.ui = new GameUI(this);
  this.story = new GameStory(this);
  this.running = true;
  this.paused = false;
  this.state.scheduler.run();
}

Game.prototype = {
  /* Save the game state into a string */
  save: function() {
    return serialize(this.state);
  },

  /* Mount the game into the given node */
  mount: function(node) {
    return this.ui.mount(node);
  },

  /* Unmount the game from its current parent node, if any */
  unmount: function() {
    return this.ui.unmount();
  },

  /* Start the game */
  start: function() {
    this.story.init();
  },

  /* Get the value of a flag */
  getFlag: function(name) {
    return this.state.flags[name];
  },

  /* Set a flag; return whether the value changed */
  setFlag: function(name) {
    var old = this.state.flags[name];
    this.state.flags[name] = true;
    return (! old);
  },

  /* Clear a flag; return whether the value changes */
  clearFlag: function(name) {
    var old = this.state.flags[name];
    this.state.flags[name] = false;
    return (!! old);
  },

  /* Create a task for addTask
   * Arguments are passed as an array. */
  createTaskEx: function(method, args) {
    var m = ("game." + method).match(/^(.+)\.([^.]+)$/);
    return new CachingAction(m[1], m[2], args, this._env);
  },

  /* Create a task for addTask
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
   * Arguments are passed variadically. */
  addContTask: function(method) {
    var m = ("game." + method).match(/^(.+)\.([^.]+)$/);
    var args = Array.prototype.slice.call(arguments, 2);
    return this.addContTaskEx(m[1], m[2], args);
  },

  /* Add a new variable with the given initial value */
  addVariable: function(name, value) {
    var ret = new Variable(value);
    this.state.variables[name] = ret;
    return ret;
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
    if (this.state.tabOrder.indexOf(name) == -1)
      this.state.tabOrder.push(name);
    this.state.tabs[name] = options;
    this.ui._addTab(name, dispname, options);
    this.ui._updateItems(name);
  },

  /* Select a UI tab */
  showTab: function(name, hidden, noShow) {
    if (hidden != null) this.state.tabs[name].hidden = hidden;
    this.ui._showTab(name, this.state.tabs[name].hidden, noShow);
    this.ui._updateItems(name);
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
   * Items can be in multiple tabs; their nodes are transparently reparented
   * on tab switches. */
  showItem: function(name, tab, show) {
    if (show == null) show = true;
    var items = this.state.tabs[tab].items;
    var idx = items.indexOf(name);
    if (idx != -1) items.splice(idx, 1);
    if (show) items.push(name);
    this.ui._updateItems(tab);
  },

  /* Hide the given item from sight */
  hideItem: function(name, tab) {
    /* Actually already implemented */
    this.showItem(name, tab, false);
  },

  /* Remove the named item from storage and display */
  removeItem: function(name) {
    delete this.state.items[name];
    for (var t in this.state.tabs) {
      if (! this.state.tabs.hasOwnProperty(t)) continue;
      var items = this.state.tabs[t].items;
      var idx = items.indexOf(name);
      if (idx != -1) items.splice(idx, 1);
    }
    this.ui._removeItem(name);
  },

  /* Pause the game */
  pause: function(doPause) {
    if (doPause == null) doPause = (! this.paused);
    this.paused = doPause;
    this.state.scheduler.clock.setScale((doPause) ? 0 : 1);
    this.ui._updatePause();
  },

  /* Stop running the game */
  exit: function() {
    this.state.scheduler.running = false;
    this.running = false;
  },

  /* Update the variables */
  _updateVars: function(now) {
    var v = this.state.variables;
    for (var name in v) {
      if (! v.hasOwnProperty(name)) continue;
      v[name].update(now);
    }
    for (var name in v) {
      if (! v.hasOwnProperty(name)) continue;
      v[name].runLateHandlers();
    }
  },

  /* OOP */
  constructor: Game
};

/* Story-oriented functionality */
function GameStory(game) {
  this.game = game;
}

GameStory.prototype = {
  /* Start */
  init: function() {
    this.game.addTab("start", "Bridge", {hidden: true});
    var intro = [[["i", null, "Darkness."], 1],
                 [["i", null, "Silence."], 3],
                 [["i", null, "Confinement."], 5],
                 [["i", null, "Amnesia."], 8]];
    intro.forEach(function(x) {
      this.game.addTask(x[1], "showMessage", x[0]);
    }, this);
    this.game.addTask(10, "story.showStart");
  },

  /* Show the first tab */
  showStart: function() {
    this.game.addItem("Button", "show-lighter", "Check pockets",
                      "story.showLighter");
    this.game.showItem("show-lighter", "start");
    this.game.showTab("start");
  },

  /* Show the lighter */
  showLighter: function() {
    this.game.removeItem("show-lighter");
    this.game.showMessage("You find a lighter.");
    var lighter = this.game.addItem("Lighter", "lighter", 100, 70);
    lighter.onchange = this.game.createTask("story.onlighterchange");
    this.game.showItem("lighter", "start");
    var btn = this.game.addItem("Button", "look-around", "Look around",
                                "story.lookAround");
    btn.classes = "fade-in";
  },

  /* Called when the burning state of the lighter changes */
  onlighterchange: function(lighter) {
    this.game.showItem("look-around", "start", lighter.burning);
  },

  /* Gather first impressions of the player's surroundings */
  lookAround: function() {
    this.game.showTab("start", false);
    this.game.showMessage(["i", null, "NYI."]);
  },

  /* OOP */
  constructor: GameStory
};

/* The (serializable) state of a game
 * The constructor creates a new state; for restoring a saved one, use the
 * deserialization function (in a suitable environment, which is created by
 * the constructor of Game). */
function GameState(game) {
  this._game = game;
  // Scheduler.
  this.scheduler = Scheduler.makeStrobe(20);
  // {string -> bool}. Can be used to show one-off messages.
  this.flags = {};
  // [string]. Stores log messages.
  this.messages = [];
  // {string -> Item}. The home of the items.
  this.items = {};
  // {string -> {string -> *}}. Name is the codename of a tab; value contains
  // the display name of the tab as "name", the names of the items in this
  // tab as "items", and, optionally, whether its button should not be
  // displayed as "hidden".
  this.tabs = {};
  // [string] The order in which the tab buttons should be arranged.
  this.tabOrder = [];
  // string. Contains the codename of the current tab, or null for none.
  this.currentTab = null;
  // {string -> Variable}. The home of the variables.
  this.variables = {};
}

GameState.prototype = {
  /* OOP */
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
        ["div", "row row-all", [
          ["div", "col col-quarter inset", [
            ["div", {id: "messagebar"}]
          ]],
          ["div", "col col-all", [
            ["div", "row row-small row-btn inset", {id: "tabbar"}],
            ["div", "row row-all pane", {id: "mainpane"}]
          ]]
        ]],
        ["div", "row row-small inset", {id: "bottombar"}, [
          ["button", "btn btn-small dim", {id: "credits-game"}, "Credits"],
          ["div", "col col-all"],
          ["button", "btn btn-small", {id: "pause-game"}, "Pause"],
          ["hr"],
          ["button", "btn btn-small", {id: "exit-game"}, "Exit"]
        ]]
      ]);
      $idx("pause-game", this.root).addEventListener("click", function() {
        this.game.pause();
      }.bind(this));
      $idx("exit-game", this.root).addEventListener("click", function() {
        this.game.exit();
        showNode("titlescreen");
      }.bind(this));
      $idx("credits-game", this.root).addEventListener("click", function() {
        showNode("creditscreen");
      });
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
      this._updatePause();
    }
    return this.root;
  },

  /* Embed the game's UI into the given DOM node
   * If not already done, the UI is constructed. */
  mount: function(parent) {
    this.parent = parent;
    parent.appendChild(this.render());
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
      "btn btn-small fade-in-fast", {id: "tabbtn-" + name}, [dispname]);
    this._tabButtons[name].addEventListener("click", function() {
      this.game.showTab(name);
    }.bind(this));
    var tabbar = $idx("tabbar", this.root);
    if (! options.hidden && ! tabbar.contains(this._tabButtons[name])) {
      $idx("tabbar", this.root).appendChild(this._tabButtons[name]);
      this._sortTabs();
    }
    this._tabs[name] = $makeNode("div", "selectable layer inset game-tab",
      {id: "tab-" + name});
    $idx("mainpane", this.root).appendChild(this._tabs[name]);
  },

  /* Show a UI tab */
  _showTab: function(name, hidden, noShow) {
    var tabbtn = this._tabButtons[name];
    var tabbar = $idx("tabbar", this.root);
    if (! hidden && ! tabbar.contains(tabbtn)) {
      tabbar.appendChild(tabbtn);
      this._sortTabs();
    }
    if (! noShow)
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

  /* Ensure all items are correctly present in a tab */
  _updateItems: function(tabname) {
    var tabNode = $idx("tab-" + tabname, this.root);
    var order = this.game.state.tabs[tabname].items;
    order = (order) ? order.slice() : [];
    order.reverse();
    var lastNode = null;
    for (var i = 0; i < order.length; i++) {
      var node = this._getItem(order[i]);
      if (node.parentNode != tabNode) {
        tabNode.insertBefore(node, lastNode);
      } else if (node.nextElementSibling != lastNode) {
        tabNode.removeChild(node.nextElementSibling);
      }
      lastNode = node;
    }
    if (lastNode) {
      while (lastNode.previousElementSibling)
        tabNode.removeChild(lastNode.previousElementSibling);
    }
  },

  /* Remove the named item again */
  _removeItem: function(name) {
    var it = this._items[name];
    if (it) it.parentNode.removeChild(it);
    delete this._items[name];
  },

  /* Update the text of the pause button */
  _updatePause: function() {
    var t = (this.game.paused) ? "Resume" : "Pause";
    $idx("pause-game", this.root).textContent = t;
  },

  /* Consistency */
  constructor: GameUI
};

/* An Item encapsulates a single object the player can interact with
 * Items must be serializable; hence, non-serializable properties must
 * be prefixed with underscores.
 * Arguments after game are passed to the __init__ method (if any)
 * variadically. */
function Item(game, name) {
  this._game = game;
  this.name = name;
  if (this.__init__)
    this.__init__.apply(this, Array.prototype.slice.call(arguments, 2));
}

Item.prototype = {
  /* Return the DOM node representing the UI of the item
   * null if none. */
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

  /* OOP and/or serialization */
  constructor: Item,

  /* Deserialize an item */
  __reinit__: function(env) {
    this._game = env.game;
  }
};

/* Define an Item subtype
 * A constructor with the given name is created; (own) properties are copied
 * from props into the prototype. The constructor and __sername__ properties
 * are set automatically. */
Item.defineType = function(name, props) {
  /* Create constructor function
   * There seems not to be any method actually supported by reasonably recent
   * browsers to do that but manual construction. */
  var func = eval(
    "(function " + name + "(game, name) {\n" +
    "  Item.apply(this, arguments);\n" +
    "})");
  /* Create prototype */
  func.prototype = Object.create(Item.prototype);
  for (var k in props) {
    if (props.hasOwnProperty(k))
      func.prototype[k] = props[k];
  }
  /* Add special properties */
  func.prototype.constructor = func;
  func.prototype.__sername__ = "Item." + name;
  /* Install into Item */
  Item[name] = func;
  /* Return something */
  return func;
};

/* A button that submits an Action when clicked.
 * Function arguments are passed variadically. */
Item.defineType("Button", {
  /* Initialize an instance. */
  __init__: function(text, funcname) {
    this.text = text;
    this.funcname = funcname;
    this.delay = 0;
    this.classes = null;
    this.args = Array.prototype.slice.call(arguments, 2);
  },

  /* Render the item into a UI node */
  _render: function() {
    var ret = $makeNode("button", "btn", [this.text]);
    if (this.classes) ret.className += " " + this.classes;
    ret.addEventListener("click", this.use.bind(this));
    return ret;
  },

  /* Use the item */
  use: function() {
    this._game.addTask.apply(this._game,
      [this.delay, this.funcname].concat(this.args));
  }
});

/* The lighter */
Item.defineType("Lighter", {
  /* Initialize instance */
  __init__: function(capacity, fill) {
    if (! fill) fill = 0;
    var v = this._game.addVariable(this.name + "/fill", fill);
    v.maximum = capacity;
    v.addHandler(this._makeAction("_deplete"));
    v.addLateHandler(this._makeAction("_updateMeter"));
    this.burning = false;
    this.onchange = null;
  },

  /* Deplete the lighter's fuel */
  _deplete: function(variable, delta) {
    if (! this.burning) return 0;
    var decr = delta * 0.1;
    if (decr > variable.value) {
      decr = variable.value;
      this.setBurning(false);
    }
    return -decr;
  },

  /* Render the item into a UI node */
  _render: function() {
    var ret = $makeNode("div", "item-card fade-in", [
      ["b", "item-name", "Lighter"],
      ["button", "btn btn-small item-use", "..."],
      ["div", "item-bar", [["div", "item-bar-content"]]]
    ]);
    $sel(".item-use", ret).addEventListener("click", this.use.bind(this));
    this._meter = $sel(".item-bar-content", ret);
    this._button = $sel(".item-use", ret);
    this._updateMeter();
    this._updateButton();
    return ret;
  },

  /* Obtain the variable associated to this lighter */
  _getVar: function() {
    if (this._var == null)
      this._var = this._game.state.variables[this.name + "/fill"];
    return this._var;
  },

  /* Update the fill meter */
  _updateMeter: function() {
    /* Update fill meter */
    if (this._meter == null) {
      this._meter = $sel(".item-bar-content", this.render());
    }
    var v = this._getVar();
    var f = Math.round(v.value / v.maximum * 10000) / 100;
    var fill = f + "%";
    if (this._meter.style.width != fill)
      this._meter.style.width = fill;
  },

  /* Update the action button */
  _updateButton: function() {
    if (this._button == null)
      this._button = $sel(".item-use", this.render());
    var text = (this.burning) ? "Extinguish" : "Ignite";
    if (this._button.textContent != text)
      this._button.textContent = text;
  },

  /* Use the item */
  use: function() {
    this.setBurning(! this.burning);
  },

  /* Set the burning state */
  setBurning: function(state) {
    var v = this._getVar();
    if (state && v.value < 1e-6) {
      this._game.showMessage("The lighter is burnt out.");
      return;
    } else if (state == this.burning) {
      return;
    }
    this.burning = state;
    this._updateButton();
    if (this.burning) {
      if (this._game.setFlag("lighter-space")) {
        this._game.showMessage("The flame looks funny... Oh, right.");
        this._game.showMessage(["i", null, "Lack of gravity."]);
      }
      this._game.showMessage("The flame is blue and spherical.");
    } else {
      this._game.showMessage("It is dark again.");
    }
    if (this.onchange) this.onchange.cb(this);
  }
});

/* *** Initialization *** */

var Dasca = {
  game: null
};

function init() {
  var game = null;
  $id("startgame").addEventListener("click", function() {
    if (game) game.unmount();
    game = new Game();
    Dasca.game = game;
    game.mount($id("mainscreen"));
    game.start();
    showNode("mainscreen");
  });
  $id("credits-title").addEventListener("click", function() {
    showNode("creditscreen");
  });
  $id("back-credits").addEventListener("click", function() {
    if (game && game.running) {
      showNode("mainscreen");
    } else {
      showNode("titlescreen");
    }
  });
  showNode("titlescreen");
}

window.addEventListener("load", init);
