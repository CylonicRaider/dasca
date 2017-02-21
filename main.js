
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
 * the rate. */
function Variable(value) {
  this.value = value;
  this.handlers = [];
  this.lastUpdate = null;
}

Variable.prototype = {
  /* Aggregate the results of the handlers' return values and increment the
   * value by them. */
  update: function(now) {
    if (this.lastUpdate == null) this.lastUpdate = now;
    var delta = now - this.lastUpdate, incr = 0, hnd = this.handlers;
    for (var i = 0; i < hnd.length; i++) {
      if (hdn[i].rate != null) {
        incr += hnd[i].rate * delta;
      } else {
        incr += hnd[i].cb(this, delta, now);
      }
    }
    this.value += incr;
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
  } else {
    this.state = deserialize(state, this._env);
  }
  this.ui = new GameUI(this);
  this.running = true;
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
    this.addTab("start", "Cockpit", {hidden: true});
    var intro = [[["i", null, "Darkness."], 1],
                 [["i", null, "Silence."], 3],
                 [["i", null, "Confinement."], 5],
                 [["i", null, "Amnesia."], 8]];
    intro.forEach(function(x) {
      this.addTask(x[1], "showMessage", x[0]);
    }, this);
    this.addTask(10, "showTab", "start");
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

  /* Schedule an Action to be run */
  addTaskEx: function(delay, subject, method, args) {
    var task = new Action(subject, method, args, this._env);
    return this.state.scheduler.addTaskIn(task, delay);
  },

  /* Convenience wrapper for addTaskEx()
   * Arguments are passed variadically. */
  addTask: function(delay, method) {
    var m = ("game." + method).match(/^(.+)\.([^.]+)$/);
    var args = Array.prototype.slice.call(arguments, 2);
    return this.addTaskEx(delay, m[1], m[2], args);
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
    if (this.state.tabOrder.indexOf(name) == -1)
      this.state.tabOrder.push(name);
    this.state.tabs[name] = options;
    this.ui._addTab(name, dispname, options);
  },

  /* Select a UI tab */
  showTab: function(name, hidden, noShow) {
    if (hidden != null) this.state.tabs[name].hidden = hidden;
    this.ui._showTab(name, this.state.tabs[name].hidden, noShow);
  },

  /* Stop running the game */
  exit: function() {
    this.running = false;
  },

  /* OOP */
  constructor: Game
};

/* The (serializable) state of a game
 * The constructor creates a new state; for restoring a saved one, use the
 * deserialization function (in a suitable environment, which is created by
 * the constructor of Game). */
function GameState(game) {
  this.scheduler = Scheduler.makeStrobe(100);
  // {string -> bool}. Can be used to show one-off messages.
  this.flags = {};
  // [string]. Stores log messages.
  this.messages = [];
  // {string -> object}. Name is the codename of a tab; value contains the
  // display name of the tab (as "name") and, optionally, whether its button
  // should not be displayed.
  this.tabs = {};
  // [string] The order in which the tab buttons should be arranged.
  this.tabOrder = [];
  // string. Contains the codename of the current tab, or null for none.
  this.currentTab = null;
  this._game = game;
}

GameState.prototype = {
  /* OOP */
  constructor: GameState,

  /* Deserialization */
  __restore__: function(obj, env) {
    /* Let unset fields fall back to at least something */
    var ret = new GameState(env.game);
    for (var key in obj) {
      if (! /^_/.test(key) && obj.hasOwnProperty(key)) ret[key] = obj[key];
    }
    return ret;
  }
};

/* The DOM-based user interface of the game */
function GameUI(game) {
  this.game = game;
  this.root = null;
  this.parent = null;
  this._tabs = {};
  this._tabButtons = {};
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
            ["div", "row row-small row-btn vinset", {id: "tabbar"}],
            ["div", "row row-all pane", {id: "mainpane"}]
          ]]
        ]],
        ["div", "row row-small inset", {id: "bottombar"}, [
          ["button", "btn btn-small dim", {id: "credits-game"}, "Credits"],
          ["div", "col col-all"],
          ["button", "btn btn-small", {id: "exit-game"}, "Exit"]
        ]]
      ]);
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
    this._tabs[name] = $makeNode("div", "selectable layer",
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

  /* Consistency */
  constructor: GameUI
};

/* *** Initialization *** */

var Dasca = {
  game: null
};

function init() {
  var game = null;
  $id("startgame").addEventListener("click", function() {
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
