# Through the Barrier — An Interactive Story of Quantum Tunneling

CPS 5745 Midterm Project · Karina Ponze · Kean University

A six-view interactive scientific story (classical expectation → wavefunction → relative
probability density → reflection vs. transmission → parameter explorer → scenario comparison)
for a 1D finite rectangular barrier. Implements the approved proposal (CPS5745_Wk3As3.pdf).

## Launch

No build step and no install. Needs internet only for the Plotly CDN and Google Fonts.

```
cd app
python -m http.server 8765
# open http://localhost:8765/index.html
```

Opening `index.html` directly in a browser also works. For the hosted version, push the `app/`
folder to GitHub Pages (Settings → Pages → deploy from branch → `/app` or move files to `/docs`).

## Files

| File | Purpose |
|---|---|
| `index.html`, `style.css` | Page structure and design |
| `physics.js` | Model: Eq. (5), (7), complex 4×4 boundary solve, ψ(x), validation |
| `app.js` | The six views, linked controls, animation, scenarios, live verification |
| `tests/make_reference.py` | Independent stdlib-Python reference values (mirrors the notebook) |
| `tests/test_physics.js` | Node test: JS vs. Python reference, R+T=1, boundary cases |
| `../Through_the_Barrier_Quantum_Tunneling.ipynb` | Original Python prototype / reference |

## Data / model workflow

User parameters (E, V₀, a) → validation → solve 4×4 complex boundary-condition system (A=1) →
ψ(x), |ψ|², R=|B|², T=|F|² → cross-check against closed-form T → six linked plots.
No observational data: it is a documented scientific simulation (equations on the page).

## Run the tests

```
python tests/make_reference.py
node tests/test_physics.js
```

The same checks (plus a 400-state random R+T=1 sweep) also run live at the bottom of the page.

## Interactions

1. Change E, V₀, a with sliders or validated number boxes (invalid input is reported, not replaced).
2. Inspect values: hover on any plot, heatmap/surface, or read the stat panels.
3. Compare scenarios: save A/B, load presets, log-scale toggle.
4. Reset (parameters), Play/Pause/Step/Phase-0 (View 2 phase animation, shared with View 6).
5. Click the View 5 heatmap to move the marker (sets V₀ and a). 2D/3D toggle.
