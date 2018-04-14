
/* Dasca, an idle game by @CylonicRaider (github.com/CylonicRaider/dasca)
 * Abstract engine for JS-based idle games */

'use strict';

/* *** Scheduler ***
 *
 * Runs callbacks at a defined rate. */

/* Construct a new scheduler
 *
 * fps is the rate at which callbacks should run. Scheduler attempts to run
 * them in an evenly distributed manner; if that fails, callbacks are
 * executed in batches such that fps remains valid on average. */
function Scheduler(fps) {
  this.fps = fps;
  this.running = true;
  this.tasks = [];
  this.contTasks = [];
  this._timer = null;
  this._lastRun = null;
}

Scheduler.prototype = {
  /* Serialization stuff */
  constructor: Scheduler
  /* NYI */
};

/* *** Serialization ***
 * Serializes object trees (!) into JSON strings, allowing reified objects to
 * be of the correct type, and to hook their (de)serialization process.
 * Input containing enumerable function properties is rejected (since those
 * are silently swallowed by JSON); use hooks to meaningfully handle them.
 * When hooks are not used, properties whose names start with underscores (in
 * particular the special properties) are removed. */

/* Resolve a dotted name string to an object */
function findObject(name, env) {
  if (env == null) env = window;
  var cur = env, spl = name.split(".");
  for (var i = 0; i < spl.length; i++) {
    cur = cur[spl[i]];
  }
  return cur;
}

/* Serialize an object tree to JSON, storing type information */
function serialize(obj) {
  return JSON.stringify(obj, function(name, value) {
    /* Fail verbosely */
    if (typeof value == "function")
      throw new Error("Cannot serialize function");
    /* Only transform object values */
    if (typeof value != "object" || Array.isArray(value)) return value;
    if (value === null) return null;
    /* Get a meaningful constructor name */
    var cons = value.__sername__;
    if (! cons) cons = value.constructor.name;
    if (! cons) cons = Object.prototype.toString(value).slice(8, -1);
    if (cons == "Object") cons = undefined;
    /* Copy properties into new object, or let object serialize itself */
    var ret;
    if (value.__save__) {
      ret = value.__save__();
    } else {
      ret = {};
      for (var prop in value) {
        if (typeof value[prop] == "function" && ! value.hasOwnProperty(prop))
          continue;
        if (/^_/.test(prop))
          continue;
        ret[prop] = value[prop];
      }
    }
    /* Add __type__ */
    ret.__type__ = cons;
    /* Done */
    return ret;
  });
}

/* Deserialize a JSON string into an object structure */
function deserialize(obj, env) {
  if (env == null) env = window;
  return JSON.parse(obj, function(name, value) {
    /* Ignore non-objects */
    if (typeof value != "object" || Array.isArray(value)) return value;
    if (value == null) return null;
    /* Check for a __type__ */
    if (value.__type__) {
      /* Obtain type object */
      var type = findObject(value.__type__, env);
      if (type && type.prototype && type.prototype.__restore__) {
        /* Use restorer function */
        value = type.prototype.__restore__(value, env);
      } else if (type) {
        /* Assume an object is deserializable as-is */
        var newVal = Object.create(type.prototype);
        for (var k in value) if (! /^__.+__$/.test(k)) newVal[k] = value[k];
        value = newVal;
      } else {
        /* Nope */
        throw new Error("Object not deserializable (cannot find type): " +
                        JSON.stringify(value));
      }
      /* Allow alternative restoration handler. */
      if (type && type.prototype && type.prototype.__reinit__)
        type.prototype.__reinit__.call(value, env);
    }
    return value;
  });
}

/* Turn a JSON string into an ASCII equivalent */
function json2ascii(s) {
  return s.replace(/[^ -~]/g, function(ch) {
    s = ch.charCodeAt(0).toString(16);
    switch (s.length) {
      case 1: return "\\u000" + s;
      case 2: return "\\u00" + s;
      case 3: return "\\u0" + s;
      case 4: return "\\u" + s;
    }
  });
}

/* Construct a new StorageCell
 * The object encapsulates the value associated with a particular
 * localStorage key, and additionally caches saved values in memory (in case
 * localStorage is not available). */
function StorageCell(name) {
  this.name = name;
  this.rawValue = undefined;
}

StorageCell.prototype = {
  /* Load the value without deserializing */
  loadRaw: function() {
    if (window.localStorage) {
      var val = localStorage.getItem(this.name);
      if (val != null)
        this.rawValue = val;
    }
    return this.rawValue;
  },

  /* Load the value and deserialize it (in the given environment) */
  load: function(env) {
    return deserialize(this.loadRaw(), env);
  },

  /* Save the given value without serialization */
  saveRaw: function(val) {
    this.rawValue = val;
    if (window.localStorage) {
      localStorage.setItem(this.name, this.rawValue);
    }
  },

  /* Serialize the given value and save it */
  save: function(val) {
    this.saveRaw(serialize(val));
  },

  /* OOP... */
  constructor: StorageCell
};

/* *** Action ***
 * A serializable wrapper around a method call. Can be used as a callback for
 * Scheduler; for that reason, a property named "time" is serialized and
 * restored if present. */

/* Construct a new Action
 * self is the name (!) of an object to be resolved relative to env; func is
 * the name of a function to be resolved relative to self; args is an array
 * of arguments. The function is called with the object resolved for self as
 * the this object and args as the positional arguments.
 * If args is omitted, an empty array is used; if env is omitted, the global
 * object (i.e. window) is used. */
function Action(self, func, args, env) {
  this.self = self;
  this.func = func;
  this.args = args || [];
  this.env = env || window;
}

Action.prototype = {
  /* Do what is said on the tin
   * Resolve and run the function represented by this object as described
   * along with the constructor, and return its return value.
   * Arguments passed to run() are appended to the arguments stored in the
   * object. */
  run: function() {
    // Implementation moved to the more-used cb().
    return this.cb.apply(this, arguments);
  },

  /* Callback
   * Many objects invoking others expect the functionality to be located at
   * this attributes; this method is hence identical to run(). */
  cb: function() {
    var self = findObject(this.self, this.env);
    var method = findObject(this.func, self);
    return method.apply(self,
                        Array.prototype.concat.apply(this.args, arguments));
  },

  /* OOP boilerplate */
  constructor: Action,

  /* Prepare for serialization */
  __save__: function() {
    var ret = {self: this.self, func: this.func, args: this.args};
    if (this.time != null) ret.time = this.time;
    return ret;
  },

  /* Deserialize */
  __reinit__: function(env) {
    this.env = env;
  }
};

/* Construct a CachingAction
 * The class derives from Action, and only differs in caching the self object
 * and method (under the assumption that those will never change).
 */
function CachingAction(self, func, args, env) {
  Action.apply(this, arguments);
  this._self = null;
  this._func = null;
}

CachingAction.prototype = Object.create(Action.prototype);

/* Run the stored function
 * Differently to Action.prototype.run, this function caches the object and
 * the method to invoke. Note that the cache may be invalidated unpredictably
 * (such as when the object is serialized). */
CachingAction.prototype.run = function() {
  if (this._func == null) {
    this._self = findObject(this.self, this.env);
    this._func = findObject(this.func, this._self);
  }
  return this._func.apply(this._self,
    Array.prototype.concat.apply(this.args, arguments));
};

/* OOP something */
CachingAction.prototype.constructor = CachingAction;
