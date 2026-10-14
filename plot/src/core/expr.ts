/**
 * A small, safe expression language for plotting.
 *
 *   2x^2 - 3x + 1        sin(x)/x         e^(-x^2/2)
 *   r = 1 + cos(θ)       x = cos(3t)      x^2 + y^2 = 4
 *
 * Recursive descent, no eval. Supports implicit multiplication (2x, 3sin x,
 * (x+1)(x-1), 2pi), right-associative ^, unary minus that binds looser than
 * ^ (so -x^2 = -(x^2)), postfix ! for factorials, and |x| for absolute value.
 */

export type Env = Record<string, number>;
export type Fn = (env: Env) => number;

type Tok =
  | { k: 'num'; v: number }
  | { k: 'id'; v: string }
  | { k: 'op'; v: string }
  | { k: 'end' };

const FUNCS: Record<string, (...a: number[]) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  sec: (x) => 1 / Math.cos(x), csc: (x) => 1 / Math.sin(x), cot: (x) => 1 / Math.tan(x),
  asin: Math.asin, acos: Math.acos, atan: Math.atan, arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, asinh: Math.asinh, acosh: Math.acosh, atanh: Math.atanh,
  exp: Math.exp, ln: Math.log, log: Math.log10, log2: Math.log2, lg: Math.log10,
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, sign: Math.sign, sgn: Math.sign,
  floor: Math.floor, ceil: Math.ceil, round: Math.round,
  min: Math.min, max: Math.max, atan2: Math.atan2, hypot: Math.hypot,
  // Heaviside step and sinc are handy in physics
  step: (x) => (x < 0 ? 0 : 1), H: (x) => (x < 0 ? 0 : 1),
  sinc: (x) => (x === 0 ? 1 : Math.sin(x) / x),
  gamma: gammaFn, fact: (x) => gammaFn(x + 1),
  mod: (a, b) => ((a % b) + b) % b,
};

const CONSTS: Record<string, number> = { pi: Math.PI, π: Math.PI, e: Math.E, tau: 2 * Math.PI, τ: 2 * Math.PI, phi: (1 + Math.sqrt(5)) / 2, φ: (1 + Math.sqrt(5)) / 2 };

/** Lanczos approximation, accurate to about 15 digits. */
function gammaFn(z: number): number {
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gammaFn(1 - z));
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

export class ParseError extends Error {
  constructor(message: string, public pos: number) { super(message); }
}

/** Normalize the many ways people type math on a tablet keyboard. */
export function normalize(src: string): string {
  return src
    .replace(/[−–—]/g, '-')
    .replace(/[×·∙⋅]/g, '*')
    .replace(/÷/g, '/')
    .replace(/\*\*/g, '^')
    .replace(/²/g, '^2').replace(/³/g, '^3')
    .replace(/√/g, 'sqrt')
    .replace(/θ|ϑ/g, 'theta')
    .replace(/\btheta\b|\bth\b/g, 'theta')
    .trim();
}

function tokenize(src: string): (Tok & { pos: number })[] {
  const out: (Tok & { pos: number })[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    const num = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));
    if (num) {
      // "2e" alone is 2·e; only treat e as exponent when digits follow
      out.push({ k: 'num', v: parseFloat(num[0]), pos: i });
      i += num[0].length;
      continue;
    }
    const id = /^[A-Za-zπτφ_][A-Za-z0-9_]*/.exec(src.slice(i));
    if (id) { out.push({ k: 'id', v: id[0], pos: i }); i += id[0].length; continue; }
    if ('+-*/^(),!|='.includes(c)) { out.push({ k: 'op', v: c, pos: i }); i++; continue; }
    if (c === '[' || c === '{') { out.push({ k: 'op', v: '(', pos: i }); i++; continue; }
    if (c === ']' || c === '}') { out.push({ k: 'op', v: ')', pos: i }); i++; continue; }
    throw new ParseError(`Unexpected "${c}"`, i);
  }
  out.push({ k: 'end', pos: src.length });
  return out;
}

