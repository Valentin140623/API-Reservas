"""API de Previsión de comensales.  Arrancar:  uvicorn app.main:app --reload"""
from datetime import date

from fastapi import Depends, FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .db import Base, engine, obtener_sesion
from .importar import ErrorImportacion, importar_csv
from .modelos import Reserva, TurnoDia
from .resumen import resumen

Base.metadata.create_all(engine)

app = FastAPI(title="Previsión de comensales")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["*"], allow_headers=["*"])

MAX_BYTES = 20 * 1024 * 1024


@app.get("/api/salud")
def salud():
    return {"ok": True}


@app.post("/api/importar")
async def importar(ficheros: list[UploadFile], sesion: Session = Depends(obtener_sesion)):
    resultados = []
    for f in ficheros:
        contenido = await f.read(MAX_BYTES + 1)
        if len(contenido) > MAX_BYTES:
            raise HTTPException(413, f"{f.filename}: el fichero pasa de 20 MB.")
        try:
            r = importar_csv(sesion, contenido)
        except ErrorImportacion as e:
            raise HTTPException(400, f"{f.filename}: {e}")
        resultados.append({"fichero": f.filename, **r.__dict__})
    return resultados


@app.get("/api/estado")
def estado(sesion: Session = Depends(obtener_sesion)):
    def rango(tabla):
        n, a, b = sesion.execute(select(func.count(), func.min(tabla.fecha), func.max(tabla.fecha))).one()
        return {"filas": n, "desde": a, "hasta": b}
    return {"reservas": rango(Reserva), "turnos": rango(TurnoDia)}


@app.get("/api/dias")
def dias(desde: date | None = None, hasta: date | None = None, sesion: Session = Depends(obtener_sesion)):
    return [d.__dict__ for d in resumen(sesion, desde, hasta)]
