/* ============================================================
 * physics.js  --  Through the Barrier
 * One-dimensional finite rectangular barrier, stationary
 * scattering states (time-independent Schroedinger equation).
 *
 * Units: energies in eV, lengths in nm, wavenumbers in 1/nm.
 * Port of the validated Python prototype notebook.
 * Works in the browser (window.QT) and Node (module.exports).
 * ============================================================ */
(function (root) {
  "use strict";

  // CODATA constants (same values as the Python notebook)
  const HBAR = 1.054571817e-34;      // J s
  const M_E = 9.1093837015e-31;      // kg
  const EV_TO_J = 1.602176634e-19;   // J / eV
  const NM_TO_M = 1e-9;              // m / nm

  // k = sqrt(2 m E)/hbar  ->  K_PER_SQRT_EV * sqrt(E[eV])  in 1/nm
  const K_PER_SQRT_EV = Math.sqrt(2 * M_E * EV_TO_J) / HBAR * NM_TO_M;

  const EQ_TOL = 1e-9; // relative tolerance for the E = V0 branch

  // ---------- tiny complex arithmetic: z = [re, im] ----------
  const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const csub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const cabs2 = (a) => a[0] * a[0] + a[1] * a[1];
  const cdiv = (a, b) => {
    const d = cabs2(b);
    return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
  };
  const cexp = (z) => {
    const e = Math.exp(z[0]);
    return [e * Math.cos(z[1]), e * Math.sin(z[1])];
  };

  // Gaussian elimination with partial pivoting for a complex n x n system
  function csolve(M, b) {
    const n = b.length;
    const A = M.map((row, i) => row.map((v) => [v[0], v[1]]).concat([[b[i][0], b[i][1]]]));
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (cabs2(A[r][c]) > cabs2(A[p][c])) p = r;
      if (cabs2(A[p][c]) === 0) throw new Error("Singular scattering matrix");
      [A[c], A[p]] = [A[p], A[c]];
      for (let r = c + 1; r < n; r++) {
        const f = cdiv(A[r][c], A[c][c]);
        for (let j = c; j <= n; j++) A[r][j] = csub(A[r][j], cmul(f, A[c][j]));
      }
    }
    const x = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let s = A[i][n];
      for (let j = i + 1; j < n; j++) s = csub(s, cmul(A[i][j], x[j]));
      x[i] = cdiv(s, A[i][i]);
    }
    return x;
  }

  // ---------- input validation (reports, never silently fixes) ----------
  function validate(E, V0, a) {
    const errs = [];
    if (![E, V0, a].every(Number.isFinite)) errs.push("All inputs must be finite numbers.");
    else {
      if (!(E > 0)) errs.push("Particle energy E must be positive (E > 0 eV).");
      if (!(V0 > 0)) errs.push("Barrier height V0 must be positive (V0 > 0 eV).");
      if (!(a > 0)) errs.push("Barrier width a must be positive (a > 0 nm).");
    }
    return errs;
  }

  function regime(E, V0) {
    if (Math.abs(E - V0) <= EQ_TOL * Math.max(E, V0)) return "threshold";
    return E < V0 ? "tunneling" : "above";
  }

  // ---------- analytic transmission probability, Eqs. (5) and (7) ----------
  function transmission(E, V0, a) {
    const errs = validate(E, V0, a);
    if (errs.length) throw new Error(errs.join(" "));
    const reg = regime(E, V0);
    if (reg === "threshold") {
      // T = [1 + m V0 a^2 / (2 hbar^2)]^-1   (a in nm, V0 in eV)
      const g = (M_E * V0 * EV_TO_J * Math.pow(a * NM_TO_M, 2)) / (2 * HBAR * HBAR);
      return 1 / (1 + g);
    }
    if (reg === "tunneling") {
      const kappa = K_PER_SQRT_EV * Math.sqrt(V0 - E);
      const sh = Math.sinh(kappa * a);
      return 1 / (1 + (V0 * V0 * sh * sh) / (4 * E * (V0 - E)));
    }
    const q = K_PER_SQRT_EV * Math.sqrt(E - V0);
    const s = Math.sin(q * a);
    return 1 / (1 + (V0 * V0 * s * s) / (4 * E * (E - V0)));
  }

  const reflection = (E, V0, a) => 1 - transmission(E, V0, a);

  // ---------- full scattering state (independent of the T formula) ----------
  // Unit incident amplitude A = 1.
  //   x < 0   : e^{ikx} + B e^{-ikx}
  //   0..a    : C e^{gx} + D e^{-gx}   (g = s real, or g = iq);  C + D x at E = V0
  //   x > a   : F e^{ikx}
  function solveState(E, V0, a) {
    const errs = validate(E, V0, a);
    if (errs.length) throw new Error(errs.join(" "));
    const k = K_PER_SQRT_EV * Math.sqrt(E);
    const reg = regime(E, V0);
    const ik = [0, k];
    const eika = cexp([0, k * a]);
    const Z = [0, 0], ONE = [1, 0];
    let M, g = null;

    if (reg === "threshold") {
      M = [
        [ONE, [-1, 0], Z, Z],
        [[0, -k], Z, [-1, 0], Z],
        [Z, ONE, [a, 0], [-eika[0], -eika[1]]],
        [Z, Z, ONE, cmul([0, -k], eika)],
      ];
    } else {
      g = reg === "tunneling" ? [K_PER_SQRT_EV * Math.sqrt(V0 - E), 0]
                              : [0, K_PER_SQRT_EV * Math.sqrt(E - V0)];
      const ega = cexp([g[0] * a, g[1] * a]);
      const emga = cexp([-g[0] * a, -g[1] * a]);
      const neg = (z) => [-z[0], -z[1]];
      M = [
        [ONE, [-1, 0], [-1, 0], Z],
        [neg(ik), neg(g), g, Z],
        [Z, ega, emga, neg(eika)],
        [Z, cmul(g, ega), neg(cmul(g, emga)), neg(cmul(ik, eika))],
      ];
    }
    const rhs = [[-1, 0], [0, -k], Z, Z];
    const [B, C, D, F] = csolve(M, rhs);
    return { E, V0, a, k, regime: reg, g, B, C, D, F,
             R_num: cabs2(B), T_num: cabs2(F) };
  }

  // evaluate psi(x) for x in nm; returns {re:[], im:[]}
  function psi(state, xs) {
    const { k, a, g, B, C, D, F, regime: reg } = state;
    const re = new Float64Array(xs.length), im = new Float64Array(xs.length);
    for (let n = 0; n < xs.length; n++) {
      const x = xs[n];
      let v;
      if (x < 0) {
        v = cadd(cexp([0, k * x]), cmul(B, cexp([0, -k * x])));
      } else if (x <= a) {
        if (reg === "threshold") v = cadd(C, [D[0] * x, D[1] * x]);
        else v = cadd(cmul(C, cexp([g[0] * x, g[1] * x])), cmul(D, cexp([-g[0] * x, -g[1] * x])));
      } else {
        v = cmul(F, cexp([0, k * x]));
      }
      re[n] = v[0]; im[n] = v[1];
    }
    return { re, im };
  }

  const linspace = (a, b, n) => Array.from({ length: n }, (_, i) => a + (b * 1 - a) * i / (n - 1));

  root.QT = { HBAR, M_E, EV_TO_J, NM_TO_M, K_PER_SQRT_EV,
              validate, regime, transmission, reflection, solveState, psi, linspace };
  if (typeof module !== "undefined" && module.exports) module.exports = root.QT;
})(typeof window !== "undefined" ? window : globalThis);