/** Split an identifier like "xy" or "pix" into known names, for implicit products. */
function splitIdent(id: string, vars: Set<string>): string[] | null {
  if (FUNCS[id] || CONSTS[id] !== undefined || vars.has(id)) return [id];
  // greedy longest-first split into known pieces
  const names = [...Object.keys(FUNCS), ...Object.keys(CONSTS), ...vars].sort((a, b) => b.length - a.length);
  const res: string[] = [];
  let s = id;
  outer: while (s.length) {
    for (const n of names) {
      if (s.startsWith(n)) { res.push(n); s = s.slice(n.length); continue outer; }
    }
    return null;
  }
  return res;
}

export interface Compiled { fn: Fn; vars: Set<string>; }

export function compile(srcRaw: string, allowed: string[]): Compiled {
  const src = normalize(srcRaw);
  if (!src) throw new ParseError('Empty expression', 0);
  const varSet = new Set(allowed);
  // expand identifiers into known pieces up front
  const raw = tokenize(src);
  const toks: (Tok & { pos: number })[] = [];
  for (const t of raw) {
    if (t.k === 'id') {
      const parts = splitIdent(t.v, varSet);
      if (!parts) throw new ParseError(`Unknown name "${t.v}"`, t.pos);
      for (const p of parts) toks.push({ k: 'id', v: p, pos: t.pos });
    } else toks.push(t);
  }
  let p = 0;
  const used = new Set<string>();
  const peek = () => toks[p];
  const isOp = (v: string) => { const t = toks[p]; return t.k === 'op' && t.v === v; };
  const expect = (v: string) => { if (!isOp(v)) throw new ParseError(`Expected "${v}"`, toks[p].pos); p++; };

  // expr := term (('+'|'-') term)*
  function expr(): Fn {
    let left = term();
    while (isOp('+') || isOp('-')) {
      const op = (toks[p++] as any).v;
      const r = term(), l = left;
      left = op === '+' ? (e) => l(e) + r(e) : (e) => l(e) - r(e);
    }
    return left;
  }
  // term := unary (('*'|'/'|implicit) unary)*
  function term(): Fn {
    let left = unary();
    for (;;) {
      if (isOp('*') || isOp('/')) {
        const op = (toks[p++] as any).v;
        const r = unary(), l = left;
        left = op === '*' ? (e) => l(e) * r(e) : (e) => l(e) / r(e);
      } else if (startsFactor()) {
        const r = power(), l = left; // implicit multiplication binds like *
        left = (e) => l(e) * r(e);
      } else return left;
    }
  }
  function startsFactor(): boolean {
    const t = peek();
    if (t.k === 'num' || t.k === 'id') return true;
    if (t.k === 'op' && t.v === '(') return true;
    if (t.k === 'op' && t.v === '|' && absDepth === 0) return true;
    return false;
  }
  // unary := ('-'|'+') unary | power
  function unary(): Fn {
    if (isOp('-')) { p++; const u = unary(); return (e) => -u(e); }
    if (isOp('+')) { p++; return unary(); }
    return power();
  }
  // power := postfix ('^' unary)?   (right associative, exponent may be negative)
  function power(): Fn {
    const base = postfix();
    if (isOp('^')) { p++; const ex = unary(); return (e) => powSafe(base(e), ex(e)); }
    return base;
  }
  function postfix(): Fn {
    let f = atom();
    while (isOp('!')) { p++; const g = f; f = (e) => gammaFn(g(e) + 1); }
    return f;
  }
  /**
   * The argument of a function written without brackets: "sin 2x" is sin(2x)
   * and "sin x^2" is sin(x^2), but "sin x cos x" stops before cos.
   */
  function funcArg(): Fn {
    let f = unary();
    for (;;) {
      const t = peek();
      if (t.k === 'num' || (t.k === 'id' && !FUNCS[t.v])) { const r = power(), l = f; f = (e) => l(e) * r(e); }
      else return f;
    }
  }
  let absDepth = 0;
  function atom(): Fn {
    const t = peek();
    if (t.k === 'num') { p++; const v = t.v; return () => v; }
    if (t.k === 'op' && t.v === '(') { p++; const inner = expr(); expect(')'); return inner; }
    if (t.k === 'op' && t.v === '|') {
      p++; absDepth++; const inner = expr(); absDepth--; expect('|');
      return (e) => Math.abs(inner(e));
    }
    if (t.k === 'id') {
      p++;
      const name = t.v;
      if (FUNCS[name]) {
        const f = FUNCS[name];
        // f(args)  or  f x  (e.g. "sin x", "ln 2x" = ln(2x))
        if (isOp('(')) {
          p++;
          const args = [expr()];
          while (isOp(',')) { p++; args.push(expr()); }
          expect(')');
          // sin(x)^2 means (sin x)^2 — handled by power() around atom
          if (args.length === 1) { const a = args[0]; return (e) => f(a(e)); }
          return (e) => f(...args.map((a) => a(e)));
        }
        // function power shorthand: sin^2 x
        if (isOp('^')) {
          p++; const ex = unary(); const arg = funcArg();
          return (e) => powSafe(f(arg(e)), ex(e));
        }
        const arg = funcArg();
        return (e) => f(arg(e));
      }
      if (varSet.has(name)) { used.add(name); return (e) => e[name]; }
      if (CONSTS[name] !== undefined) { const v = CONSTS[name]; return () => v; }
      throw new ParseError(`Unknown name "${name}"`, t.pos);
    }
    if (t.k === 'end') throw new ParseError('Expression ends too soon', t.pos);
    throw new ParseError(`Unexpected "${(t as any).v}"`, t.pos);
  }

  const fn = expr();
  if (peek().k !== 'end') throw new ParseError(`Unexpected "${(peek() as any).v}"`, peek().pos);
  return { fn, vars: used };
}

