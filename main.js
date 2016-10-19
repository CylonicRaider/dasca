
/* Dasca, an idle game by @CylonicRaider (github.com/CylonicRaider/dasca)
 * Game implementation */

'use strict';

/* *** Action ***
 * A serializable (and reifiable) function wrapper, usable as a Scheduler
 * task. */

/* Construct a new action */
function DascaAction(name, cb) {
  if (cb == null && DascaAction.cache[name])
    cb = DascaAction.cache[name].cb;
  this.name = name;
  this.cb = cb;
}

DascaAction.prototype = {
  /* OOP helper */
  constructor: DascaAction
};

/* Cache of actions
 * Although the term is not exactly correct, I couldn't think of a better
 * one. */
DascaAction.cache = {};

/* Add an action to the cache */
DascaAction.addAction = function(name, cb) {
  DascaAction.cache[name] = new DascaAction(name, cb);
};

/* Serialization hook */
DascaAction.__save__ = function(action) {
  return {name: action.name};
}

/* Deserialization hook */
DascaAction.__restore__ = function(data) {
  var ret = new DascaAction(data.name);
  if (ret.cb == null) throw new Error("Unrecognized action!");
  return ret;
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
