"""Entrena con datos sintéticos (9 meses) y comprueba que el fichero de modelo es válido."""
import random
from datetime import date, timedelta

import numpy as np

from app.entrenar import HS, _predecir, entrenar
from app.importar import importar_csv
from app.main import CARPETA_MODELOS
import json


def _csv_sintetico(dias=300):
    random.seed(1)
    filas = ["Fecha;Estado;Turno;Personas;Fecha Añadida"]
    ini = date(2025, 1, 1)
    for i in range(dias):
        f = ini + timedelta(i)
        base = 30 + 40 * (f.weekday() >= 5)
        for _ in range(base // 3):
            ant = random.randint(0, 20)
            estado = random.choice(["Sentada"] * 8 + ["No show", "Cancelado por el cliente"])
            turno = "Comida" if random.random() < 0.7 else "Cena"
            filas.append(f"{f};{estado};{turno};{random.randint(2, 5)};{f - timedelta(ant)}")
    filas.append(f"{ini + timedelta(dias)};Confirmada;Comida;2;{ini + timedelta(dias)}")
    return "\n".join(filas).encode()


def test_entrenar_genera_modelo_valido(sesion):
    importar_csv(sesion, _csv_sintetico())
    actual = json.loads((CARPETA_MODELOS / "restaurante.json").read_text("utf-8"))
    m = entrenar(sesion, actual)
    assert set(m["modelos"]) == {"sin_comida", "sin_cena", "res_comida", "res_cena"}
    assert m["datos_hasta"] == "2025-10-28"
    assert set(m["error_res"]) == {str(h) for h in HS}
    assert 0 < m["error_sin"] < 100
    # el modelo exportado predice algo razonable para un sábado de junio
    fila = actual["calendario"]["filas"][(date(2026, 6, 13) - date(2024, 1, 1)).days]
    p = _predecir(m["modelos"]["sin_comida"], np.array([fila], float))[0]
    assert 10 < p < 200
    assert m["calendario"] is actual["calendario"]


def test_api_reentrenar(tmp_path, monkeypatch):
    import shutil
    from fastapi.testclient import TestClient
    import app.main as main
    from app.db import Base, engine

    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    shutil.copy(CARPETA_MODELOS / "restaurante.json", tmp_path / "restaurante.json")
    monkeypatch.setattr(main, "CARPETA_MODELOS", tmp_path)
    monkeypatch.setattr(main, "TOLERANCIA", 100)  # con datos sintéticos el error no es comparable
    c = TestClient(main.app)
    assert c.post("/api/reentrenar").status_code == 401
    c.post("/api/registro", json={"email": "a@a.es", "contrasena": "12345678"})
    c.post("/api/importar", files=[("ficheros", ("r.csv", _csv_sintetico(), "text/csv"))])
    r = c.post("/api/reentrenar")
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["aplicado"] and j["despues"]["datos_hasta"] == "2025-10-28"
    assert c.get("/api/modelo/info").json()["datos_hasta"] == "2025-10-28"
    assert len(list(tmp_path.glob("r1-*.json"))) == 1
    assert (tmp_path / "restaurante.json").exists()  # el anterior se conserva
