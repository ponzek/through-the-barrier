/* ============================================================
 * app.js -- Through the Barrier : six linked dynamic views
 * Depends on physics.js (window.QT) and Plotly.
 * ============================================================ */
(function () {
  "use strict";
  const QT = window.QT;
  const $ = (id) => document.getElementById(id);

  const DEF = { E: 8, V0: 10, a: 0.1 };
  const P = { ...DEF };
  const C = { cyan: "#5eead4", violet: "#a78bfa", amber: "#fbbf24", rose: "#fb7185", blue: "#60a5fa", dim: "#94a0c8", grid: "rgba(148,163,255,.14)" };
  const CFG = { responsive: true, displaylogo: false, modeBarButtonsToRemove: ["lasso2d", "select2d"] };
  const PRESETS = [
    ["Thin barrier", 8, 10, 0.05],
    ["Default (proposal)", 8, 10, 0.10],
    ["Wide barrier", 8, 10, 0.50],
    ["High barrier", 8, 16, 0.10],
    ["Energy close to V₀", 9.8, 10, 0.10],
    ["Above barrier (E > V₀)", 12, 10, 0.10],
    ["Above barrier, resonance (T≈1)", 12, 10, +(Math.PI / (QT.K_PER_SQRT_EV * Math.sqrt(2))).toFixed(3)],
  ];
  let A = { name: "Default (proposal)", E: 8, V0: 10, a: 0.10 };
  let B = { name: "Wide barrier", E: 8, V0: 10, a: 0.50 };
  let phase = 0, playing = false, lastT = 0, mode5 = "2d";
  const cache = { cur: null, A: null, B: null };

  // ---------- helpers ----------
  const fmtT = (t) => (t < 1e-3 ? t.toExponential(3) : t.toFixed(6));
  const fmt = (v, d = 2) => Number(v).toFixed(d);
  const log10T = (t) => Math.log10(Math.max(t, 1e-300));
  const sup = (n) => String(n).replace(/-/g, "⁻").replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d]);
  const baseLayout = (extra = {}) => {
    const L = Object.assign({
      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(8,12,28,.55)",
      font: { family: "Inter, sans-serif", color: "#dbe2ff", size: 12 },
      margin: { l: 62, r: 20, t: 40, b: 52 },
      xaxis: { gridcolor: C.grid, zerolinecolor: C.grid }, yaxis: { gridcolor: C.grid, zerolinecolor: C.grid },
      legend: { orientation: "h", y: 1.0, yanchor: "bottom", x: 0 },
      hoverlabel: { bgcolor: "#0b1226", bordercolor: C.cyan, font: { color: "#fff" } },
    }, extra);
    // title sits at the very top of the container; legend sits just above the plot area (no overlap)
    if (L.title) L.title = Object.assign({ y: 0.97, yanchor: "top", yref: "container", x: 0.02, xanchor: "left" }, L.title);
    L.margin = Object.assign({}, L.margin, { t: Math.max(L.margin.t, 70) });
    return L;
  };
  const xGrid = (a, n = 1400) => QT.linspace(-1.5, a + 1.5, n);

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
  $("reset-btn").addEventListener("click", () => { setParams(DEF); });

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
    const st = QT.solveState(P.E, P.V0, P.a);
    const xs = xGrid(P.a);
    cache.cur = { st, xs, w: QT.psi(st, xs) };
    renderPill(st);
    view1(st); view2(st); view3(st); view4(st); view5(st); view6();
  }

  function renderPill(st) {
    const p = $("regime-pill");
    p.className = "pill " + st.regime;
    p.textContent = { tunneling: "Tunneling · E < V₀", above: "Above barrier · E > V₀", threshold: "Threshold · E = V₀" }[st.regime];
  }

  // ======================= VIEW 1 =======================
  function view1(st) {
    const { E, V0, a } = P;
    const top = Math.max(E, V0) * 1.3;
    const x0 = -1, x1 = a + 1;
    const traces = [
      { x: [x0, 0, 0, a, a, x1], y: [0, 0, V0, V0, 0, 0], mode: "lines", name: "Potential energy V(x)",
        line: { color: C.violet, width: 3 }, fill: "tozeroy", fillcolor: "rgba(167,139,250,.28)",
        hovertemplate: "x = %{x:.3f} nm<br>V = %{y:.2f} eV<extra></extra>" },
      { x: [x0, x1], y: [E, E], mode: "lines", name: "Particle energy E", line: { color: C.amber, width: 2.5, dash: "dash" },
        hovertemplate: "E = " + fmt(E) + " eV<extra></extra>" },
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
      xaxis: { title: "Position x (nm)", gridcolor: C.grid, range: [x0, x1] },
      yaxis: { title: "Energy (eV)", gridcolor: C.grid, range: [0, top] }, annotations: ann,
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
        hovertemplate: "x = %{x:.3f} nm<br>Re ψ = %{y:.4f}<extra></extra>" },
    ], baseLayout({
      title: { text: "Stationary scattering state (incident amplitude = 1)", font: { size: 14 } },
      xaxis: { title: "Position x (nm)", gridcolor: C.grid }, yaxis: { title: "Relative wavefunction amplitude (arb.)", gridcolor: C.grid, range: [-ymax, ymax] },
      shapes: [{ type: "rect", x0: 0, x1: P.a, y0: -ymax, y1: ymax, fillcolor: "rgba(167,139,250,.2)", line: { color: C.violet, width: 1 } }],
      annotations: [
        { x: -0.75, y: ymax * 0.93, text: "incident + reflected", showarrow: false, font: { color: C.blue } },
        { x: P.a / 2, y: -ymax * 0.93, text: midLabel, showarrow: false, font: { color: C.violet, size: 11 } },
        { x: P.a + 0.75, y: ymax * 0.93, text: "transmitted", showarrow: false, font: { color: C.amber } },
      ],
    }), CFG);

    const kap = st.g ? st.g[0] : 0, q = st.g ? st.g[1] : 0;
    const rows = [
      [C.blue, "<b>x &lt; 0</b> — incident + reflected waves interfere. Reflected share R = " + fmt(st.R_num, 4)],
      [C.violet, reg === "tunneling" ? "<b>0 ≤ x ≤ a</b> — <b>evanescent</b>: ψ decays like e<sup>−κx</sup>, κ = " + fmt(kap, 2) + " nm⁻¹ (decay length 1/κ = " + fmt(1 / kap, 3) + " nm). κa = " + fmt(kap * P.a, 3)
        : reg === "above" ? "<b>0 ≤ x ≤ a</b> — <b>oscillatory</b>: wavelength 2π/q = " + fmt(2 * Math.PI / q, 3) + " nm inside the barrier."
        : "<b>0 ≤ x ≤ a</b> — <b>threshold</b>: ψ is linear in x (ψ = C + Dx)."],
      [C.amber, "<b>x &gt; a</b> — transmitted wave with constant amplitude |F| = " + fmt(Math.sqrt(st.T_num), 4) + " (T = " + fmtT(st.T_num) + ")."],
    ];
    $("region-card").innerHTML = rows.map(([c, t]) => `<div class="region-row"><span class="dot" style="background:${c}"></span><span>${t}</span></div>`).join("");
  }

  function animateFrame() {
    if (!cache.cur) return;
    Plotly.restyle("plot2", { y: [Array.from(reAt(cache.cur.w, phase))] }, [2]);
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
        hovertemplate: "x = %{x:.3f} nm<br>relative |ψ|² = %{y:.5f}<extra></extra>" },
    ], baseLayout({
      title: { text: "Relative probability density |ψ(x)|² (arbitrary units)", font: { size: 14 } },
      xaxis: { title: "Position x (nm)", gridcolor: C.grid }, yaxis: { title: "Relative |ψ(x)|² (arb.)", gridcolor: C.grid, range: [0, ymax] },
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
      s("Left ripple range", fmt(lo, 3) + " – " + fmt(hi, 3));
  }

  // ======================= VIEW 4 =======================
  function view4(st) {
    const Tf = QT.transmission(P.E, P.V0, P.a), Rf = 1 - Tf;
    Plotly.react("plot4", [
      { type: "bar", orientation: "h", y: ["Closed-form", "From wavefunction"], x: [Rf, st.R_num], name: "Reflection R", marker: { color: C.rose },
        text: [fmt(Rf, 4), fmt(st.R_num, 4)], textposition: "inside", hovertemplate: "R = %{x:.8f}<extra></extra>" },
      { type: "bar", orientation: "h", y: ["Closed-form", "From wavefunction"], x: [Tf, st.T_num], name: "Transmission T", marker: { color: C.cyan },
        text: [fmtT(Tf), fmtT(st.T_num)], textposition: "inside", insidetextfont: { color: "#041016" }, hovertemplate: "T = %{x:.8g}<extra></extra>" },
    ], baseLayout({
      barmode: "stack", margin: { l: 130, r: 20, t: 40, b: 52 },
      title: { text: "Share of incident probability current (R + T = 1)", font: { size: 14 } },
      xaxis: { title: "Probability (unitless)", range: [0, 1], gridcolor: C.grid }, yaxis: { gridcolor: C.grid },
    }), CFG);
    const sum = Rf + Tf, err = Math.abs(st.R_num + st.T_num - 1), diff = Math.abs(st.T_num - Tf);
    const s = (l, v, cls = "") => `<div class="stat ${cls}"><span>${l}</span><b>${v}</b></div>`;
    $("v4-stats").innerHTML =
      s("Reflection R", fmt(Rf, 6)) + s("Transmission T", fmtT(Tf)) +
      s("R + T", sum.toFixed(12), Math.abs(sum - 1) < 1e-10 ? "good" : "bad") +
      s("|B|² + |F|² − 1 (flux)", err.toExponential(1), err < 1e-9 ? "good" : "bad") +
      s("|T formula − |F|²|", diff.toExponential(1), diff < 1e-9 ? "good" : "bad") +
      s("Energy of transmitted particle", fmt(P.E, 2) + " eV (unchanged)");
  }

  // ======================= VIEW 5 =======================
  const W5 = QT.linspace(0.02, 1.0, 80), H5 = QT.linspace(1, 20, 77);
  const TICKV = [-16, -12, -8, -4, -2, -1, 0], TICKT = TICKV.map((v) => "10" + sup(v));
  function view5(st) {
    const z = [], tt = [];
    for (const V0 of H5) {
      const zr = [], tr = [];
      for (const a of W5) { const T = QT.transmission(P.E, V0, a); tr.push(T); zr.push(Math.max(log10T(T), -16)); }
      z.push(zr); tt.push(tr);
    }
    const cb = { title: { text: "log₁₀(T)", side: "top" }, tickvals: TICKV, ticktext: TICKT, len: 0.9 };
    const here = log10T(st.T_num);
    let data, layout;
    if (mode5 === "2d") {
      data = [
        { type: "heatmap", x: W5, y: H5, z, customdata: tt, colorscale: "Viridis", zmin: -16, zmax: 0, colorbar: cb,
          hovertemplate: "width a = %{x:.3f} nm<br>height V₀ = %{y:.2f} eV<br>T = %{customdata:.3e}<br>log₁₀T = %{z:.2f}<extra></extra>" },
        { type: "scatter", mode: "markers", x: [P.a], y: [P.V0], name: "Current state", marker: { size: 15, color: "#fff", line: { color: "#000", width: 2 }, symbol: "circle-open-dot" },
          hovertemplate: "Current: a = " + fmt(P.a, 2) + " nm, V₀ = " + fmt(P.V0, 1) + " eV<br>T = " + fmtT(st.T_num) + "<extra></extra>" },
        { type: "scatter", mode: "lines", x: [W5[0], W5[W5.length - 1]], y: [P.E, P.E], name: "V₀ = E (threshold)", line: { color: C.amber, dash: "dash", width: 2 }, hoverinfo: "skip" },
      ];
      layout = baseLayout({
        title: { text: "Transmission over barrier width × height (E = " + fmt(P.E, 1) + " eV) · log color scale", font: { size: 14 } },
        xaxis: { title: "Barrier width a (nm)", gridcolor: C.grid }, yaxis: { title: "Barrier height V₀ (eV)", gridcolor: C.grid },
      });
    } else {
      data = [
        { type: "surface", x: W5, y: H5, z, customdata: tt, colorscale: "Viridis", cmin: -16, cmax: 0, colorbar: cb,
          hovertemplate: "a = %{x:.3f} nm<br>V₀ = %{y:.2f} eV<br>log₁₀T = %{z:.2f}<extra></extra>" },
        { type: "scatter3d", mode: "markers", x: [P.a], y: [P.V0], z: [Math.max(here, -16)], name: "Current state",
          marker: { size: 7, color: "#fff", line: { color: "#000", width: 2 } }, hoverinfo: "name" },
      ];
      layout = baseLayout({
        margin: { l: 0, r: 0, t: 40, b: 0 },
        title: { text: "3D surface of log₁₀(T) (E = " + fmt(P.E, 1) + " eV)", font: { size: 14 } },
        scene: { xaxis: { title: "a (nm)" }, yaxis: { title: "V₀ (eV)" }, zaxis: { title: "log₁₀(T)", range: [-16, 0] }, camera: { eye: { x: 1.6, y: -1.6, z: 0.9 } },
          bgcolor: "rgba(8,12,28,.55)" },
      });
    }
    Plotly.react("plot5", data, layout, CFG);
    const gd = $("plot5");
    gd.removeAllListeners && gd.removeAllListeners("plotly_click");
    gd.on("plotly_click", (ev) => {
      const pt = ev.points && ev.points[0]; if (!pt) return;
      if (pt.curveNumber !== 0) return;
      setParams({ E: P.E, V0: Math.round(pt.y * 10) / 10, a: Math.round(pt.x * 100) / 100 });
    });
    const s = (l, v) => `<div class="stat"><span>${l}</span><b>${v}</b></div>`;
    const dec = (QT.transmission(P.E, P.V0, P.a * 2));
    $("v5-stats").innerHTML =
      s("Marker: a, V₀", fmt(P.a, 2) + " nm, " + fmt(P.V0, 1) + " eV") +
      s("T at marker", fmtT(st.T_num)) + s("log₁₀(T) at marker", fmt(here, 3)) +
      s("T if width doubled", fmtT(dec)) +
      s("Ratio T(2a)/T(a)", fmt(dec / st.T_num, 4));
  }
  $("seg-2d").addEventListener("click", () => { mode5 = "2d"; $("seg-2d").classList.add("active"); $("seg-3d").classList.remove("active"); if (cache.cur) view5(cache.cur.st); });
  $("seg-3d").addEventListener("click", () => { mode5 = "3d"; $("seg-3d").classList.add("active"); $("seg-2d").classList.remove("active"); if (cache.cur) view5(cache.cur.st); });

  // ======================= VIEW 6 =======================
  const sel = $("preset-select");
  PRESETS.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p[0]; sel.appendChild(o); });
  const mk = (s) => ({ name: s.name, E: s.E, V0: s.V0, a: s.a });
  $("save-a").addEventListener("click", () => { A = { name: "Saved A", ...P }; view6(); });
  $("save-b").addEventListener("click", () => { B = { name: "Saved B", ...P }; view6(); });
  $("apply-a").addEventListener("click", () => setParams(A));
  $("apply-b").addEventListener("click", () => setParams(B));
  $("preset-a").addEventListener("click", () => { const p = PRESETS[sel.value]; A = { name: p[0], E: p[1], V0: p[2], a: p[3] }; view6(); });
  $("preset-b").addEventListener("click", () => { const p = PRESETS[sel.value]; B = { name: p[0], E: p[1], V0: p[2], a: p[3] }; view6(); });
  $("log-T").addEventListener("change", view6);

  function scnState(s) {
    const st = QT.solveState(s.E, s.V0, s.a);
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
          hovertemplate: name + "<br>x = %{x:.3f} nm<br>Re ψ = %{y:.4f}<extra></extra>" },
      ];
    };
    const ym = Math.max(...env(cache.A.w), ...env(cache.B.w)) * 1.15 + 0.1;
    const shape = (s, xr, yr, c) => ({ type: "rect", xref: xr, yref: yr, x0: 0, x1: s.a, y0: -ym, y1: ym, fillcolor: c + "30", line: { width: 0 } });
    const desc = (s) => `${s.name}: E=${fmt(s.E, 1)}, V₀=${fmt(s.V0, 1)}, a=${fmt(s.a, 2)}`;
    Plotly.react("plot6a", [...rowOf(cache.A, "A", C.cyan, "x2", "y2"), ...rowOf(cache.B, "B", C.amber, "x", "y")],
      baseLayout({
        margin: { l: 62, r: 14, t: 34, b: 44 },
        title: { text: "Synchronized wave plots (shared phase φ from View 2)", font: { size: 14 } },
        xaxis: { domain: [0, 1], anchor: "y", title: "Position x (nm)", gridcolor: C.grid }, yaxis: { domain: [0, 0.45], range: [-ym, ym], title: "Re ψ (B)", gridcolor: C.grid },
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
    Plotly.react("plot6b", [
      { type: "bar", x: ["Transmission T", "Reflection R"], y: [Ta, 1 - Ta], name: "Scenario A", marker: { color: C.cyan }, hovertemplate: "A %{x} = %{y:.6g}<extra></extra>" },
      { type: "bar", x: ["Transmission T", "Reflection R"], y: [Tb, 1 - Tb], name: "Scenario B", marker: { color: C.amber }, hovertemplate: "B %{x} = %{y:.6g}<extra></extra>" },
    ], baseLayout({
      barmode: "group", margin: { l: 62, r: 14, t: 40, b: 40 },
      title: { text: "Outcome probabilities" + (logT ? " (LOG axis)" : " (linear axis)"), font: { size: 14 } },
      yaxis: logT ? { type: "log", title: "Probability (log scale)", gridcolor: C.grid, range: [-8, 0.1] } : { title: "Probability", range: [0, 1.05], gridcolor: C.grid },
    }), CFG);

    const row = (l, f) => `<tr><td>${l}</td><td>${f(A, cache.A)}</td><td>${f(B, cache.B)}</td></tr>`;
    $("scn-table").innerHTML = `<table><tr><th></th><th style="color:${C.cyan}">A</th><th style="color:${C.amber}">B</th></tr>` +
      row("Name", (s) => s.name) + row("E (eV)", (s) => fmt(s.E, 2)) + row("V₀ (eV)", (s) => fmt(s.V0, 2)) + row("a (nm)", (s) => fmt(s.a, 3)) +
      row("Regime", (s, c) => c.st.regime) + row("T", (s, c) => fmtT(c.st.T_num)) + row("R", (s, c) => fmt(c.st.R_num, 6)) +
      row("log₁₀ T", (s, c) => fmt(log10T(c.st.T_num), 3)) + "</table>";

    sensitivity(Ta, Tb);
  }

  function sensitivity(Ta, Tb) {
    const base = log10T(QT.transmission(P.E, P.V0, P.a));
    const names = { E: "Energy E", V0: "Height V₀", a: "Width a" };
    const eff = (k, f) => { const p = { ...P }; p[k] *= f; return log10T(QT.transmission(p.E, p.V0, p.a)) - base; };
    const up = KEYS.map((k) => eff(k, 1.1)), dn = KEYS.map((k) => eff(k, 0.9));
    Plotly.react("plot6c", [
      { type: "bar", orientation: "h", y: KEYS.map((k) => names[k]), x: up, name: "+10 %", marker: { color: C.violet }, hovertemplate: "%{y} +10%: Δlog₁₀T = %{x:.4f}<extra></extra>" },
      { type: "bar", orientation: "h", y: KEYS.map((k) => names[k]), x: dn, name: "−10 %", marker: { color: C.blue }, hovertemplate: "%{y} −10%: Δlog₁₀T = %{x:.4f}<extra></extra>" },
    ], baseLayout({
      barmode: "group", margin: { l: 100, r: 20, t: 40, b: 50 },
      title: { text: "Sensitivity at current controls: Δlog₁₀(T) for a ±10 % change", font: { size: 14 } },
      xaxis: { title: "Δ log₁₀(T)  (+ = more transmission)", gridcolor: C.grid, zerolinecolor: "#fff" }, yaxis: { gridcolor: C.grid },
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
    $("verify-table").innerHTML = "<tr><th>Check</th><th>Pass criterion</th><th>Observed</th><th>Status</th></tr>" +
      rows.map((r) => `<tr><td>${r.name}</td><td>${r.criterion}</td><td>${r.observed}</td><td class="${r.pass ? "pass" : "fail"}">${r.pass ? "PASS" : "FAIL"}</td></tr>`).join("");
  }

  // ---------- boot ----------
  KEYS.forEach(syncInputs);
  update();
  runVerification();
})();
