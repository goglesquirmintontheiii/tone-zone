// One compiled script with its own globals and a step budget for every entry (setup, a frame, an event).
import { compile, ScriptError, LTable } from './lang.js';
import { installStdlib } from './stdlib.js';

const CHUNK = 4000; // steps between budget / clock checks
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class VM {
  constructor(src, o = {}) {
    this.G = new Map();
    this.used = 0;
    this.limit = 1e6;
    this.deadline = Infinity;
    this.R = { steps: CHUNK, depth: 0, G: this.G, out: (line) => this._out(line) };
    installStdlib(this.G, this.R, o.log || (() => {}));
    this.main = compile(src, this.R); // throws a syntax ScriptError
  }
  _out(line) {
    this.used += CHUNK - this.R.steps;
    if (this.used >= this.limit) throw new ScriptError('the script did too much work in one go and was stopped (a loop that never ends?)', line, 'budget');
    if (now() > this.deadline) throw new ScriptError('the script took too long and was stopped (a loop that never ends?)', line, 'budget');
    this.R.steps = CHUNK;
  }
  /** Run fn(...args) with a budget. Throws ScriptError. */
  run(fn, args = [], steps = 2e5, ms = 12) {
    this.used = 0;
    this.limit = steps;
    this.deadline = now() + ms;
    this.R.steps = CHUNK;
    this.R.depth = 0;
    try {
      return fn(...args);
    } catch (e) {
      if (e instanceof ScriptError) throw e;
      if (e instanceof RangeError) throw new ScriptError('too many nested calls (endless recursion?)', 0);
      throw new ScriptError(String((e && e.message) || e), 0);
    }
  }
  start(steps = 1e6, ms = 60) {
    return this.run(this.main, [], steps, ms);
  }
  has(name) {
    return typeof this.G.get(name) === 'function';
  }
  call(name, args, steps, ms) {
    const f = this.G.get(name);
    if (typeof f !== 'function') return undefined;
    return this.run(f, args, steps, ms);
  }
  set(name, v) {
    this.G.set(name, v);
  }
  get(name) {
    return this.G.get(name);
  }
}
export { ScriptError, LTable };