/** x^(1/3) of a negative number should be the real cube root, as students expect. */
function powSafe(b: number, x: number): number {
  if (b < 0 && !Number.isInteger(x)) {
    // odd-denominator rational exponents: (-8)^(1/3) = -2
    for (const d of [3, 5, 7, 9]) {
      const n = Math.round(x * d);
      if (Math.abs(x * d - n) < 1e-9 && n % 2 !== 0) return -Math.pow(-b, x);
      if (Math.abs(x * d - n) < 1e-9 && n % 2 === 0) return Math.pow(-b, x);
    }
  }
  return Math.pow(b, x);
}

/* ---------- equations: what kind of plot did the user type? ---------- */

export type Spec =
  | { kind: 'function'; f: Fn; label: string }               // y = f(x)
  | { kind: 'xfunction'; f: Fn; label: string }              // x = g(y)
  | { kind: 'polar'; f: Fn; label: string }                  // r = f(θ)
  | { kind: 'implicit'; f: Fn; label: string }               // F(x, y) = G(x, y)
  | { kind: 'slope'; f: Fn; label: string; init?: [number, number] } // y' = f(x, y), y(0) = 1
  | { kind: 'vertical'; x: number; label: string }           // x = 3
  | { kind: 'parametric'; x: Fn; y: Fn; label: string };     // (cos t, sin t)

/** Split on commas and semicolons that are not inside brackets. */
function splitTop(s: string, seps: string): string[] {
  const out: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (depth === 0 && seps.includes(c)) { out.push(s.slice(start, i)); start = i + 1; }
  }
  out.push(s.slice(start));
  return out.map((t) => t.trim());
}

