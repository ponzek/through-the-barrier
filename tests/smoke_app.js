// Headless smoke test: runs the real app.js against a stub DOM + stub Plotly, in both data modes.
// Run:  node tests/smoke_app.js
const fs = require("fs");
const path = require("path");
const APP = path.join(__dirname, "..");

// ---------- minimal DOM / Plotly stubs ----------
const els = {};
function mkEl(id) {
  const handlers = {}; let html = "";
  const el = {
    id, handlers, checked: false, hidden: false, disabled: false, textContent: "", className: "", title: "", style: {}, dataset: {},
    min: "", max: "", step: "", _value: "", plotHandlers: {},
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); },
      toggle(c, on) { (on === undefined ? !this._s.has(c) : on) ? this._s.add(c) : this._s.delete(c); } },
    addEventListener(t, f) { handlers[t] = f; },
    appendChild() {}, scrollIntoView() {},
    on(name, f) { el.plotHandlers[name] = f; }, removeAllListeners() { el.plotHandlers = {}; },
    set innerHTML(v) { html = v; const m = /<option value="([^"]*)"[^>]*selected/.exec(v) || /<option value="([^"]*)"/.exec(v); if (m) el._value = m[1]; },
    get innerHTML() { return html; },
    set value(v) { el._value = String(v); }, get value() { return el._value; },
  };
  return el;
}
global.window = global;
global.document = {
  getElementById: (id) => (els[id] ||= mkEl(id)),
  createElement: () => ({ value: "", textContent: "" }),
  querySelectorAll: () => [],
};
els["speed-range"] = Object.assign(mkEl("speed-range"), { _value: "1" });
els["preset-select"] = Object.assign(mkEl("preset-select"), { _value: "0" });
const calls = {};  // plot id -> last data array
global.Plotly = {
  react: (id, data, layout) => { calls[id] = { data, layout }; },
  restyle: () => {}, purge: () => {}, Plots: { resize: () => {} },
};
global.fetch = async (u) => ({ ok: true, text: async () => fs.readFileSync(path.join(APP, u), "utf8") });
global.requestAnimationFrame = () => 0;

require(path.join(APP, "physics.js"));
require(path.join(APP, "csv.js"));
let fails = 0;
const ok = (n, c, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n} ${d}`); if (!c) fails++; };
const view4Panel = () => els["v4-simple"].innerHTML;

(async () => {
  require(path.join(APP, "app.js"));
  await new Promise((r) => setTimeout(r, 800));

  ok("boot: all graph-based views rendered", ["plot1", "plot2", "plot3", "plot5", "plot6a", "plot6b", "plot6c"].every((k) => calls[k]));
  ok("boot: View 4 renders the simple out-of-100 panel", /out of 100/.test(view4Panel()) && /Passed through barrier/.test(els["v4-stats"].innerHTML));
  ok("dataset loaded, View 7 rendered", !!calls.plot7a && !!calls.plot7b);
  ok("source button enabled after load", els["src-data"].disabled === false);
  ok("verification table has 11 rows", (els["verify-table"].innerHTML.match(/<tr><td>/g) || []).length === 11);
  ok("verification: all PASS", !/class="fail"/.test(els["verify-table"].innerHTML));

  // ---- switch to dataset mode ----
  els["src-data"].handlers.click();
  ok("data mode: labels become dimensionless", /dimensionless/.test(els["E-lbl"].innerHTML));
  ok("data mode: sliders re-ranged", els["E-range"].max === 10 && els["a-range"].max === 2.5);
  ok("data mode: state matches a dataset record/profile", /matches dataset/.test(els["data-match"].textContent), els["data-match"].textContent);
  ok("data mode: View 4 keeps simple panel and reports dataset", /out of 100/.test(view4Panel()) && /Saved dataset record/.test(els["v4-stats"].innerHTML));
  ok("data mode: View 2 overlays dataset dots", calls.plot2.data.length === 4);
  ok("data mode: View 3 overlays dataset dots", calls.plot3.data.length === 2);
  ok("data mode: View 5 overlays dataset squares", calls.plot5.data.length === 4);
  ok("data mode: View 6 bars include dataset (hatched)", calls.plot6b.data.length >= 3);
  ok("data mode: scenario table has Dataset T row", /Dataset T/.test(els["scn-table"].innerHTML));
  ok("data mode: unit-free axis titles", /dimensionless/.test(calls.plot1.layout.xaxis.title));

  // ---- move off-grid, then snap ----
  els["E-range"].handlers.input({ target: { value: "4.95" } });
  ok("off-grid state reports no record", /No dataset record/.test(els["data-match"].textContent) || /matches/.test(els["data-match"].textContent));
  els["V0-range"].handlers.input({ target: { value: "6.3" } });
  ok("off-grid: snap button visible, View 4 back to model-only stats", els["snap-btn"].hidden === false && !/Saved dataset record/.test(els["v4-stats"].innerHTML));
  els["snap-btn"].handlers.click();
  ok("snap: lands on a dataset record", /matches dataset/.test(els["data-match"].textContent), els["data-match"].textContent);

  // ---- View 5 click on a dataset square / heatmap ----
  const gd5 = els["plot5"].plotHandlers.plotly_click;
  gd5 && gd5({ points: [{ curveNumber: 3, x: 1, y: 7 }] });
  ok("View 5: clicking a dataset square loads it exactly", els["V0-range"].value === "7" && els["a-range"].value === "1", `V0=${els["V0-range"].value} a=${els["a-range"].value}`);

  // ---- View 5 3D toggle ----
  els["seg-3d"].handlers.click();
  ok("View 5: 3D toggle renders a surface + 3D markers", calls.plot5.data[0].type === "surface" && calls.plot5.data.slice(1).every((t) => t.type === "scatter3d") && !!calls.plot5.layout.scene);
  els["seg-2d"].handlers.click();
  ok("View 5: 2D toggle restores the heatmap", calls.plot5.data[0].type === "heatmap");

  // ---- View 7: all sweeps + click to load ----
  els["d-all"].checked = true; els["d-all"].handlers.change();
  ok("View 7: 12 sweeps -> 24 traces, taller plot", calls.plot7a.data.length === 24 && els["plot7a"].style.height === "680px");
  ok("View 7: legend moved to the right", calls.plot7a.layout.legend.orientation === "v" && calls.plot7a.layout.margin.r >= 150);
  els["d-all"].checked = false; els["d-all"].handlers.change();
  els["src-model"].handlers.click();
  ok("back to model mode: View 4 has model-only stats again", !/Saved dataset record/.test(els["v4-stats"].innerHTML) && els["data-row"].hidden === true);
  els["plot7a"].plotHandlers.plotly_click({ points: [{ customdata: "SIM_0001" }] });
  ok("View 7: clicking a dot switches to data mode and loads the record",
    els["E-range"].value === "0.1" && els["V0-range"].value === "3" && els["a-range"].value === "0.5", `E=${els["E-range"].value}`);
  els["d-prof"].value = "2"; els["d-load-prof"].handlers.click();
  ok("View 7: 'Load into Views 1-6' loads the chosen profile", els["E-range"].value === "4.8" && els["V0-range"].value === "5", `E=${els["E-range"].value}`);

  console.log(fails ? `\n${fails} smoke check(s) FAILED` : "\nAll smoke checks passed.");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("RUNTIME ERROR:", e); process.exit(2); });
