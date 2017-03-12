
/* Dasca, an idle game by @CylonicRaider (github.com/CylonicRaider/dasca)
 * Abstract engine for JS-based idle games */

'use strict';

/* *** Clock ***
 * An object allowing to sample "time" (as defined by an external source)
 * with a linear transform in place. */

/* Construct a new clock
 * source is a function that, when called, returns the current time; scale
 * and offset modify source's output in a linear fashion: the reading of
 * source is multiplied by scale and offset is added to that to obtain the
 * current time. If scale is undefined or null, it defaults to 1; if offset
 * is null, it is computed such that the clock starts counting from zero. */
function Clock(source, scale, offset) {
  if (scale == null) scale = 1.0;
  if (offset == null) offset = -source() * scale;
  this.source = source;
  this.scale = scale;
  this.offset = offset;
}

Clock.prototype = {
  /* Sample the current time */
  now: function() {
    return this.source() * this.scale + this.offset;
  },

  /* Construct a new clock from this one, applying the given transformation
   * The new clock derives its time from the same (!) source as this one,
   * but its scale and offset are modified to simulate a clock constructed
   * like
   *     new Clock(this, scale, offset);
   */
  derive: function(scale, offset) {
    if (scale == null) scale = 1.0;
    if (offset != null) offset = this.offset * scale + offset;
    var ret = new Clock(this.source, this.scale * scale, offset);
    if (this._realTime) ret._realTime = true;
    return ret;
  },

  /* Change the scale of the clock, ensuring that readings continue to be
   * continuous */
  setScale: function(scale) {
    var samp = this.source();
    this.offset = (this.scale - scale) * samp + this.offset;
    this.scale = scale;
  },

  /* Change the scale of the clock relatively to the current one */
  changeScale: function(factor) {
    this.setScale(this.scale * factor);
  },

  /* Jump to the given time */
  setTime: function(time) {
    this.offset = time - this.source() * this.scale;
  },

  /* Change the time reported by the clock by the given increment */
  changeTime: function(delta) {
    this.offset -= delta;
  },

  /* Serialization boilerplate */
  constructor: Clock,

  /* Seralize */
  __save__: function() {
    if (! this._realTime) throw new Error("Clock not serializable!");
    return {scale: this.scale, time: this.now()};
  },

  /* Deserialize */
  __restore__: function(data) {
    return Clock.realTime(data.scale, data.time);
  }
};

/* Construct a clock that returns (optionally scaled) real time
 * The clock counts from zero */
Clock.realTime = function(scale, start) {
  if (scale == null) scale = 1.0;
  var offset = null;
  if (start != null) offset = start - performance.now() / 1000.0 * scale;
  var ret = new Clock(function() {
    return performance.now() / 1000.0;
  }, scale, offset);
  ret._realTime = true;
  return ret;
};

/* *** Scheduler ***
 * Schedules callbacks to happen at certain times as defined by a Clock
 * instance. */

/* Construct a new scheduler
 * requeue is a funtion that somehow ("magically") ensures the function
 * passed to it is asynchronously called again some short time later; tasks
 * is an ordered array of objects whose "time" property is used to determine
 * when they are to run; contTasks is an array of tasks to be run
 * continuously, i.e. at every call of run(), until they return a true value,
 * at which point they are removed; clock is a Clock instance determining the
 * time this instance works with. The "running" property is set to true; it
 * can be used to stop the Scheduler. To start it, ensure the "running"
 * property is true and call the run() method. */
function Scheduler(requeue, tasks, contTasks, clock) {
  if (tasks == null) tasks = [];
  if (contTasks == null) contTasks = [];
  if (clock == null) clock = Clock.realTime();
  this.requeue = requeue;
  this.tasks = tasks;
  this.contTasks = contTasks;
  this.clock = clock;
  this.running = true;
  this._idle = true;
}

