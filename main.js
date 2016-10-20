
/* Dasca, an idle game by @CylonicRaider (github.com/CylonicRaider/dasca)
 * Game implementation */

'use strict';

/* *** Action ***
 * A serializable (and reifiable) function wrapper, usable as a Scheduler
 * task. */

/* Construct a new action */
function DascaAction(name, extra) {
  this.name = name;
  this.extra = extra;
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
DascaAction.__restore__ = function(data) {
  return new DascaAction(data.name, data.extra);
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
  if (state) {
    this.state = deserialize(state, this.context);
  } else {
    this.state = new GameState();
  }
  this.ui = new GameUI(this);
}

Game.prototype = {
  /* Save the game state to a string */
  save: function() {
    return serialize(this.state);
  },

  /* OOP hook */
  constructor: Game
};

/* Construct a new game state
 * For restoring a saved state, use deserialization. */
function GameState() {
  /**/
}

GameState.prototype = {
  /* OOP necessity */
  constructor: GameState
};

/* Construct a new game UI */
function GameUI(game) {
  this.game = game;
}

GameUI.prototype = {
  /* OOP annoyance */
  constructor: GameUI
};

/* *** UI control *** */

/* Show the given UI element, hiding any siblings and showing all its
 * showable parents */
function showNode(node) {
  if (! node) return;
  /* Resolve ID-s */
  if (typeof node == "string") node = document.getElementById(node);
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
  showNode("titlescreen");
}

/* Install load handler */
window.addEventListener("load", init);
