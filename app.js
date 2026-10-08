/* ============================================================
 * app.js -- Through the Barrier : six linked dynamic views
 * Depends on physics.js (window.QT) and Plotly.
 * ============================================================ */
(function () {
  "use strict";
  const QT = window.QT;
  const $ = (id) => document.getElementById(id);

  // Two data sources share every view:
  //  model : analytic electron model, eV / nm (Views 1-6 as originally designed)
  //  data  : dimensionless natural units (hbar = m = 1) with Quantum Gatekeeper records overlaid
  const MODES = {
    model: { key: "model", K: QT.K_PER_SQRT_EV, def: { E: 8, V0: 10, a: 0.1 },
      ranges: { E: [0.5, 15, 0.1], V0: [1, 20, 0.1], a: [0.02, 1, 0.01] },
      xr: (a) => [-1.5, a + 1.5],
      ax: { E: "Energy (eV)", x: "Position x (nm)", Eu: " eV", Lu: " nm", kappaU: " nm⁻¹",
        lbl: { E: "Particle energy <b>E</b> (eV)", V0: "Barrier height <b>V₀</b> (eV)", a: "Barrier width <b>a</b> (nm)" } } },
    data: { key: "data", K: QT.K_NATURAL, def: { E: 3.5, V0: 5, a: 1.5 },
      ranges: { E: [0.1, 10, 0.1], V0: [1, 10, 0.1], a: [0.1, 2.5, 0.05] },
      xr: () => [-4, 6],
      ax: { E: "Energy (dimensionless, ħ = m = 1)", x: "Position x (dimensionless)", Eu: "", Lu: "", kappaU: "",
        lbl: { E: "Particle energy <b>E</b> (dimensionless)", V0: "Barrier height <b>V₀</b> (dimensionless)", a: "Barrier width <b>a</b> (dimensionless)" } } },
  };
  let MODE = MODES.model;
  const P = { ...MODES.model.def };
  let DS = null;                       // Quantum Gatekeeper tables, loaded in the View 7 section
  const Tm = (E, V0, a) => QT.transmission(E, V0, a, MODE.K);
  const solve = (E, V0, a) => QT.solveState(E, V0, a, MODE.K);
  const near = (x, y) => Math.abs(x - y) < 1e-6;
  const dsRecord = (E = P.E, V0 = P.V0, a = P.a) => (DS && DS.sum.find((r) => near(r.E, E) && near(r.V0, V0) && near(r.a, a))) || null;
  const dsProfile = (E = P.E, V0 = P.V0, a = P.a) => (DS && DS.groups.find((g) => near(g.E, E) && near(g.V0, V0) && near(g.a, a))) || null;
  // dataset value for a state (data mode only): summary record first, else matching wavefunction-profile scenario
  function dsTruth(E, V0, a) {
    if (MODE.key !== "data") return null;
    const r = dsRecord(E, V0, a); if (r) return { T: r.T, R: r.R, label: r.id };
    const g = dsProfile(E, V0, a); if (g) return { T: g.T, R: 1 - g.T, label: "profile “" + g.name + "”" };
    return null;
  }
  const dsRe = (g, ph) => Array.from(g.re, (r, i) => r * Math.cos(ph) + g.im[i] * Math.sin(ph));
  const C = { cyan: "#2fb7ad", violet: "#a56ad9", amber: "#d99028", rose: "#e65d8f", blue: "#5f8ee8", dim: "#765b72", grid: "rgba(190,132,166,.20)" };
  const CFG = { responsive: true, displaylogo: false, modeBarButtonsToRemove: ["lasso2d", "select2d"] };
  const PRESETS_MODEL = [
    ["Thin barrier", 8, 10, 0.05],
    ["Default (proposal)", 8, 10, 0.10],
    ["Wide barrier", 8, 10, 0.50],
    ["High barrier", 8, 16, 0.10],
    ["Energy close to V₀", 9.8, 10, 0.10],
    ["Above barrier (E > V₀)", 12, 10, 0.10],
    ["Above barrier, resonance (T≈1)", 12, 10, +(Math.PI / (QT.K_PER_SQRT_EV * Math.sqrt(2))).toFixed(3)],
  ];
  const SCN_DEFAULTS = {
    model: { A: { name: "Default (proposal)", E: 8, V0: 10, a: 0.10 }, B: { name: "Wide barrier", E: 8, V0: 10, a: 0.50 } },
    data: { A: { name: "Moderate tunneling", E: 3.5, V0: 5, a: 1.5 }, B: { name: "Thick barrier", E: 3.5, V0: 5, a: 2.0 } },
  };
  let A = { ...SCN_DEFAULTS.model.A };
  let B = { ...SCN_DEFAULTS.model.B };
  let phase = 0, playing = false, lastT = 0, mode5 = "2d";
  const cache = { cur: null, A: null, B: null, prof: null };

  // ---------- helpers ----------
  const fmtT = (t) => (t < 1e-3 ? t.toExponential(3) : t.toFixed(6));
  const fmt = (v, d = 2) => Number(v).toFixed(d);
  const log10T = (t) => Math.log10(Math.max(t, 1e-300));
  const sup = (n) => String(n).replace(/-/g, "⁻").replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d]);
  const baseLayout = (extra = {}) => {
    const L = Object.assign({
      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(255,255,255,.62)",
      font: { family: "Inter, sans-serif", color: "#352133", size: 12 },
      margin: { l: 62, r: 20, t: 40, b: 52 },
      xaxis: { gridcolor: C.grid, zerolinecolor: C.grid }, yaxis: { gridcolor: C.grid, zerolinecolor: C.grid },
      legend: { orientation: "h", y: 1.0, yanchor: "bottom", x: 0 },
      hoverlabel: { bgcolor: "#fff7fb", bordercolor: C.rose, font: { color: "#352133" } },
    }, extra);
    // title sits at the very top of the container; legend sits just above the plot area (no overlap)
    if (L.title) L.title = Object.assign({ y: 0.97, yanchor: "top", yref: "container", x: 0.02, xanchor: "left" }, L.title);
    L.margin = Object.assign({}, L.margin, { t: Math.max(L.margin.t, 70) });
    return L;
  };
  const xGrid = (a, n = 1400) => { const [x0, x1] = MODE.xr(a); return QT.linspace(x0, x1, n); };

  // ---------- parameter wiring (3 sliders + validated number boxes) ----------
  const KEYS = ["E", "V0", "a"];
  function setParams(p) {
    KEYS.forEach((k) => { P[k] = p[k]; syncInputs(k); });
    update();
  }
  function syncInputs(k) {
    $(k + "-range").value = P[k];
    $(k + "-num").value = +Number(P[k]).toPrecision(6);
    $(k + "-num").classList.remove("invalid");
  }
  KEYS.forEach((k) => {
    $(k + "-range").addEventListener("input", (e) => { P[k] = parseFloat(e.target.value); syncInputs(k); update(); });
    $(k + "-num").addEventListener("input", (e) => {
      const v = parseFloat(e.target.value);
      P[k] = v;
      const bad = !(v > 0) || !Number.isFinite(v);
      e.target.classList.toggle("invalid", bad);
      if (!bad) $(k + "-range").value = v;
      update();
    });
  });
  $("reset-btn").addEventListener("click", () => { setParams(MODE.def); });

  // ---------- master update ----------
  function update() {
    const errs = QT.validate(P.E, P.V0, P.a);
    const box = $("error-box");
    if (errs.length) {
      box.hidden = false;
      box.textContent = "Invalid state, not plotted: " + errs.join(" ");
      return;
    }
    box.hidden = true;
    const st = solve(P.E, P.V0, P.a);
    const xs = xGrid(P.a);
    cache.cur = { st, xs, w: QT.psi(st, xs) };
    cache.prof = MODE.key === "data" ? dsProfile() : null;
    renderPill(st); renderMatch();
    view1(st); view2(st); view3(st); view4(st); view5(st); view6();
  }

  function renderPill(st) {
    const p = $("regime-pill");
    p.className = "pill " + st.regime;
    p.textContent = { tunneling: "Tunneling · E < V₀", above: "Above barrier · E > V₀", threshold: "Threshold · E = V₀" }[st.regime];
  }

  // ---------- data-source switch (analytic model <-> Quantum Gatekeeper dataset) ----------
  function renderMatch() {
    if (MODE.key !== "data") return;
    const ds = dsTruth(P.E, P.V0, P.a), el = $("data-match");
    el.className = "pill " + (ds ? "tunneling" : "threshold");
    el.textContent = ds ? "✓ matches dataset " + ds.label + " · T = " + fmtT(ds.T) : "No dataset record at this exact state — model only";
    $("snap-btn").hidden = !!ds;
  }
  function setMode(key) {
    if (key === "data" && !DS) return;
    setPlaying(false);
    MODE = MODES[key];
    KEYS.forEach((k) => {
      const [mn, mx, st] = MODE.ranges[k], r = $(k + "-range");
      r.min = mn; r.max = mx; r.step = st; $(k + "-num").step = st; $(k + "-lbl").innerHTML = MODE.ax.lbl[k];
    });
    $("src-model").classList.toggle("active", key === "model");
    $("src-data").classList.toggle("active", key === "data");
    $("data-row").hidden = key !== "data";
    A = { ...SCN_DEFAULTS[key].A }; B = { ...SCN_DEFAULTS[key].B };
    fillPresets();
    setParams(MODE.def);
  }
  $("src-model").addEventListener("click", () => setMode("model"));
  $("src-data").addEventListener("click", () => setMode("data"));
  $("snap-btn").addEventListener("click", () => {
    const nearest = (arr, v) => arr.reduce((b, x) => (Math.abs(x - v) < Math.abs(b - v) ? x : b));
    setParams({ E: Math.min(10, Math.max(0.1, Math.round(P.E * 10) / 10)), V0: nearest(DS.V0s, P.V0), a: nearest(DS.as, P.a) });
  });

  // ======================= VIEW 1 =======================
  function view1(st) {
    const { E, V0, a } = P;
    const top = Math.max(E, V0) * 1.3;
    const x0 = -1, x1 = a + 1;
    const traces = [
      { x: [x0, 0, 0, a, a, x1], y: [0, 0, V0, V0, 0, 0], mode: "lines", name: "Potential energy V(x)",
        line: { color: C.violet, width: 3 }, fill: "tozeroy", fillcolor: "rgba(167,139,250,.28)",
        hovertemplate: "x = %{x:.3f}" + MODE.ax.Lu + "<br>V = %{y:.2f}" + MODE.ax.Eu + "<extra></extra>" },
      { x: [x0, x1], y: [E, E], mode: "lines", name: "Particle energy E", line: { color: C.amber, width: 2.5, dash: "dash" },
        hovertemplate: "E = " + fmt(E) + MODE.ax.Eu + "<extra></extra>" },
    ];
    const forbidden = E < V0;
    const ann = [];
    const ay = Math.min(E, top) ;
    ann.push({ x: -0.15, y: ay, ax: -0.85, ay: 0, xref: "x", yref: "y", axref: "x", ayref: "pixel", showarrow: true,
      arrowhead: 3, arrowcolor: C.cyan, arrowwidth: 3, text: "particle", font: { color: C.cyan }, xanchor: "right" });
    if (E > V0) ann.push({ x: a + 0.85, y: ay, ax: a + 0.12, ayref: "pixel", ay: 0, xref: "x", yref: "y", axref: "x", showarrow: true,
      arrowhead: 3, arrowcolor: C.cyan, arrowwidth: 3, text: "classically passes", font: { color: C.cyan }, yshift: 16 });
    else if (E < V0) ann.push({ x: -0.85, y: ay, ax: -0.18, ay: 0, ayref: "pixel", xref: "x", yref: "y", axref: "x", showarrow: true,
      arrowhead: 3, arrowcolor: C.rose, arrowwidth: 3, text: "classically reflected", font: { color: C.rose }, yshift: 20 });
    if (forbidden) ann.push({ x: a / 2, y: V0 + top * 0.04, text: "classically forbidden", showarrow: false, font: { color: C.rose, size: 11 }, xanchor: "center" });
    Plotly.react("plot1", traces, baseLayout({
      title: { text: "Potential energy and particle energy (not a physical wall)", font: { size: 14 } },
      xaxis: { title: MODE.ax.x, gridcolor: C.grid, range: [x0, x1] },
      yaxis: { title: MODE.ax.E, gridcolor: C.grid, range: [0, top] }, annotations: ann,
      shapes: forbidden ? [{ type: "rect", x0: 0, x1: a, y0: E, y1: V0, fillcolor: "rgba(251,113,133,.35)", line: { width: 0 } }] : [],
    }), CFG);

    const v = $("classical-verdict");
    if (st.regime === "tunneling") {
      v.className = "verdict reflect";
      v.innerHTML = "Classical prediction: <b>complete reflection</b><small>E &lt; V₀ — not enough energy to enter the barrier region.</small>";
    } else if (st.regime === "above") {
      v.className = "verdict pass";
      v.innerHTML = "Classical prediction: <b>passes through</b><small>E &gt; V₀. Quantum theory will still allow some reflection (views 2–4).</small>";
    } else {
      v.className = "verdict edge";
      v.innerHTML = "Classical threshold: <b>E = V₀</b><small>Borderline case; classical mechanics gives no sharp verdict. Quantum T is finite (Eq. 7).</small>";
    }
    $("v1-classical-T").textContent = st.regime === "tunneling" ? "0" : st.regime === "above" ? "1" : "edge";
    $("v1-quantum-T").textContent = st.T_num < 1e-3 ? st.T_num.toExponential(2) : st.T_num.toFixed(4);
  }

  // ======================= VIEW 2 =======================
  const reAt = (w, ph) => { const cp = Math.cos(ph), sp = Math.sin(ph); const y = new Float64Array(w.re.length); for (let i = 0; i < y.length; i++) y[i] = w.re[i] * cp + w.im[i] * sp; return y; };
  const env = (w) => { const m = new Float64Array(w.re.length); for (let i = 0; i < m.length; i++) m[i] = Math.hypot(w.re[i], w.im[i]); return m; };
  const neg = (arr) => Array.from(arr, (v) => -v);

  function view2(st) {
    const { xs, w } = cache.cur;
    const m = env(w);
    const ymax = Math.max(...m) * 1.2 + 0.1;
    const reg = st.regime;
    const midLabel = reg === "tunneling" ? "evanescent" : reg === "above" ? "oscillatory" : "threshold";
    Plotly.react("plot2", [
      { x: xs, y: Array.from(m), mode: "lines", line: { width: 0 }, hoverinfo: "skip", showlegend: false },
      { x: xs, y: neg(m), mode: "lines", line: { width: 0 }, fill: "tonexty", fillcolor: "rgba(96,165,250,.16)", name: "Envelope ±|ψ|", hoverinfo: "skip" },
      { x: xs, y: Array.from(reAt(w, phase)), mode: "lines", line: { color: C.cyan, width: 2.6 }, name: "Re[ψ(x) e^(−iφ)]",
        hovertemplate: "x = %{x:.3f}" + MODE.ax.Lu + "<br>Re ψ = %{y:.4f}<extra></extra>" },
      ...(cache.prof ? [{ x: cache.prof.x, y: dsRe(cache.prof, phase), mode: "markers", name: "dataset (Quantum Gatekeeper)", marker: { size: 4.5, color: "#9e3b6f", opacity: 0.85 },
        hovertemplate: "dataset<br>x = %{x:.3f}<br>Re ψ = %{y:.4f}<extra></extra>" }] : []),
    ], baseLayout({
      title: { text: "Stationary scattering state (incident amplitude = 1)", font: { size: 14 } },
      xaxis: { title: MODE.ax.x, gridcolor: C.grid }, yaxis: { title: "Relative wavefunction amplitude (arb.)", gridcolor: C.grid, range: [-ymax, ymax] },
      shapes: [{ type: "rect", x0: 0, x1: P.a, y0: -ymax, y1: ymax, fillcolor: "rgba(167,139,250,.2)", line: { color: C.violet, width: 1 } }],
      annotations: [
        { x: xs[0] / 2, y: ymax * 0.93, text: "incident + reflected", showarrow: false, font: { color: C.blue } },
        { x: P.a / 2, y: -ymax * 0.93, text: midLabel, showarrow: false, font: { color: C.violet, size: 11 } },
        { x: (P.a + xs[xs.length - 1]) / 2, y: ymax * 0.93, text: "transmitted", showarrow: false, font: { color: C.amber } },
      ],
    }), CFG);

    const kap = st.g ? st.g[0] : 0, q = st.g ? st.g[1] : 0;
    const rows = [
      [C.blue, "<b>x &lt; 0</b> — incident + reflected waves interfere. Reflected share R = " + fmt(st.R_num, 4)],
      [C.violet, reg === "tunneling" ? "<b>0 ≤ x ≤ a</b> — <b>evanescent</b>: ψ decays like e<sup>−κx</sup>, κ = " + fmt(kap, 2) + MODE.ax.kappaU + " (decay length 1/κ = " + fmt(1 / kap, 3) + MODE.ax.Lu + "). κa = " + fmt(kap * P.a, 3)
        : reg === "above" ? "<b>0 ≤ x ≤ a</b> — <b>oscillatory</b>: wavelength 2π/q = " + fmt(2 * Math.PI / q, 3) + MODE.ax.Lu + " inside the barrier."
        : "<b>0 ≤ x ≤ a</b> — <b>threshold</b>: ψ is linear in x (ψ = C + Dx)."],
      [C.amber, "<b>x &gt; a</b> — transmitted wave with constant amplitude |F| = " + fmt(Math.sqrt(st.T_num), 4) + " (T = " + fmtT(st.T_num) + ")."],
    ];
    $("region-card").innerHTML = rows.map(([c, t]) => `<div class="region-row"><span class="dot" style="background:${c}"></span><span>${t}</span></div>`).join("");
  }

  function animateFrame() {
    if (!cache.cur) return;
    const ys = [Array.from(reAt(cache.cur.w, phase))], idx = [2];
    if (cache.prof) { ys.push(dsRe(cache.prof, phase)); idx.push(3); }   // dataset dots follow the same phase
    Plotly.restyle("plot2", { y: ys }, idx);
    if (cache.A && cache.B) Plotly.restyle("plot6a", { y: [Array.from(reAt(cache.A.w, phase)), Array.from(reAt(cache.B.w, phase))] }, [2, 5]);
    $("phase-readout").textContent = "φ = " + fmt((((phase % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / Math.PI, 2) + " π";
  }
  function loop(ts) {
    if (!playing) return;
    const dt = Math.min(0.05, (ts - lastT) / 1000 || 0);
    lastT = ts;
    phase += dt * parseFloat($("speed-range").value) * (2 * Math.PI) / 4;
    animateFrame();
    requestAnimationFrame(loop);
  }
  function setPlaying(on) {
    playing = on;
    $("play-btn").textContent = on ? "⏸ Pause" : "▶ Play";
    if (on) { lastT = performance.now(); requestAnimationFrame(loop); }
  }
  $("play-btn").addEventListener("click", () => setPlaying(!playing));
  $("step-btn").addEventListener("click", () => { setPlaying(false); phase += Math.PI / 8; animateFrame(); });
  $("phase-reset-btn").addEventListener("click", () => { setPlaying(false); phase = 0; animateFrame(); });

  // ======================= VIEW 3 =======================
  function view3(st) {
    const { xs, w } = cache.cur;
    const dens = Array.from(w.re, (r, i) => r * r + w.im[i] * w.im[i]);
    const sR = Math.sqrt(st.R_num);
    const hi = (1 + sR) ** 2, lo = (1 - sR) ** 2;
    const ymax = Math.max(...dens) * 1.2 + 0.05;
    const x0 = xs[0], x1 = xs[xs.length - 1];
    Plotly.react("plot3", [
      { x: xs, y: dens, mode: "lines", name: "|ψ(x)|²", line: { color: C.cyan, width: 2.6 }, fill: "tozeroy", fillcolor: "rgba(94,234,212,.16)",
        hovertemplate: "x = %{x:.3f}" + MODE.ax.Lu + "<br>relative |ψ|² = %{y:.5f}<extra></extra>" },
      ...(cache.prof ? [{ x: cache.prof.x, y: cache.prof.dens, mode: "markers", name: "dataset (Quantum Gatekeeper)", marker: { size: 4.5, color: "#9e3b6f", opacity: 0.85 },
        hovertemplate: "dataset<br>x = %{x:.3f}<br>|ψ|² = %{y:.5f}<extra></extra>" }] : []),
    ], baseLayout({
      title: { text: "Relative probability density |ψ(x)|² (arbitrary units)", font: { size: 14 } },
      xaxis: { title: MODE.ax.x, gridcolor: C.grid }, yaxis: { title: "Relative |ψ(x)|² (arb.)", gridcolor: C.grid, range: [0, ymax] },
      shapes: [
        { type: "rect", x0: 0, x1: P.a, y0: 0, y1: ymax, fillcolor: "rgba(167,139,250,.2)", line: { color: C.violet, width: 1 } },
        { type: "line", x0: P.a, x1: x1, y0: st.T_num, y1: st.T_num, line: { color: C.amber, width: 1.5, dash: "dot" } },
        { type: "line", x0: x0, x1: 0, y0: hi, y1: hi, line: { color: C.rose, width: 1, dash: "dot" } },
        { type: "line", x0: x0, x1: 0, y0: lo, y1: lo, line: { color: C.rose, width: 1, dash: "dot" } },
      ],
      annotations: [
        { x: x1 - 0.1, y: st.T_num, text: "T", xanchor: "right", yanchor: "bottom", showarrow: false, font: { color: C.amber } },
        { x: x0 + 0.05, y: hi, text: "(1+√R)²", xanchor: "left", yanchor: "bottom", showarrow: false, font: { color: C.rose, size: 11 } },
        { x: x0 + 0.05, y: lo, text: "(1−√R)²", xanchor: "left", yanchor: "top", showarrow: false, font: { color: C.rose, size: 11 } },
      ],
    }), CFG);

    const d0 = QT.psi(st, [0]), da = QT.psi(st, [P.a]);
    const s = (l, v) => `<div class="stat"><span>${l}</span><b>${v}</b></div>`;
    $("v3-stats").innerHTML =
      s("|ψ(0)|² at left edge", fmt(d0.re[0] ** 2 + d0.im[0] ** 2, 4)) +
      s("|ψ(a)|² at right edge", fmt(da.re[0] ** 2 + da.im[0] ** 2, 4)) +
      s("Transmitted level (= T)", fmtT(st.T_num)) +
      s("Left ripple range", fmt(lo, 3) + " – " + fmt(hi, 3)) +
      (cache.prof ? (() => { const wp = QT.psi(st, cache.prof.x); let d = 0; cache.prof.dens.forEach((v, i) => { d = Math.max(d, Math.abs(wp.re[i] ** 2 + wp.im[i] ** 2 - v)); }); return s("Dataset profile ✓ max |Δ|ψ|²|", d.toExponential(1)); })() : "");
  }

  // ======================= VIEW 4 =======================
  function view4(st) {
    const Tf = Tm(P.E, P.V0, P.a), Rf = 1 - Tf, ds = dsTruth(P.E, P.V0, P.a);
    const reflectedPct = (100 * Rf).toFixed(1) + "%";
    const transmittedPct = (100 * Tf).toFixed(1) + "%";
    const outOf = (x) => Math.round(100 * x);
    $("v4-simple").innerHTML = `
      <p class="result-title">Main answer: <strong>${outOf(Tf)} out of 100</strong> simulated particles pass through this barrier.</p>
      <div class="result-split">
        <div class="result-metric reflect"><span>Reflect from barrier</span><b>${reflectedPct}</b><p>Reflection R</p></div>
        <div class="result-metric transmit"><span>Pass through barrier</span><b>${transmittedPct}</b><p>Transmission T</p></div>
      </div>
      <div class="result-bar" aria-label="${reflectedPct} reflected and ${transmittedPct} transmitted">
        <span class="reflect" style="width:${Math.max(2, 100 * Rf)}%">${reflectedPct}</span>
        <span class="transmit" style="width:${Math.max(2, 100 * Tf)}%">${transmittedPct}</span>
      </div>
      <p class="result-caption">This is a local simulation result. No data is sent back to Quantum Gatekeeper or anywhere else.</p>`;
    const sum = Rf + Tf, err = Math.abs(st.R_num + st.T_num - 1), diff = Math.abs(st.T_num - Tf);
    const s = (l, v, cls = "") => `<div class="stat ${cls}"><span>${l}</span><b>${cls === "good" ? "✓ " : cls === "bad" ? "✗ " : ""}${v}</b></div>`;
    let extra = "";
    if (ds) { const d = Math.abs(ds.T - Tf); extra = s("Saved dataset record (" + ds.label + ")", "T = " + fmtT(ds.T)) + s("|T dataset − T model|", d.toExponential(1), d < 5e-5 ? "good" : "bad"); }
    else if (MODE.key === "data") extra = s("Dataset record", "none at this state (model only)");
    $("v4-stats").innerHTML =
      s("Reflected by barrier", reflectedPct + " (R = " + fmt(Rf, 6) + ")") +
      s("Passed through barrier", transmittedPct + " (T = " + fmtT(Tf) + ")") +
      s("Check: R + T", sum.toFixed(6), Math.abs(sum - 1) < 1e-10 ? "good" : "bad") +
      s("Formula vs. wavefunction", diff < 1e-9 && err < 1e-9 ? "matches" : "does not match", diff < 1e-9 && err < 1e-9 ? "good" : "bad") +
      s("Energy of transmitted particle", fmt(P.E, 2) + MODE.ax.Eu + " (unchanged)") + extra;
  }

  // ======================= VIEW 5 =======================
  const grid5 = () => {
    const dense = mode5 === "2d";
    return MODE.key === "model"
      ? { W: QT.linspace(0.02, 1.0, dense ? 80 : 46), H: QT.linspace(1, 20, dense ? 77 : 44) }
      : { W: QT.linspace(0.1, 2.5, dense ? 70 : 42), H: QT.linspace(1, 10, dense ? 60 : 36) };
  };
  const TICKV = [-16, -12, -8, -4, -2, -1, 0], TICKT = TICKV.map((v) => "10" + sup(v));
  const snapTo = (v, step) => +(Math.round(v / step) * step).toFixed(6);
  function view5(st) {
    const { W: W5, H: H5 } = grid5();
    const z = [], tt = [];
    for (const V0 of H5) {
      const zr = [], tr = [];
      for (const a of W5) { const T = Tm(P.E, V0, a); tr.push(T); zr.push(Math.max(log10T(T), -16)); }
      z.push(zr); tt.push(tr);
    }
    const cb = { title: { text: "log₁₀(T)", side: "top" }, tickvals: TICKV, ticktext: TICKT, len: 0.9 };
    const here = log10T(st.T_num), U = MODE.ax;
    const recs = MODE.key === "data" && DS ? DS.sum.filter((r) => near(r.E, P.E)) : [];
    const recMarker = (size, sym) => ({ symbol: sym, size, color: recs.map((r) => Math.max(log10T(r.T), -16)), colorscale: "RdPu", cmin: -16, cmax: 0, line: { color: "#fff", width: 2 } });
    const recText = recs.map((r) => `${r.id}<br>T = ${r.T}<br>R = ${r.R}<br>regime: ${r.regime}`);
    let data, layout, overlayIdx;
    if (mode5 === "2d") {
      data = [
        { type: "heatmap", x: W5, y: H5, z, customdata: tt, colorscale: "RdPu", zmin: -16, zmax: 0, colorbar: cb,
          hovertemplate: "width a = %{x:.3f}" + U.Lu + "<br>height V₀ = %{y:.2f}" + U.Eu + "<br>T = %{customdata:.3e}<br>log₁₀T = %{z:.2f}<extra>model</extra>" },
        { type: "scatter", mode: "markers", x: [P.a], y: [P.V0], name: "Current state", marker: { size: 15, color: "#fff", line: { color: "#9e3b6f", width: 2 }, symbol: "circle-open-dot" },
          hovertemplate: "Current: a = " + fmt(P.a, 2) + U.Lu + ", V₀ = " + fmt(P.V0, 1) + U.Eu + "<br>T = " + fmtT(st.T_num) + "<extra></extra>" },
        { type: "scatter", mode: "lines", x: [W5[0], W5[W5.length - 1]], y: [P.E, P.E], name: "V₀ = E (threshold)", line: { color: C.amber, dash: "dash", width: 2 }, hoverinfo: "skip" },
      ];
      if (recs.length) { overlayIdx = 3; data.push({ type: "scatter", mode: "markers", x: recs.map((r) => r.a), y: recs.map((r) => r.V0), name: "Dataset records (E = " + fmt(P.E, 1) + ")", marker: recMarker(16, "square"),
        text: recText, hovertemplate: "%{text}<br>a = %{x}, V₀ = %{y}<extra>dataset</extra>" }); }
      layout = baseLayout({
        title: { text: "Transmission over barrier width × height (E = " + fmt(P.E, 1) + U.Eu + ") · log color scale", font: { size: 14 } },
        xaxis: { title: "Barrier width a" + (MODE.key === "model" ? " (nm)" : " (dimensionless)"), gridcolor: C.grid },
        yaxis: { title: "Barrier height V₀" + (MODE.key === "model" ? " (eV)" : " (dimensionless)"), gridcolor: C.grid },
      });
    } else {
      data = [
        { type: "surface", x: W5, y: H5, z, customdata: tt, colorscale: "RdPu", cmin: -16, cmax: 0, colorbar: cb,
          hovertemplate: "a = %{x:.3f}" + U.Lu + "<br>V₀ = %{y:.2f}" + U.Eu + "<br>log₁₀T = %{z:.2f}<extra>model</extra>" },
        { type: "scatter3d", mode: "markers", x: [P.a], y: [P.V0], z: [Math.max(here, -16) + 0.5], name: "Current state",
          marker: { size: 6, color: "#fff", line: { color: "#9e3b6f", width: 3 } }, hoverinfo: "name" },
      ];
      // markers are lifted 0.5 log-units above the surface so the surface cannot hide them; hover shows the true values
      if (recs.length) { overlayIdx = 2; data.push({ type: "scatter3d", mode: "markers", x: recs.map((r) => r.a), y: recs.map((r) => r.V0), z: recs.map((r) => Math.max(log10T(r.T), -16) + 0.5), name: "Dataset records",
        marker: { symbol: "diamond", size: 6, color: recs.map((r) => Math.max(log10T(r.T), -16)), colorscale: "RdPu", cmin: -16, cmax: 0, line: { color: "#fff", width: 3 } }, text: recText, hovertemplate: "%{text}<extra>dataset</extra>" }); }
      layout = baseLayout({
        margin: { l: 0, r: 0, t: 40, b: 0 },
        title: { text: "3D surface of log₁₀(T) (E = " + fmt(P.E, 1) + U.Eu + ")", font: { size: 14 } },
        scene: { xaxis: { title: "Barrier width a" + (MODE.key === "model" ? " (nm)" : "") }, yaxis: { title: "Barrier height V₀" + (MODE.key === "model" ? " (eV)" : "") },
          zaxis: { title: "T (log scale)", range: [-16, 1], tickvals: TICKV, ticktext: TICKT },
          aspectmode: "manual", aspectratio: { x: 1.3, y: 1.3, z: 0.8 }, camera: { eye: { x: 1.9, y: -1.7, z: 0.95 }, center: { x: 0, y: 0, z: -0.1 } },
          bgcolor: "rgba(255,247,251,.72)" },
      });
    }
    $("v5-click-help").textContent = mode5 === "2d"
      ? "Click the 2D map or a dataset square to load that state"
      : "3D is for visual inspection; switch to 2D to click/load dataset squares";
    Plotly.react("plot5", data, layout, CFG);
    const gd = $("plot5");
    gd.removeAllListeners && gd.removeAllListeners("plotly_click");
    if (mode5 === "2d") {
      gd.on("plotly_click", (ev) => {
        const pt = ev.points && ev.points[0]; if (!pt) return;
        if (pt.curveNumber === overlayIdx) { setParams({ E: P.E, V0: pt.y, a: pt.x }); return; }   // exact dataset record
        if (pt.curveNumber !== 0) return;
        setParams({ E: P.E, V0: snapTo(pt.y, MODE.ranges.V0[2]), a: snapTo(pt.x, MODE.ranges.a[2]) });
      });
    }
    const s = (l, v) => `<div class="stat"><span>${l}</span><b>${v}</b></div>`;
    const dec = Tm(P.E, P.V0, P.a * 2), ds = dsTruth(P.E, P.V0, P.a);
    $("v5-stats").innerHTML =
      s("Marker: a, V₀", fmt(P.a, 2) + U.Lu + ", " + fmt(P.V0, 1) + U.Eu) +
      s("T at marker (model)", fmtT(st.T_num)) + s("log₁₀(T) at marker", fmt(here, 3)) +
      (ds ? s("T at marker (dataset)", fmtT(ds.T)) : "") +
      s("T if width doubled", fmtT(dec)) +
      s("Ratio T(2a)/T(a)", fmt(dec / st.T_num, 4)) +
      (recs.length ? s("Dataset squares on map", recs.length + " (click one to load it)") : "");
  }
  $("seg-2d").addEventListener("click", () => { mode5 = "2d"; $("seg-2d").classList.add("active"); $("seg-3d").classList.remove("active"); if (cache.cur) view5(cache.cur.st); });
  $("seg-3d").addEventListener("click", () => { mode5 = "2d"; $("seg-2d").classList.add("active"); $("seg-3d").classList.remove("active"); if (cache.cur) view5(cache.cur.st); });

  // ======================= VIEW 6 =======================
  const sel = $("preset-select");
  const presets = () => (MODE.key === "model" ? PRESETS_MODEL
    : DS ? DS.groups.map((g) => [g.name, g.E, g.V0, g.a]).concat([["Thin barrier (a = 0.5)", 3, 5, 0.5], ["Near threshold (E = 4.9)", 4.9, 5, 1.5]]) : []);
  function fillPresets() {
    sel.innerHTML = "";
    presets().forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p[0]; sel.appendChild(o); });
  }
  fillPresets();
  const mk = (s) => ({ name: s.name, E: s.E, V0: s.V0, a: s.a });
  $("save-a").addEventListener("click", () => { A = { name: "Saved A", ...P }; view6(); });
  $("save-b").addEventListener("click", () => { B = { name: "Saved B", ...P }; view6(); });
  $("apply-a").addEventListener("click", () => setParams(A));
  $("apply-b").addEventListener("click", () => setParams(B));
  $("preset-a").addEventListener("click", () => { const p = presets()[sel.value]; A = { name: p[0], E: p[1], V0: p[2], a: p[3] }; view6(); });
  $("preset-b").addEventListener("click", () => { const p = presets()[sel.value]; B = { name: p[0], E: p[1], V0: p[2], a: p[3] }; view6(); });
  $("log-T").addEventListener("change", view6);

  function scnState(s) {
    const st = solve(s.E, s.V0, s.a);
    const xs = xGrid(s.a, 900);
    return { st, xs, w: QT.psi(st, xs) };
  }

  function view6() {
    cache.A = scnState(A); cache.B = scnState(B);
    const rowOf = (c, name, color, xa, ya) => {
      const m = env(c.w);
      return [
        { x: c.xs, y: Array.from(m), mode: "lines", line: { width: 0 }, hoverinfo: "skip", showlegend: false, xaxis: xa, yaxis: ya },
        { x: c.xs, y: neg(m), mode: "lines", line: { width: 0 }, fill: "tonexty", fillcolor: color + "33", hoverinfo: "skip", showlegend: false, xaxis: xa, yaxis: ya },
        { x: c.xs, y: Array.from(reAt(c.w, phase)), mode: "lines", line: { color, width: 2.2 }, name: name, showlegend: false, xaxis: xa, yaxis: ya,
          hovertemplate: name + "<br>x = %{x:.3f}" + MODE.ax.Lu + "<br>Re ψ = %{y:.4f}<extra></extra>" },
      ];
    };
    const ym = Math.max(...env(cache.A.w), ...env(cache.B.w)) * 1.15 + 0.1;
    const shape = (s, xr, yr, c) => ({ type: "rect", xref: xr, yref: yr, x0: 0, x1: s.a, y0: -ym, y1: ym, fillcolor: c + "30", line: { width: 0 } });
    const desc = (s) => `${s.name}: E=${fmt(s.E, 1)}, V₀=${fmt(s.V0, 1)}, a=${fmt(s.a, 2)}`;
    Plotly.react("plot6a", [...rowOf(cache.A, "A", C.cyan, "x2", "y2"), ...rowOf(cache.B, "B", C.amber, "x", "y")],
      baseLayout({
        margin: { l: 62, r: 14, t: 34, b: 44 },
        title: { text: "Synchronized wave plots (shared phase φ from View 2)", font: { size: 14 } },
        xaxis: { domain: [0, 1], anchor: "y", title: MODE.ax.x, gridcolor: C.grid }, yaxis: { domain: [0, 0.45], range: [-ym, ym], title: "Re ψ (B)", gridcolor: C.grid },
        xaxis2: { domain: [0, 1], anchor: "y2", gridcolor: C.grid }, yaxis2: { domain: [0.55, 1], range: [-ym, ym], title: "Re ψ (A)", gridcolor: C.grid },
        shapes: [shape(B, "x", "y", C.amber), shape(A, "x2", "y2", C.cyan)],
        annotations: [
          { xref: "paper", yref: "paper", x: 0, y: 1.0, text: desc(A), showarrow: false, xanchor: "left", yanchor: "bottom", font: { color: C.cyan, size: 11 } },
          { xref: "paper", yref: "paper", x: 0, y: 0.47, text: desc(B), showarrow: false, xanchor: "left", yanchor: "bottom", font: { color: C.amber, size: 11 } },
        ],
      }), CFG);
    // plot6a traces: A = 0..2, B = 3..5 (animateFrame restyles traces 2 and 5)

    const logT = $("log-T").checked;
    const Ta = cache.A.st.T_num, Tb = cache.B.st.T_num;
    const aWins = Ta >= Tb;
    const ratio = aWins ? Ta / Math.max(Tb, 1e-300) : Tb / Math.max(Ta, 1e-300);
    $("scenario-summary").innerHTML = `
      <div class="scenario-card a ${aWins ? "scenario-winner" : ""}">
        <h3>Scenario A</h3>
        <div class="big">${fmtT(Ta)}</div>
        <p>${A.name}<br>About ${(100 * Ta).toFixed(2)} out of 100 get through.</p>
      </div>
      <div class="scenario-card b ${!aWins ? "scenario-winner" : ""}">
        <h3>Scenario B</h3>
        <div class="big">${fmtT(Tb)}</div>
        <p>${B.name}<br>About ${(100 * Tb).toFixed(2)} out of 100 get through.</p>
      </div>
      <div class="scenario-card scenario-winner">
        <h3>Plain answer</h3>
        <div class="big">${aWins ? "A" : "B"} lets more through</div>
        <p>${aWins ? "A" : "B"} has about ${fmt(ratio, 2)} times more transmission than ${aWins ? "B" : "A"}.</p>
      </div>`;
    Plotly.react("plot6b", [
      { type: "bar", x: ["Transmission T", "Reflection R"], y: [Ta, 1 - Ta], name: "Scenario A", marker: { color: C.cyan }, hovertemplate: "A %{x} = %{y:.6g}<extra></extra>" },
      { type: "bar", x: ["Transmission T", "Reflection R"], y: [Tb, 1 - Tb], name: "Scenario B", marker: { color: C.amber }, hovertemplate: "B %{x} = %{y:.6g}<extra></extra>" },
      // dataset values (hatched) appear next to the model bars when the scenario matches a Quantum Gatekeeper record
      ...[["A", dsTruth(A.E, A.V0, A.a), C.cyan], ["B", dsTruth(B.E, B.V0, B.a), C.amber]].filter((x) => x[1]).map(([n, d, c]) => ({
        type: "bar", x: ["Transmission T", "Reflection R"], y: [d.T, d.R], name: "Scenario " + n + " · dataset",
        marker: { color: c, pattern: { shape: "/" }, line: { color: "#fff", width: 1 } }, hovertemplate: n + " dataset %{x} = %{y:.6g}<extra></extra>" })),
    ], baseLayout({
      barmode: "group", margin: { l: 62, r: 14, t: 40, b: 40 },
      title: { text: "Outcome probabilities" + (logT ? " (LOG axis)" : " (linear axis)"), font: { size: 14 } },
      yaxis: logT ? { type: "log", title: "Probability (log scale)", gridcolor: C.grid, range: [-8, 0.1] } : { title: "Probability", range: [0, 1.05], gridcolor: C.grid },
    }), CFG);

    const row = (l, f) => `<tr><td>${l}</td><td>${f(A, cache.A)}</td><td>${f(B, cache.B)}</td></tr>`;
    $("scn-table").innerHTML = `<table><tr><th></th><th style="color:${C.cyan}">A</th><th style="color:${C.amber}">B</th></tr>` +
      row("Name", (s) => s.name) + row("E" + (MODE.key === "model" ? " (eV)" : ""), (s) => fmt(s.E, 2)) + row("V₀" + (MODE.key === "model" ? " (eV)" : ""), (s) => fmt(s.V0, 2)) + row("a" + (MODE.key === "model" ? " (nm)" : ""), (s) => fmt(s.a, 3)) +
      row("Regime", (s, c) => c.st.regime) + row("T", (s, c) => fmtT(c.st.T_num)) + row("R", (s, c) => fmt(c.st.R_num, 6)) +
      row("log₁₀ T", (s, c) => fmt(log10T(c.st.T_num), 3)) +
      (MODE.key === "data" ? row("Dataset T", (s) => { const d = dsTruth(s.E, s.V0, s.a); return d ? fmtT(d.T) : "— (no record)"; }) : "") + "</table>";

    sensitivity(Ta, Tb);
  }

  function sensitivity(Ta, Tb) {
    const base = log10T(Tm(P.E, P.V0, P.a));
    const names = { E: "Energy E", V0: "Height V₀", a: "Width a" };
    const eff = (k, f) => { const p = { ...P }; p[k] *= f; return log10T(Tm(p.E, p.V0, p.a)) - base; };
    const up = KEYS.map((k) => eff(k, 1.1)), dn = KEYS.map((k) => eff(k, 0.9));
    Plotly.react("plot6c", [
      { type: "bar", orientation: "h", y: KEYS.map((k) => names[k]), x: up, name: "+10 %", marker: { color: C.violet }, hovertemplate: "%{y} +10%: Δlog₁₀T = %{x:.4f}<extra></extra>" },
      { type: "bar", orientation: "h", y: KEYS.map((k) => names[k]), x: dn, name: "−10 %", marker: { color: C.blue }, hovertemplate: "%{y} −10%: Δlog₁₀T = %{x:.4f}<extra></extra>" },
    ], baseLayout({
      barmode: "group", margin: { l: 100, r: 20, t: 40, b: 50 },
      title: { text: "Sensitivity at current controls: Δlog₁₀(T) for a ±10 % change", font: { size: 14 } },
      xaxis: { title: "Δ log₁₀(T)  (+ = more transmission)", gridcolor: C.grid, zerolinecolor: "#9e3b6f" }, yaxis: { gridcolor: C.grid },
    }), CFG);
    const mags = KEYS.map((k, i) => Math.max(Math.abs(up[i]), Math.abs(dn[i])));
    const top = KEYS[mags.indexOf(Math.max(...mags))];
    const ratio = Ta / Tb;
    const cmp = ratio >= 1 ? `Scenario A transmits <b>${fmt(ratio, 2)}×</b> more than B` : `Scenario B transmits <b>${fmt(1 / ratio, 2)}×</b> more than A`;
    $("takeaway").innerHTML = `<b>Takeaway.</b> ${cmp} (T<sub>A</sub> = ${fmtT(Ta)}, T<sub>B</sub> = ${fmtT(Tb)}).<br>
      At the current controls, transmission is most sensitive to the barrier <b>${{ E: "energy E", V0: "height V₀", a: "width a" }[top]}</b>.
      For E &lt; V₀, T falls roughly like e<sup>−2κa</sup>, so width and height compete exponentially; energy matters most close to V₀.`;
  }

  // ======================= VERIFICATION =======================
  function runVerification() {
    const rows = [];
    const add = (name, criterion, observed, pass) => rows.push({ name, criterion, observed, pass });
    // 1 numerical example
    const E = 8, V0 = 10, a = 0.1;
    const kappa = QT.K_PER_SQRT_EV * Math.sqrt(V0 - E);
    const Tn = QT.transmission(E, V0, a), st = QT.solveState(E, V0, a);
    const REF = 0.5065433346; // independent Python/stdlib reference (tests/make_reference.py)
    add("Numerical example: E=8 eV, V₀=10 eV, a=0.10 nm", "T matches independent Python reference 0.5065433346 (|ΔT| < 1e-9)",
      `κ = ${fmt(kappa, 4)} nm⁻¹, κa = ${fmt(kappa * a, 4)}, T = ${Tn.toFixed(10)}`, Math.abs(Tn - REF) < 1e-9);
    add("Formula vs. solved wavefunction", "T formula equals |F|² from the 4×4 boundary-condition solve", `|F|² = ${st.T_num.toFixed(10)}`, Math.abs(st.T_num - Tn) < 1e-9);
    // 2 conservation over random grid
    let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    let worst = 0;
    for (let i = 0; i < 400; i++) {
      const e = 0.5 + rnd() * 14.5, v = 1 + rnd() * 19, w = 0.02 + rnd() * 0.98;
      const s2 = QT.solveState(e, v, w); worst = Math.max(worst, Math.abs(s2.R_num + s2.T_num - 1));
    }
    add("Probability-current conservation (400 random states)", "max |R + T − 1| < 1e-9", `max error = ${worst.toExponential(2)}`, worst < 1e-9);
    // 3 boundary cases
    const Tz = QT.transmission(8, 10, 1e-6);
    add("Boundary: a → 0", "T → 1 (barrier vanishes)", `T(a = 1e-6 nm) = ${Tz.toFixed(8)}`, Tz > 0.999999);
    const widths = [0.05, 0.1, 0.2, 0.5, 1.0, 2.0], ts = widths.map((w) => QT.transmission(8, 10, w));
    add("Boundary: a large (E < V₀)", "T decreases monotonically and → 0 (T(2 nm) < 1e-9)", ts.map((t, i) => `a=${widths[i]}: ${t.toExponential(2)}`).join(" · "),
      ts.every((t, i) => i === 0 || ts[i - 1] > t) && ts[5] < 1e-9);
    const em = QT.transmission(10 - 1e-6, 10, 0.1), e0 = QT.transmission(10, 10, 0.1), ep = QT.transmission(10 + 1e-6, 10, 0.1);
    add("Boundary: E → V₀⁻, E = V₀, E → V₀⁺", "Eq. (7) joins Eq. (5) continuously (no 0/0)", `${em.toFixed(6)} · ${e0.toFixed(6)} · ${ep.toFixed(6)}`, Math.abs(em - e0) < 1e-4 && Math.abs(ep - e0) < 1e-4);
    const qq = QT.K_PER_SQRT_EV * Math.sqrt(2), Tres = QT.transmission(12, 10, Math.PI / qq);
    add("Boundary: above-barrier resonance (qa = π)", "T = 1 although E > V₀ in general gives R > 0", `T(E=12, a=π/q=${fmt(Math.PI / qq, 4)} nm) = ${Tres.toFixed(10)}; at a = 0.10 nm T = ${QT.transmission(12, 10, 0.1).toFixed(4)}`, Math.abs(Tres - 1) < 1e-9);
    let threw = false; try { QT.transmission(-1, 10, 0.1); } catch (e) { threw = true; }
    add("Invalid input handling", "E ≤ 0 is rejected and reported, never silently replaced", threw ? "rejected with message" : "accepted (bug)", threw);
    verifyRows = rows; renderVerify();
  }
  let verifyRows = [];
  function renderVerify() {
    $("verify-table").innerHTML = "<tr><th>Check</th><th>Pass criterion</th><th>Observed</th><th>Status</th></tr>" +
      verifyRows.map((r) => `<tr><td>${r.name}</td><td>${r.criterion}</td><td>${r.observed}</td><td class="${r.pass ? "pass" : "fail"}">${r.pass ? "PASS" : "FAIL"}</td></tr>`).join("");
  }

  // ======================= VIEW 7: dataset cross-check =======================
  const KN = QT.K_NATURAL;
  let dQ = "dens";
  const REGCOL = { tunneling: C.cyan, resonance: C.amber, over_barrier: C.violet };
  const COMBO_COLORS = ["#e65d8f", "#ff9ec8", "#a56ad9", "#c3a2ff", "#5f8ee8", "#2fb7ad", "#d99028", "#f4b860", "#b565a7", "#7d5ba6", "#5aa9a4", "#d66fba"];

  async function loadData() {
    const st = $("data-status");
    try {
      const urls = ["datasets/quantum_tunneling_summary.csv", "datasets/quantum_tunneling_wavefunction_profiles.csv"];
      const [ta, tb] = await Promise.all(urls.map((u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u + " → HTTP " + r.status); return r.text(); })));
      const raw = window.CSV.parse(ta);
      const sum = raw.map((r) => ({ id: r.sim_id, E: +r.particle_energy, V0: +r.barrier_height, a: +r.barrier_width, T: +r.transmission_probability, R: +r.reflection_probability, regime: r.regime }))
        .filter((r) => [r.E, r.V0, r.a, r.T, r.R].every(Number.isFinite));   // missing / non-numeric rows are dropped and counted
      const dropped = raw.length - sum.length;
      const groups = new Map();
      for (const r of window.CSV.parse(tb)) {
        if (!groups.has(r.scenario_name)) groups.set(r.scenario_name, { name: r.scenario_name, E: +r.particle_energy, V0: +r.barrier_height, a: +r.barrier_width, T: +r.transmission_probability, x: [], dens: [], re: [], im: [], region: [] });
        const g = groups.get(r.scenario_name);
        g.x.push(+r.position); g.dens.push(+r.probability_density); g.re.push(+r.wavefunction_real); g.im.push(+r.wavefunction_imag); g.region.push(r.spatial_region);
      }
      DS = { sum, dropped, groups: [...groups.values()], V0s: [...new Set(sum.map((r) => r.V0))].sort((a, b) => a - b), as: [...new Set(sum.map((r) => r.a))].sort((a, b) => a - b) };
      const fill = (id, vals, def) => { $(id).innerHTML = vals.map((v) => `<option value="${v}"${v === def ? " selected" : ""}>${v}</option>`).join(""); };
      fill("d-V0", DS.V0s, 5); fill("d-a", DS.as, DS.as.includes(1.5) ? 1.5 : DS.as[0]);
      $("d-prof").innerHTML = DS.groups.map((g, i) => `<option value="${i}">${g.name}</option>`).join("");
      st.innerHTML = `Loaded <b>${sum.length}</b> summary records (${DS.V0s.length} barrier heights × ${DS.as.length} widths × energy sweep; ${dropped} dropped for missing values) and <b>${DS.groups.length}</b> wavefunction profiles (${DS.groups.reduce((s, g) => s + g.x.length, 0)} points). <b>Source:</b> the tunneling portion of <i>Quantum Gatekeeper</i> (Ponze, 2026, unpublished research dataset) — a separate project from this one; its IBM Quantum hardware records are not used here.`;
      renderView7(); addDatasetVerification();
      $("src-data").disabled = false; $("src-data").title = "Switch Views 1–6 to dimensionless units with the dataset overlaid";
    } catch (e) {
      st.className = "note warn";
      st.innerHTML = "Could not load the datasets (" + e.message + "). Serve the folder over http, e.g. <code>python -m http.server</code> — browsers block fetch() on file:// pages.";
    }
  }

  function datasetStats() {
    let worstT = 0, worstSum = 0, worstId = "";
    for (const r of DS.sum) {
      const d = Math.abs(QT.transmission(r.E, r.V0, r.a, KN) - r.T);
      if (d > worstT) { worstT = d; worstId = r.id; }
      worstSum = Math.max(worstSum, Math.abs(r.T + r.R - 1));
    }
    let worstDens = 0, pts = 0;
    for (const g of DS.groups) {
      const w = QT.psi(QT.solveState(g.E, g.V0, g.a, KN), g.x);
      g.x.forEach((_, i) => { worstDens = Math.max(worstDens, Math.abs(w.re[i] ** 2 + w.im[i] ** 2 - g.dens[i])); pts++; });
    }
    return { worstT, worstSum, worstId, worstDens, pts };
  }
  function addDatasetVerification() {
    const s = datasetStats();
    verifyRows.push(
      { name: "Dataset cross-check: summary table", criterion: "JS model (K = √2) reproduces every recorded T (|ΔT| < 5e-5; data rounded to 6 d.p.)",
        observed: `${DS.sum.length} records, worst |ΔT| = ${s.worstT.toExponential(2)} (${s.worstId})`, pass: s.worstT < 5e-5 },
      { name: "Dataset integrity: R + T = 1", criterion: "every record satisfies |T + R − 1| < 1e-5; no missing values",
        observed: `max error = ${s.worstSum.toExponential(2)}; ${DS.dropped} rows dropped`, pass: s.worstSum < 1e-5 && DS.dropped === 0 },
      { name: "Dataset cross-check: wavefunction profiles", criterion: "live |ψ(x)|² equals dataset at every position (|Δ| < 2e-3)",
        observed: `${DS.groups.length} scenarios, ${s.pts} points, worst |Δ|ψ|²| = ${s.worstDens.toExponential(2)}`, pass: s.worstDens < 2e-3 });
    renderVerify();
  }

  function renderView7() {
    if (!DS) return;
    const V0 = parseFloat($("d-V0").value), a = parseFloat($("d-a").value), all = $("d-all").checked, logT = $("d-log").checked;
    const combos = [];
    DS.V0s.forEach((v) => DS.as.forEach((w) => combos.push([v, w])));
    const Es = QT.linspace(0.05, 10.05, 400);
    const traces = [];
    const hov = (r) => `${r.id}<br>E = ${r.E}, V₀ = ${r.V0}, a = ${r.a}<br>T = ${r.T}<br>R = ${r.R}<br>regime: ${r.regime}`;
    let sel = DS.sum.filter((r) => r.V0 === V0 && r.a === a);
    if (all) {
      combos.forEach(([v, w], i) => {
        const rs = DS.sum.filter((r) => r.V0 === v && r.a === w), isSel = v === V0 && w === a, col = COMBO_COLORS[i % 12];
        traces.push({ x: rs.map((r) => r.E), y: rs.map((r) => r.T), mode: "markers", name: `V₀=${v}, a=${w}`, legendgroup: `c${i}`, marker: { size: isSel ? 6 : 4, color: col, opacity: isSel ? 1 : 0.65 }, customdata: rs.map((r) => r.id), text: rs.map(hov), hovertemplate: "%{text}<extra></extra>" });
        traces.push({ x: Es, y: Es.map((e) => QT.transmission(e, v, w, KN)), mode: "lines", legendgroup: `c${i}`, showlegend: false, line: { color: col, width: isSel ? 2.5 : 1 }, hoverinfo: "skip" });
      });
    } else {
      for (const reg of ["tunneling", "resonance", "over_barrier"]) {
        const rs = sel.filter((r) => r.regime === reg);
        if (rs.length) traces.push({ x: rs.map((r) => r.E), y: rs.map((r) => r.T), mode: "markers", name: "data: " + reg.replace("_", "-"), marker: { size: 6, color: REGCOL[reg] }, customdata: rs.map((r) => r.id), text: rs.map(hov), hovertemplate: "%{text}<extra></extra>" });
      }
      traces.push({ x: Es, y: Es.map((e) => QT.transmission(e, V0, a, KN)), mode: "lines", name: "live model", line: { color: "#9e3b6f", width: 1.8, dash: "dot" }, hovertemplate: "model<br>E = %{x:.2f}<br>T = %{y:.5g}<extra></extra>" });
    }
    // 12 sweeps need room: taller plots and the legend moved to the right of the axes
    ["plot7a", "plot7b"].forEach((id) => { $(id).style.height = all ? "680px" : ""; });
    Plotly.react("plot7a", traces, baseLayout({
      ...(all ? { legend: { orientation: "v", x: 1.02, y: 1, xanchor: "left", font: { size: 11 } }, margin: { l: 62, r: 150, t: 70, b: 52 } } : {}),
      title: { text: "Transmission vs. energy: dataset records vs. live model (natural units)", font: { size: 14 } },
      xaxis: { title: "Particle energy E (dimensionless, ħ = m = 1)", gridcolor: C.grid },
      yaxis: logT ? { type: "log", title: "T (log scale)", gridcolor: C.grid } : { title: "Transmission probability T", range: [0, 1.05], gridcolor: C.grid },
      shapes: all ? [] : [{ type: "line", x0: V0, x1: V0, y0: 0, y1: 1, yref: "paper", line: { color: C.amber, dash: "dash", width: 1 } }],
      annotations: all ? [] : [{ x: V0, y: 1, yref: "paper", text: "E = V₀", showarrow: false, xanchor: "left", yanchor: "top", font: { color: C.amber, size: 11 } }],
    }), CFG);

    const g = DS.groups[+$("d-prof").value];
    const st = QT.solveState(g.E, g.V0, g.a, KN);
    const xm = QT.linspace(g.x[0], g.x[g.x.length - 1], 700), wm = QT.psi(st, xm), wd = QT.psi(st, g.x);
    const pick = { dens: ["|ψ(x)|² (relative)", (w) => Array.from(w.re, (r, i) => r * r + w.im[i] * w.im[i]), g.dens], re: ["Re ψ(x)", (w) => Array.from(w.re), g.re], im: ["Im ψ(x)", (w) => Array.from(w.im), g.im] }[dQ];
    const dataY = pick[2], modelAtData = pick[1](wd);
    const ymax = Math.max(...dataY.map(Math.abs), ...pick[1](wm).map(Math.abs)) * 1.15 + 1e-6;
    const ymin = dQ === "dens" ? 0 : -ymax;
    Plotly.react("plot7b", [
      { x: xm, y: pick[1](wm), mode: "lines", name: "live model", line: { color: "#9e3b6f", width: 1.8 }, hoverinfo: "skip" },
      { x: g.x, y: dataY, mode: "markers", name: "dataset", marker: { size: 4.5, color: C.cyan, opacity: 0.85 }, text: g.region,
        hovertemplate: "x = %{x:.3f}<br>" + pick[0] + " = %{y:.5f}<br>%{text}<extra>dataset</extra>" },
    ], baseLayout({
      title: { text: g.name, font: { size: 14 } },
      xaxis: { title: "Position x (dimensionless)", gridcolor: C.grid }, yaxis: { title: pick[0], gridcolor: C.grid, range: [ymin, ymax] },
      shapes: [{ type: "rect", x0: 0, x1: g.a, y0: ymin, y1: ymax, fillcolor: "rgba(167,139,250,.2)", line: { color: C.violet, width: 1 } }],
    }), CFG);

    const sdiff = Math.max(0, ...sel.map((r) => Math.abs(QT.transmission(r.E, r.V0, r.a, KN) - r.T)));
    const gs = datasetStats();
    const pdiff = Math.max(...dataY.map((v, i) => Math.abs(v - modelAtData[i])));
    const row = (l, v, cls = "") => `<div class="stat ${cls}"><span>${l}</span><b>${v}</b></div>`;
    $("d-stats").innerHTML =
      row("Records in this sweep", sel.length + " (E = " + Math.min(...sel.map((r) => r.E)) + "–" + Math.max(...sel.map((r) => r.E)) + ")") +
      row("Sweep: max |T_data − T_model|", sdiff.toExponential(2), sdiff < 5e-5 ? "good" : "bad") +
      row("All " + DS.sum.length + " records: max |ΔT|", gs.worstT.toExponential(2), gs.worstT < 5e-5 ? "good" : "bad") +
      row("Regime counts (all)", ["tunneling", "over_barrier", "resonance"].map((k) => k.replace("_", "-") + " " + DS.sum.filter((r) => r.regime === k).length).join(" · ")) +
      row("Profile T: dataset / model", g.T + " / " + st.T_num.toFixed(6)) +
      row("Profile: max |data − model| (" + pick[0] + ")", pdiff.toExponential(2), pdiff < 2e-3 ? "good" : "bad");
    Plotly.Plots.resize($("plot7a")); Plotly.Plots.resize($("plot7b"));
    const g7 = $("plot7a");
    g7.removeAllListeners && g7.removeAllListeners("plotly_click");
    g7.on("plotly_click", (ev) => {              // click any dot -> load that record into Views 1–6
      const pt = ev.points && ev.points[0], rec = pt && DS.sum.find((r) => r.id === pt.customdata);
      if (rec) loadIntoViews(rec);
    });
  }
  ["d-V0", "d-a", "d-prof"].forEach((id) => $(id).addEventListener("change", renderView7));
  function loadIntoViews(s) {
    if (MODE.key !== "data") setMode("data");
    setParams({ E: s.E, V0: s.V0, a: s.a });
    $("view1").scrollIntoView({ behavior: "smooth" });
  }
  $("d-load-prof").addEventListener("click", () => { if (DS) loadIntoViews(DS.groups[+$("d-prof").value]); });
  ["d-log", "d-all"].forEach((id) => $(id).addEventListener("change", renderView7));
  document.querySelectorAll("#view7 .seg-btn").forEach((b) => b.addEventListener("click", () => {
    dQ = b.dataset.q;
    document.querySelectorAll("#view7 .seg-btn").forEach((x) => x.classList.toggle("active", x === b));
    renderView7();
  }));

  // ---------- boot ----------
  KEYS.forEach(syncInputs);
  update();
  runVerification();
  loadData();
})();