Scheduler.prototype = {
  /* Queue the next run of the scheduler, and perform any tasks whose time
   * has come
   * After obtaining a timestamp from the clock, all tasks whose time
   * property is not less than the timestamp are removed from the queue and
   * run using runTask(); after that, if the "running" property is true,
   * requeue is called with a bound version of this.run as only argument to
   * trigger another execution. */
  run: function() {
    /* Abort if not running */
    if (! this.running) return;
    /* Obtain current timestamp */
    var now = this.clock.now();
    /* For each task that is (over)due */
    while (this.tasks[0] && this.tasks[0].time <= now) {
      this.runTask(this.tasks.shift(), now);
    }
    /* Run the continuous tasks */
    for (var i = 0; i < this.contTasks.length; i++) {
      if (this.runTask(this.contTasks[i], now))
        this.contTasks.splice(i--, 1);
    }
    /* Schedule next iteration */
    if (this.tasks.length || this.contTasks.length) {
      this.requeue(this.run.bind(this));
    } else {
      this._idle = true;
    }
  },

  /* Run a singular task, providing the given timestamp
   * The default implementation calls the task's "cb" (which is assumed to be
   * a function) with the value of now and the Scheduler instance as
   * arguments, and consumes exceptions by logging them to the console. */
  runTask: function(task, now) {
    try {
      return task.cb(now, this);
    } catch (e) {
      console.error(e);
    }
  },

  /* Schedule a task to be run
   * If time is not null, it is inserted into task as the "time" property;
   * after that, the task is inserted at an appropriate position. */
  addTask: function(task, time) {
    if (time != null) task.time = time;
    time = task.time;
    var i;
    for (i = 0; i < this.tasks.length; i++) {
      if (this.tasks[i].time > time) break;
    }
    this.tasks.splice(i, 0, task);
    if (this.running && this._idle) {
      this._idle = false;
      this.requeue(this.run.bind(this));
    }
  },

  /* Schedule a task to be run after delta units of time */
  addTaskIn: function(task, delta) {
    this.addTask(task, this.clock.now() + delta);
  },

  /* Remove a task again */
  removeTask: function(task) {
    var idx = this.tasks.indexOf(task);
    if (idx != -1) this.tasks.splice(idx, 1);
  },

  /* Add a continuous task */
  addContTask: function(task) {
    this.contTasks.push(task);
    if (this.running && this._idle) {
      this._idle = false;
      this.requeue(this.run.bind(this));
    }
  },

  /* Remove a continuous task */
  removeContTask: function(task) {
    var idx = this.contTasks.indexOf(task);
    if (idx != -1) this.contTasks.splice(idx, 1);
  },

  /* Cancel all tasks */
  clear: function() {
    this.tasks.splice(0, this.tasks.length);
  },

  /* OOP boilerplate */
  constructor: Scheduler,

  /* Prepare for serializing a Scheduler */
  __save__: function() {
    var ret = {type: this._type, tasks: this.tasks,
               contTasks: this.contTasks, clock: this.clock,
               running: this.running};
    if (this._type == "strobe") {
      ret.fps = this._fps;
    } else if (this._type != "animated") {
      throw new Error("Scheduler not serializable!");
    }
    return ret;
  },

  /* Deserialize a Scheduler */
  __restore__: function(data) {
    var ret;
    if (data.type == "animated") {
      ret = Scheduler.makeAnimated(data.clock);
    } else if (data.type == "strobe") {
      ret = Scheduler.makeStrobe(data.fps, data.clock);
    }
    ret.tasks = data.tasks;
    ret.contTasks = data.contTasks;
    ret.running = data.running;
    return ret;
  }
};

/* Create a Scheduler for animations */
Scheduler.makeAnimated = function(clock) {
  var ret = new Scheduler(requestAnimationFrame.bind(window), null, null,
                          clock);
  ret._type = "animated";
  return ret;
};

/* Create a Scheduler that polls tasks at regular intervals */
Scheduler.makeStrobe = function(fps, clock) {
  var delay = 1000.0 / fps;
  var ret = new Scheduler(function(cb) {
    setTimeout(cb, delay);
  }, null, null, clock);
  ret._type = "strobe";
  ret._fps = fps;
  return ret;
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
