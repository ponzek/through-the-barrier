# Datasets — from *Quantum Gatekeeper* (a different project)

**Citation:** Ponze, K. (2026). *Quantum Gatekeeper* [unpublished research dataset].

*Quantum Gatekeeper* is an unpublished research dataset created by Karina Ponze (2026). It
combines numerical quantum-tunneling simulations with quantum-hardware execution records. The
tunneling portion contains parameterized barrier-scattering data and spatial wavefunction
profiles; the hardware portion contains IBM Quantum execution metrics and measurement results.
It was developed for research, experimentation, and scientific visualization.

These files were **not created for the Through the Barrier midterm**. They come from that separate
project, and only the **tunneling-simulation portion** is used here, as an independent
cross-check of the model in `physics.js`. The IBM Quantum hardware records are not included.

## Files

| File | Rows | Contents |
|---|---|---|
| `quantum_tunneling_summary.csv` | 1,200 | One record per simulation: energy, barrier height/width, regime (`tunneling`, `over_barrier`, `resonance`), T, R, decay/wave constant, incident wavenumber |
| `quantum_tunneling_wavefunction_profiles.csv` | 2,000 | 8 scenarios × 250 positions: ψ (real, imaginary, amplitude, phase), probability density, potential, spatial region |

## Conventions

- **Units:** dimensionless natural units (ħ = m = 1, so k = √(2E)). The main app (Views 1–6) uses an electron in eV and nm. T depends only on the dimensionless combination κa, so the same equations apply.
- **"resonance"** = over-barrier record with T > 0.99.
- Wavefunctions use incident amplitude 1, so |ψ|² is a *relative* density.
- Grid: V₀ ∈ {3, 5, 7}, a ∈ {0.5, 1.0, 1.5, 2.0}, E = 0.1 … 10.0 in steps of 0.1 (3 × 4 × 100 = 1,200).

## How it is used and checked

Run `node tests/test_datasets.js`. Result: the live model reproduces every recorded T to within
1.3 × 10⁻⁵ (rounding), T + R = 1 in all records, no values missing, and the model's complex ψ
matches all 2,000 profile points to within about 3 × 10⁻⁴.
