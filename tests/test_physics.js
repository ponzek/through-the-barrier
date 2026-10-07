// Node test: physics.js vs. independent Python reference + physical checks.
// Run:  node tests/test_physics.js   (after python tests/make_reference.py)
const fs = require("fs");
const path = require("path");
const QT = require("../physics.js");

let fails = 0;
const ok = (name, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}  ${detail}`);
  if (!cond) fails++;
};

const ref = JSON.parse(fs.readFileSync(path.join(__dirname, "reference.json"), "utf8"));
for (const r of ref) {
  const t = QT.transmission(r.E, r.V0, r.a);
  const rel = Math.abs(t - r.T) / r.T;
  ok(`JS vs Python: ${r.name}`, rel < 1e-9, `T=${t.toPrecision(10)} rel.err=${rel.toExponential(2)}`);
  const s = QT.solveState(r.E, r.V0, r.a);
  ok(`  wave-solve |F|^2 = formula: ${r.name}`, Math.abs(s.T_num - t) < 1e-9, `|F|^2=${s.T_num.toPrecision(10)}`);
  ok(`  flux |B|^2+|F|^2 = 1: ${r.name}`, Math.abs(s.R_num + s.T_num - 1) < 1e-9,
     `err=${Math.abs(s.R_num + s.T_num - 1).toExponential(2)}`);
}

// boundary cases
ok("a -> 0 gives T -> 1", QT.transmission(8, 10, 1e-6) > 0.999999);
ok("a large gives T -> 0", QT.transmission(8, 10, 2.0) < 1e-12, `T=${QT.transmission(8, 10, 2.0).toExponential(3)}`);
const w = [0.05, 0.1, 0.2, 0.5].map((a) => QT.transmission(8, 10, a));
ok("T decreases monotonically with width", w.every((v, i) => i === 0 || w[i - 1] >= v));
const e0 = QT.transmission(10, 10, 0.1), em = QT.transmission(10 - 1e-6, 10, 0.1), ep = QT.transmission(10 + 1e-6, 10, 0.1);
ok("continuity across E = V0", Math.abs(e0 - em) < 1e-4 && Math.abs(e0 - ep) < 1e-4, `${em.toFixed(6)} ${e0.toFixed(6)} ${ep.toFixed(6)}`);
const q = QT.K_PER_SQRT_EV * Math.sqrt(2);
ok("above-barrier resonance q a = pi gives T = 1", Math.abs(QT.transmission(12, 10, Math.PI / q) - 1) < 1e-9);

// invalid input is reported, not silently replaced
let threw = false; try { QT.transmission(-1, 10, 0.1); } catch (e) { threw = true; }
ok("negative energy is rejected", threw);

console.log(fails ? `\n${fails} test(s) FAILED` : "\nAll tests passed.");
process.exit(fails ? 1 : 0);
