"""Independent reference values for the Through the Barrier app.

Mirrors the equations of the Python prototype notebook (Eqs. 5 and 7 of the
approved proposal) using only the standard library, then writes
reference.json, which tests/test_physics.js compares against physics.js.

Run:  python tests/make_reference.py
"""
import json, math, os

HBAR = 1.054571817e-34
M_E = 9.1093837015e-31
EV = 1.602176634e-19
NM = 1e-9


def T(E_eV, V0_eV, a_nm):
    E, V0, a = E_eV * EV, V0_eV * EV, a_nm * NM
    if math.isclose(E, V0, rel_tol=1e-10):
        return 1 / (1 + M_E * V0 * a * a / (2 * HBAR ** 2))
    if E < V0:
        kap = math.sqrt(2 * M_E * (V0 - E)) / HBAR
        return 1 / (1 + V0 ** 2 * math.sinh(kap * a) ** 2 / (4 * E * (V0 - E)))
    q = math.sqrt(2 * M_E * (E - V0)) / HBAR
    return 1 / (1 + V0 ** 2 * math.sin(q * a) ** 2 / (4 * E * (E - V0)))


cases = [
    ("Tunneling (proposal default)", 8.0, 10.0, 0.10),
    ("Wide barrier", 8.0, 10.0, 0.50),
    ("Threshold E=V0", 10.0, 10.0, 0.10),
    ("Above barrier", 12.0, 10.0, 0.10),
    ("Near threshold E->V0-", 9.9, 10.0, 0.10),
    ("Very thin", 8.0, 10.0, 0.01),
    ("High barrier", 8.0, 16.0, 0.10),
]
out = [{"name": n, "E": E, "V0": V0, "a": a, "T": T(E, V0, a)} for n, E, V0, a in cases]
path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "reference.json")
with open(path, "w") as f:
    json.dump(out, f, indent=2)
for r in out:
    print(f"{r['name']:32s} E={r['E']:5.1f} V0={r['V0']:5.1f} a={r['a']:.2f}  T={r['T']:.10g}")
print("wrote", path)
