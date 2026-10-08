# Through the Barrier

An interactive quantum tunneling explainer for CPS 5745.

This project helps people understand a simple question:

> If a particle does not have enough classical energy to cross a barrier, why can quantum mechanics still give it a chance to pass through?

The app uses a one-dimensional rectangular barrier model. It lets users change particle energy, barrier height, and barrier width, then shows how those choices affect reflection and transmission.

## Open the App

From this folder:

```bash
python -m http.server 8765
```

Then open:

```text
http://localhost:8765/index.html
```

No install or build step is required. The app uses Plotly from a CDN, so internet access is needed for the charts.

## What the Views Do

1. **Classical expectation**  
   Shows what classical physics would predict: pass through or reflect.

2. **Quantum wavefunction**  
   Shows the wave behavior that makes tunneling possible.

3. **Relative probability density**  
   Shows where the wave is larger or smaller around the barrier.

4. **Reflection versus transmission**  
   Gives the main answer in plain English: out of 100 simulated particles, how many reflect from the barrier and how many pass through.

5. **Barrier parameter explorer**  
   Shows how changing barrier height and width changes transmission. The 2D heatmap is the accurate click/load view.

6. **Scenario comparison**  
   Compares two saved cases, A and B, and explains which one allows more tunneling.

7. **Dataset cross-check**  
   Compares the live model against saved simulation records from the tunneling portion of my separate **Quantum Gatekeeper** dataset.

## Important Note About Quantum Gatekeeper

The Quantum Gatekeeper data used here is a local simulation dataset. It is used only as an independent check that this app's tunneling model produces the same results as saved simulation records.

This app does **not** send data to Quantum Gatekeeper, IBM Quantum, or any external hardware.

In this project:

- **Reflection** means the simulated particle is predicted to reflect from the barrier.
- **Transmission** means the simulated particle is predicted to pass through the barrier.
- These words describe physics outcomes, not data being sent somewhere and returned.

The IBM Quantum hardware records from Quantum Gatekeeper are not included in this app.

## Files

| File or folder | Purpose |
| --- | --- |
| `index.html` | Page structure |
| `style.css` | Light visual design and layout |
| `app.js` | Interactive views, controls, dataset mode, and live checks |
| `physics.js` | Quantum tunneling equations and wavefunction solver |
| `csv.js` | Small CSV parser for dataset loading |
| `datasets/` | Saved Quantum Gatekeeper tunneling simulation records |
| `tests/` | Physics, dataset, and smoke tests |

## Run Checks

```bash
node tests/test_physics.js
node tests/test_datasets.js
node tests/smoke_app.js
```

Expected result: all tests pass.

## Project Result

The app shows that the live tunneling model agrees with the saved Quantum Gatekeeper simulation records. This supports that the equations, implementation, and dataset interpretation are consistent.

For the selected dataset states, the app recomputes transmission and reflection locally and compares them with the saved records.
