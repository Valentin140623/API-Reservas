"""Crea backend/modelos/demo.json: un modelo de demostración entrenado con reservas INVENTADAS.

Sirve para enseñar la app (GitHub Pages, tests, instalaciones nuevas) sin publicar datos reales.
Del modelo base solo se aprovechan el calendario y los festivos (información pública); vale el propio demo.json.

Uso:  python scripts/crear_modelo_demo.py <modelo_base.json> [salida.json]
"""
import json
import math
import os
import random
import sys
from datetime import date, timedelta
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite://"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import Base, Sesion, engine  # noqa: E402
from app.entrenar import entrenar  # noqa: E402
from app.importar import importar_csv  # noqa: E402

base = json.loads(Path(sys.argv[1]).read_text("utf-8"))
salida = Path(sys.argv[2] if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent / "modelos" / "demo.json")
random.seed(2024)

INICIO, EXPORTADO = date(2024, 10, 1), date(2026, 10, 22)
ini_cal = date.fromisoformat(base["calendario"]["inicio"])


def cal(f):
    return base["calendario"]["filas"][(f - ini_cal).days]


reservas = ["Fecha;Estado;Turno;Personas;Fecha Añadida"]
turnos = [';;"Restaurante Demo";"Capacidad máxima";"% Ocupación"']
f = date(2024, 1, 1)
while f <= EXPORTADO + timedelta(days=60):
    c = cal(f)
    festivo = c[6] == 1
    cerrado = f.weekday() == 0 and not festivo  # los lunes cierra
    tot = {"Comida": 0, "Cena": 0}
    if not cerrado:
        verano = 0.5 + 0.5 * math.cos((f.timetuple().tm_yday - 205) / 365 * 2 * math.pi)  # pico a finales de julio
        finde = {5: 2.3, 6: 2.0, 4: 1.3}.get(f.weekday(), 0.8)
        media = 35 * finde * (0.45 + 1.4 * verano) * (1.6 if festivo else 1.0) * (1.25 if c[11] else 1.0)
        for turno, parte in (("Comida", 0.78 - 0.25 * verano), ("Cena", 0.22 + 0.25 * verano)):
            personas = max(0, int(random.gauss(media * parte, media * parte * 0.18)))
            while personas > 0:
                p = min(personas, random.choice([2, 2, 2, 3, 4, 4, 5, 6, 8]))
                personas -= p
                antel = min(60, int(random.expovariate(1 / (3 + 8 * verano))))
                estado = random.choices(["Sentada", "Cancelado por el cliente", "No show"], [82, 14, 4])[0]
                if f >= EXPORTADO:
                    estado = "Confirmada" if estado != "Cancelado por el cliente" else estado
                anadida = f - timedelta(days=antel)
                if anadida > EXPORTADO:
                    continue
                tot[turno] += p
                if f >= INICIO:
                    reservas.append(f"{f};{estado};{turno};{p};{anadida}")
    if f <= date(2026, 9, 3):
        for turno in ("Comida", "Cena"):
            capacidad = 0 if cerrado else 250
            turnos.append(f"{f:%d-%m-%Y};{turno};{tot[turno]};{capacidad};{round(100 * tot[turno] / 250) if capacidad else 0}%")
    f += timedelta(days=1)

Base.metadata.create_all(engine)
s = Sesion()
importar_csv(s, "\n".join(reservas).encode())
importar_csv(s, "\n".join(turnos).encode())
plantilla = {"calendario": base["calendario"], "festivos": base["festivos"], "error_sin": 99,
             "especiales": {k: {"nombre": v["nombre"], "anios": []} for k, v in base["especiales"].items()}}
m = entrenar(s, plantilla, hoy=EXPORTADO + timedelta(days=13))
m["demo"] = True
m["restaurante"] = {"nombre": "Restaurante Demo", "lat": 41.39, "lon": 2.17}
salida.write_text(json.dumps(m, separators=(",", ":")), "utf-8")
print(f"OK {salida}: {len(reservas) - 1} reservas inventadas, error ±{m['error_sin']} (media {m['media_test']}/día)")
