
/* Dasca, an idle game by @CylonicRaider (github.com/CylonicRaider/dasca)
 * Game implementation */

'use strict';

/* *** Utilities *** */

/* Shortcut for getElementById */
function $id(id, ctx) {
  return (ctx || document).getElementById(id);
}

/* Create a DOM element */
function $make(name, className, attrs, children) {
  /* Create node */
  var ret = document.createElement(name);
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
      if (typeof e == "string") {
        /* Strings become text nodes */
        ret.appendChild(document.createTextNode(e));
      } else if (typeof e != "object") {
        /* Other primitive types are not allowed */
        throw new Error("Bad child encountered during DOM node creation");
      } else if (Array.isArray(e)) {
        /* Arrays are handled recursively */
        ret.appendChild($make.apply(null, e));
      } else {
        /* Everything else is assumed to be a DOM node */
        ret.appendChild(e);
      }
    }
  }
  return ret;
}

/* *** Action ***
 * A serializable (and reifiable) function wrapper, usable as a Scheduler
 * task. */

/* Construct a new action
 * name idenfities what to perform, extra may be used to pass additional data
 * to the action, context contains further additional data.
 * While extra is serialized, context is not; thus, name and extra should
 * completely idenfity the action, and context should contain references to
 * objects which are otherwise unattainable. */
function DascaAction(name, extra, context) {
  this.name = name;
  this.extra = extra;
  this.context = context;
  if (DascaAction.handlers[name]) {
    this.cb = DascaAction.handlers[name];
  } else {
    throw new Error("Unknown action " + name);
  }
}

DascaAction.prototype = {
  /* OOP helper */
  constructor: DascaAction
};

/* Collection of handlers for actions */
DascaAction.handlers = {};

/* Add a handler to the list */
DascaAction.addHandler = function(name, cb) {
  DascaAction.handlers[name] = cb;
};

/* Serialization hook */
DascaAction.__save__ = function(action) {
  return {name: action.name, extra: action.extra || undefined};
}

/* Deserialization hook */
DascaAction.__restore__ = function(data, context) {
  return new DascaAction(data.name, data.extra, context);
}

/* *** Variables ***
 * Each variable has a name and a (mutable) value; when the value is changed
 * via the setter method, callbacks registered for the variable (statically)
 * are invoked, each with "this" set to the variable, and the name, the new,
 * and the old value as arguments.
 * Callbacks are registered statically to aid serialization. */

/* Construct a new variable */
function Variable(name, value) {
  this.name = name;
  this.value = value;
}

Variable.prototype = {
  /* Get the value of the variable */
  get: function() {
    return this.value;
  },

  /* Set the value of the variable
   * If the value changes, callbacks are invoked. */
  set: function(value) {
    if (value === this.value) return;
    var oldVal = this.value;
    this.value = value;
    var cbs = callbacks[this.name];
    if (cbs) {
      for (var i = 0; i < cbs.length; i++)
        cbs[i].call(this, this.name, value, oldVal);
    }
  },

  /* OOP noise */
  constructor: Variable
}

/* Mapping of variable names to values */
Variable.callbacks = {};

/* Register the given callback for the given variable name */
Variable.addCallback = function(name, cb) {
  if (! Variable.callbacks[name])
    Variable.callbacks[name] = [];
  if (Variable.callbacks[name].indexOf(cb) == -1)
    Variable.callbacks[name].push(cb);
};

/* Deregister the given callback */
Variable.removeCallback = function(name, cb) {
  if (! Variable.callbacks[name]) return;
  var idx = Variable.callbacks[name].indexOf(cb);
  if (idx != -1) Variable.callbacks[name].splice(idx, 1);
};

/* *** Game objects *** */

/* Construct a new Game
 * state is either null (to indicate the creation of a fresh game), or a
 * string containing a serialized GameState, which is restored. */
function Game(state) {
  this.context = Object.create(window);
  this.context.game = this;
  if (state) {
    this.state = deserialize(state, this.context);
  } else {
    this.state = new GameState();
  }
  this.ui = new GameUI(this);
  this.running = true;
}

Game.prototype = {
  /* Save the game state to a string */
  save: function() {
    return serialize(this.state);
  },

  /* Actually commence game here */
  init: function() {
    var sched = this.state.scheduler;
    sched.clock.setTime(0);
    var texts = [["Darkness.", 1],
                 ["Silence.", 3],
                 ["Confinement.", 5],
                 ["Amnesia.", 9]];
    texts.forEach(function(x) {
      sched.addTask(new DascaAction("showMessage", x[0], this.context),
                    x[1]);
    }, this);
  },

  /* Pause the game */
  pause: function() {
    this.state.scheduler.clock.setScale(0);
  },

  /* Unpause the game */
  unpause: function() {
    this.state.scheduler.clock.setScale(1);
  },

  /* OOP hook */
  constructor: Game
};

/* Construct a new game state
 * For restoring a saved state, use deserialization. */
function GameState() {
  this.scheduler = Scheduler.makeStrobe(100);
  this.messages = [];
}

GameState.prototype = {
  /* OOP necessity */
  constructor: GameState
};

/* Construct a new game UI */
function GameUI(game) {
  this.game = game;
  this.root = null;
}

GameUI.prototype = {
  /* Install the game UI into the given node */
  mount: function(node) {
    this.root = node;
    /* Create basic node structure */
    node.innerHTML = "";
    node.appendChild($make("div", "row row-all", null, [
      ["div", "col col-quarter inset", {id: "messagebar"}],
      ["div", "col col-all", null, [
        ["div", "row row-small inset", {id: "tabbar"}],
        ["div", "row row-all inset", {id: "mainpane"}]
      ]],
      ["div", "col col-quarter inset", {id: "inventbar"}]
    ]));
    node.appendChild($make("div", "row row-small inset", {id: "bottombar"}, [
      ["button", "btn btn-small dim", {id: "credits-game"}, "Credits"]
    ]));
    /* Restore state */
    if (this.game.state.messages.length) {
      var m = this.game.state.messages;
      for (var i = 0; i < m.length; i++)
        this._showMessage(messages[i], true);
    }
    /* Install button handlers */
    $id("credits-game").addEventListener("click", function() {
      showNode("creditscreen");
      this.game.pause();
    }.bind(this));
  },

  /* Append a message to the message bar without updating the game state
   * Used internally. */
  _showMessage: function(msg) {
    var msgnode = $make("p", "log-message", {}, [msg]);
    var msgbar = $id("messagebar");
    msgbar.appendChild(msgnode);
    msgbar.scrollTop = msgbar.offsetHeight;
  },

  /* Append a message to the message bar */
  showMessage: function(msg) {
    this._showMessage(msg);
    this.game.state.messages.push(msg);
  },

  /* OOP annoyance */
  constructor: GameUI
};

/* Handler handler for showing messages */
DascaAction.addHandler("showMessage", function() {
  this.context.game.ui.showMessage(this.extra);
});

/* *** UI control *** */

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

/* *** Initialization *** */

function init() {
  var game;
  showNode("titlescreen");
  $id("startgame").addEventListener("click", function() {
    game = new Game();
    game.ui.mount($id("mainscreen"));
    showNode("mainscreen");
    game.init();
  });
  $id("credits-title").addEventListener("click", function() {
    showNode("creditscreen");
    if (game) game.pause();
  });
  $id("back-credits").addEventListener("click", function() {
    if (game && game.running) {
      if (game) game.unpause();
      showNode("mainscreen");
    } else {
      showNode("titlescreen");
    }
  });
}

/* Install load handler */
window.addEventListener("load", init);