/** Parse one line the way a student would write it. */
export function parseEquation(line: string): Spec {
  let s = normalize(line);
  const label = line.trim();
  if (!s) throw new ParseError('Empty line', 0);
  // parametric: "(cos t, sin t)" or "x = cos t, y = sin t"
  const outer = /^\((.*)\)$/.exec(s);
  if (outer && splitTop(outer[1], ',').length === 2 && balanced(outer[1])) {
    const [a, b] = splitTop(outer[1], ',');
    const P = parseParametric(a, b);
    return { kind: 'parametric', x: P.x, y: P.y, label };
  }
  const parts = splitTop(s, ',;');
  if (parts.length === 2 && /^x\s*(\(t\))?\s*=/.test(parts[0]) && /^y\s*(\(t\))?\s*=/.test(parts[1])) {
    const P = parseParametric(parts[0], parts[1]);
    return { kind: 'parametric', x: P.x, y: P.y, label };
  }
  if (parts.length === 2) {
    // y' = f(x, y), y(a) = b : a slope field with the solution through (a, b)
    const ic = /^y\((.+)\)\s*=\s*(.+)$/.exec(parts[1]);
    if (ic) {
      const sp = parseEquation(parts[0]);
      if (sp.kind !== 'slope') throw new ParseError('An initial value goes with y\' = ...', s.indexOf(','));
      return { ...sp, label, init: [evalNumber(ic[1]), evalNumber(ic[2])] };
    }
  }
  if (parts.length > 1) throw new ParseError('Use one equation per line', s.indexOf(',') >= 0 ? s.indexOf(',') : s.indexOf(';'));
  s = parts[0];
  const eq = s.split('=');
  if (eq.length > 2) throw new ParseError('More than one "="', s.lastIndexOf('='));
  if (eq.length === 1) {
    // bare expression: f(x), or F(x, y) if it uses y
    const c = compile(s, ['x', 'y']);
    if (c.vars.has('y')) throw new ParseError('Add "= 0" (or another side) to plot an equation in x and y', s.length);
    return { kind: 'function', f: c.fn, label };
  }
  const [lhsRaw, rhsRaw] = eq.map((t) => t.trim());
  const lhs = lhsRaw.replace(/\s+/g, '');
  // y' = f(x, y), dy/dx = f(x, y)
  if (/^(y'|dy\/dx|y_x)$/.test(lhs)) return { kind: 'slope', f: compile(rhsRaw, ['x', 'y']).fn, label };
  if (/^(y|f\(x\)|[a-z]\(x\))$/.test(lhs)) {
    const c = compile(rhsRaw, ['x', 'y']);
    if (!c.vars.has('y')) return { kind: 'function', f: c.fn, label };
  }
  if (/^(r|r\(theta\))$/.test(lhs)) return { kind: 'polar', f: compile(rhsRaw, ['theta', 't']).fn, label };
  if (lhs === 'x') {
    const c = compile(rhsRaw, ['y', 'x']);
    if (c.vars.size === 0) return { kind: 'vertical', x: c.fn({}), label };
    if (!c.vars.has('x')) return { kind: 'xfunction', f: c.fn, label };
  }
  // general implicit: F(x, y) - G(x, y) = 0
  const L = compile(lhsRaw, ['x', 'y']).fn, R = compile(rhsRaw, ['x', 'y']).fn;
  return { kind: 'implicit', f: (e) => L(e) - R(e), label };
}

function balanced(s: string): boolean {
  let d = 0;
  for (const c of s) { if ('([{'.includes(c)) d++; else if (')]}'.includes(c)) { d--; if (d < 0) return false; } }
  return d === 0;
}

/** A parametric pair x(t), y(t). */
export function parseParametric(xs: string, ys: string): { x: Fn; y: Fn } {
  const strip = (s: string, v: string) => normalize(s).replace(new RegExp(`^\\s*${v}(\\(t\\))?\\s*=`), '');
  return { x: compile(strip(xs, 'x'), ['t']).fn, y: compile(strip(ys, 'y'), ['t']).fn };
}

/** Evaluate a plain number such as "2pi", "-pi/2" or "3.5" for range fields. */
export function evalNumber(s: string): number {
  const v = compile(s, []).fn({});
  if (!Number.isFinite(v)) throw new ParseError(`"${s}" is not a finite number`, 0);
  return v;
}
