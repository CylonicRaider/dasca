
/* Dasca, an idle game by @CylonicRaider (github.com/CylonicRaider/dasca)
 * Game implementation */

'use strict';

/* *** Utilities *** */

function $id(id, elem) {
  return (elem || document).getElementById(id);
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
  if (state == null) {
    this.state = new GameState(this);
  } else {
    var env = Object.create(window);
    env.game = this;
    this.state = deserialize(state, env);
  }
  this.ui = new GameUI(this);
  this.running = true;
}

Game.prototype = {
  /* Mount the game into the given node */
  mount: function(node) {
    this.ui.mount(node);
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
  this.flags = {};
  this._game = game;
}

GameState.prototype = {
  /* OOP */
  constructor: GameState,

  /* Deserialization */
  __restore__: function(obj, env) {
    var ret = Object.create(GameState);
    for (var key in obj) {
      if (! /^_/.test(key) && obj.hasOwnProperty(key)) ret[key] = obj[key];
    }
    ret._game = env.game;
    return ret;
  }
};

/* The DOM-based user interface of the game */
function GameUI(game) {
  this.game = game;
  this.root = null;
  this.parent = null;
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
            ["div", "row row-small inset", {id: "tabbar"}],
            ["div", "row row-all inset", {id: "mainpane"}]
          ]]
        ]],
        ["div", "row row-small inset", {id: "bottombar"}, [
          ["button", "btn btn-small dim", {id: "credits-game"}, "Credits"],
          ["div", "col col-all"],
          ["button", "btn btn-small", {id: "exit-game"}, "Exit"]
        ]]
      ]);
      $sel("#exit-game", this.root).addEventListener("click", function() {
        this.game.exit();
        showNode("titlescreen");
      }.bind(this));
      $sel("#credits-game", this.root).addEventListener("click", function() {
        showNode("creditscreen");
      });
    }
    return this.root;
  },

  /* Embed the game's UI into the given DOM node
   * If not already done, the UI is constructed. */
  mount: function(parent) {
    this.parent = parent;
    parent.appendChild(this.render());
  },

  /* Consistency */
  constructor: GameUI
};

/* *** Initialization *** */

function init() {
  var game = null;
  $id("startgame").addEventListener("click", function() {
    game = new Game();
    game.mount($id("mainscreen"));
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
