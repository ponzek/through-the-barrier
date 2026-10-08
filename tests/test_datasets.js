// Cross-check the supplied simulation datasets against physics.js (natural units, hbar = m = 1).
// Run:  node tests/test_datasets.js
const fs = require("fs");
const path = require("path");
const QT = require("../physics.js");
const CSV = require("../csv.js");

const D = path.join(__dirname, "..", "datasets");
const sum = CSV.parse(fs.readFileSync(path.join(D, "quantum_tunneling_summary.csv"), "utf8"));
const prof = CSV.parse(fs.readFileSync(path.join(D, "quantum_tunneling_wavefunction_profiles.csv"), "utf8"));
const K = QT.K_NATURAL;

let fails = 0;
const ok = (n, c, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}  ${d}`); if (!c) fails++; };

// ---- summary table: 1200 records ----
let worstT = 0, worstWhich = null, worstSum = 0, missing = 0;
for (const r of sum) {
  const E = +r.particle_energy, V = +r.barrier_height, a = +r.barrier_width, T = +r.transmission_probability;
  if (![E, V, a, T].every(Number.isFinite)) { missing++; continue; }
  const d = Math.abs(QT.transmission(E, V, a, K) - T);
  worstSum = Math.max(worstSum, Math.abs(T + +r.reflection_probability - 1));
  if (d > worstT) { worstT = d; worstWhich = r.sim_id; }
}
ok("summary: no missing / non-numeric values", missing === 0, `${sum.length} rows`);
ok("summary: T + R = 1 in the data", worstSum < 1e-5, `max err ${worstSum.toExponential(2)}`);
ok("summary: T matches model (tol 5e-5; data rounded)", worstT < 5e-5, `worst ${worstT.toExponential(2)} at ${worstWhich}`);

// ---- wavefunction profiles: 8 scenarios x 250 positions ----
const byName = {};
for (const r of prof) (byName[r.scenario_name] ||= []).push(r);
for (const [name, rows] of Object.entries(byName)) {
  const r0 = rows[0], E = +r0.particle_energy, V = +r0.barrier_height, a = +r0.barrier_width;
  const st = QT.solveState(E, V, a, K);
  const w = QT.psi(st, rows.map((r) => +r.position));
  let wd = 0, wa = 0;
  rows.forEach((r, i) => {
    wd = Math.max(wd, Math.abs(w.re[i] ** 2 + w.im[i] ** 2 - +r.probability_density));
    wa = Math.max(wa, Math.hypot(w.re[i] - +r.wavefunction_real, w.im[i] - +r.wavefunction_imag));
  });
  ok(`profile ${name}`, wd < 2e-3 && wa < 2e-3 && Math.abs(st.T_num - +r0.transmission_probability) < 5e-6,
     `max|Δ|ψ|²|=${wd.toExponential(1)} max|Δψ|=${wa.toExponential(1)} ΔT=${Math.abs(st.T_num - +r0.transmission_probability).toExponential(1)}`);
}
console.log(fails ? `\n${fails} FAILED` : "\nAll dataset checks passed.");
process.exit(fails ? 1 : 0);
