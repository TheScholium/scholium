// Tiny test harness: no framework, runs under plain Node after esbuild.
let failed = 0, passed = 0;
export function ok(cond: unknown, msg: string) {
  if (cond) passed++; else { failed++; console.log('FAIL', msg); }
}
export function near(a: number, b: number, msg: string, tol = 1e-9) {
  ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)) || (Number.isNaN(a) && Number.isNaN(b)), `${msg}: got ${a}, want ${b}`);
}
export function throws(f: () => unknown, msg: string) {
  try { f(); ok(false, `${msg}: no error`); } catch { passed++; }
}
export function done(name: string) {
  console.log(`${name}: ${passed} passed, ${failed} failed`);
  if (failed) process.exitCode = 1;
}
