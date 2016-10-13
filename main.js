
/* Dasca, an idle game by @CylonicRaider (github.com/CylonicRaider/dasca)
 * Game implementation */

'use strict';

/* A serializable (and reifiable) function wrapper, usable as a Scheduler
 * task */
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
