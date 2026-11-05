"""Importa CSV de CoverManager en una base en memoria y compara el resumen diario con el
histórico que trae el HTML original. Sirve para comprobar que las reglas de resumen.py son las buenas.

Uso:  python scripts/comparar_historico.py ../original/mi_prevision.html reservas.csv turnos.csv
"""
import json
import os
import re
import sys
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite://"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import Base, Sesion, engine  # noqa: E402
from app.importar import importar_csv  # noqa: E402
from app.resumen import resumen  # noqa: E402

html, *csvs = sys.argv[1:]
Base.metadata.create_all(engine)
s = Sesion()
for f in csvs:
    print(importar_csv(s, Path(f).read_bytes()))
H = json.loads(re.search(r'<script id="datos" type="application/json">(.*?)</script>', Path(html).read_text("utf-8"), re.S).group(1))["historico"]
dias = {d.fecha.isoformat(): d for d in resumen(s)}
cmp = [k for k in H if k in dias]
att = [k for k in cmp if H[k][0] is not None]
ok_att = [k for k in att if (dias[k].comida, dias[k].cena) == (H[k][0], H[k][1])]
ok_res = [k for k in cmp if dias[k].reservadas == H[k][2]]
ok_cerr = [k for k in cmp if dias[k].cerrado == bool(H[k][3])]
print(f"Días comparados: {len(cmp)}")
print(f"  Vinieron (comida y cena) iguales: {len(ok_att)}/{len(att)}")
print(f"  Reservadas iguales:               {len(ok_res)}/{len(cmp)}")
print(f"  Cerrado igual:                    {len(ok_cerr)}/{len(cmp)}")
for k in [k for k in att if k not in ok_att][:10]:
    print("  distinto", k, "nuevo", (dias[k].comida, dias[k].cena), "original", H[k][:2])
