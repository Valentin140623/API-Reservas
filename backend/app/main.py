"""API de Previsión de comensales.  Arrancar:  uvicorn app.main:app --reload"""
import json
import os
import time
from collections import defaultdict
from datetime import date
from pathlib import Path

from fastapi import Cookie, Depends, FastAPI, HTTPException, Response, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .db import Base, engine, obtener_sesion
from .entrenar import ErrorEntrenamiento, entrenar, guardar
from .importar import ErrorImportacion, importar_csv
from .modelos import Reserva, Restaurante, TurnoDia, Usuario
from .resumen import resumen
from .seguridad import DURACION_SESION, comprobar_contrasena, crear_token, hash_contrasena, leer_token

Base.metadata.create_all(engine)

app = FastAPI(title="Previsión de comensales")

MAX_BYTES = 20 * 1024 * 1024
CARPETA_MODELOS = Path(__file__).resolve().parent.parent / "modelos"
COOKIE = "sesion"


# ---------- sesión ----------
def usuario_actual(sesion_cookie: str | None = Cookie(None, alias=COOKIE), sesion: Session = Depends(obtener_sesion)) -> Usuario:
    uid = leer_token(sesion_cookie)
    u = sesion.get(Usuario, uid) if uid else None
    if not u:
        raise HTTPException(401, "Inicia sesión.")
    return u


class Credenciales(BaseModel):
    email: str
    contrasena: str


class Registro(Credenciales):
    restaurante: str = "Mi restaurante"


# Freno sencillo contra quien prueba contraseñas: 10 fallos por email cada 15 minutos.
_fallos: dict[str, list[float]] = defaultdict(list)


def _demasiados_fallos(email: str) -> bool:
    ahora = time.time()
    _fallos[email] = [t for t in _fallos[email] if ahora - t < 900]
    return len(_fallos[email]) >= 10


def _abrir_sesion(resp: Response, u: Usuario):
    # En producción (https) pon COOKIE_SEGURA=1 para que la cookie solo viaje cifrada.
    resp.set_cookie(COOKIE, crear_token(u.id), max_age=DURACION_SESION, httponly=True, samesite="lax",
                    secure=os.environ.get("COOKIE_SEGURA") == "1")


def _yo(u: Usuario, sesion: Session):
    r = sesion.get(Restaurante, u.restaurante_id)
    return {"email": u.email, "restaurante": {"id": r.id, "nombre": r.nombre, "lat": r.lat, "lon": r.lon}}


@app.get("/api/salud")
def salud():
    return {"ok": True}


@app.get("/api/primera-vez")
def primera_vez(sesion: Session = Depends(obtener_sesion)):
    """True si todavía no hay ninguna cuenta: la web enseña "Crear cuenta" en vez de "Entrar"."""
    return {"primera_vez": sesion.scalar(select(func.count()).select_from(Usuario)) == 0}


@app.post("/api/registro")
def registro(datos: Registro, resp: Response, sesion: Session = Depends(obtener_sesion)):
    """Solo funciona para la primera cuenta. Más adelante el alta de clientes será otra cosa (paso 5)."""
    if sesion.scalar(select(func.count()).select_from(Usuario)):
        raise HTTPException(403, "Ya hay una cuenta creada. Inicia sesión.")
    email = datos.email.strip().lower()
    if "@" not in email or len(datos.contrasena) < 8:
        raise HTTPException(400, "Pon un email válido y una contraseña de al menos 8 caracteres.")
    r = sesion.get(Restaurante, 1) or Restaurante(id=1, nombre=datos.restaurante.strip() or "Mi restaurante", lat=41.31, lon=2.01, modelo="restaurante.json")
    sesion.add(r)
    sesion.flush()
    u = Usuario(email=email, contrasena=hash_contrasena(datos.contrasena), restaurante_id=r.id)
    sesion.add(u)
    sesion.commit()
    _abrir_sesion(resp, u)
    return _yo(u, sesion)


@app.post("/api/login")
def login(datos: Credenciales, resp: Response, sesion: Session = Depends(obtener_sesion)):
    email = datos.email.strip().lower()
    if _demasiados_fallos(email):
        raise HTTPException(429, "Demasiados intentos. Espera 15 minutos.")
    u = sesion.scalar(select(Usuario).where(Usuario.email == email))
    if not u or not comprobar_contrasena(datos.contrasena, u.contrasena):
        _fallos[email].append(time.time())
        raise HTTPException(401, "Email o contraseña incorrectos.")
    _abrir_sesion(resp, u)
    return _yo(u, sesion)


@app.post("/api/logout")
def logout(resp: Response):
    resp.delete_cookie(COOKIE)
    return {"ok": True}


@app.get("/api/yo")
def yo(u: Usuario = Depends(usuario_actual), sesion: Session = Depends(obtener_sesion)):
    return _yo(u, sesion)


# ---------- datos del restaurante (todo filtrado por el restaurante del usuario) ----------
@app.get("/api/modelo")
def modelo(u: Usuario = Depends(usuario_actual), sesion: Session = Depends(obtener_sesion)):
    r = sesion.get(Restaurante, u.restaurante_id)
    f = (CARPETA_MODELOS / Path(r.modelo).name)
    if not f.exists():
        raise HTTPException(404, "Este restaurante todavía no tiene modelo entrenado.")
    return FileResponse(f, media_type="application/json", headers={"Cache-Control": "no-store"})


@app.post("/api/importar")
async def importar(ficheros: list[UploadFile], u: Usuario = Depends(usuario_actual), sesion: Session = Depends(obtener_sesion)):
    resultados = []
    for f in ficheros:
        contenido = await f.read(MAX_BYTES + 1)
        if len(contenido) > MAX_BYTES:
            raise HTTPException(413, f"{f.filename}: el fichero pasa de 20 MB.")
        try:
            r = importar_csv(sesion, contenido, restaurante_id=u.restaurante_id)
        except ErrorImportacion as e:
            raise HTTPException(400, f"{f.filename}: {e}")
        resultados.append({"fichero": f.filename, **r.__dict__})
    return resultados


@app.get("/api/estado")
def estado(u: Usuario = Depends(usuario_actual), sesion: Session = Depends(obtener_sesion)):
    def rango(tabla):
        n, a, b = sesion.execute(select(func.count(), func.min(tabla.fecha), func.max(tabla.fecha))
                                 .where(tabla.restaurante_id == u.restaurante_id)).one()
        return {"filas": n, "desde": a, "hasta": b}
    return {"reservas": rango(Reserva), "turnos": rango(TurnoDia)}


@app.get("/api/dias")
def dias(desde: date | None = None, hasta: date | None = None, u: Usuario = Depends(usuario_actual), sesion: Session = Depends(obtener_sesion)):
    return [d.__dict__ for d in resumen(sesion, desde, hasta, restaurante_id=u.restaurante_id)]


# ---------- modelo: información y reentrenamiento ----------
# Si el modelo nuevo se equivoca más de un 15 % que el actual, no se cambia.
TOLERANCIA = 1.15


def _cargar_modelo(r: Restaurante) -> dict | None:
    f = CARPETA_MODELOS / Path(r.modelo).name
    return json.loads(f.read_text("utf-8")) if f.exists() else None


def _resumen_modelo(m: dict) -> dict:
    return {k: m[k] for k in ("generado", "datos_hasta", "error_sin", "media_test", "error_res")} | {
        "dias": len(m["historico"])}


@app.get("/api/modelo/info")
def modelo_info(u: Usuario = Depends(usuario_actual), sesion: Session = Depends(obtener_sesion)):
    m = _cargar_modelo(sesion.get(Restaurante, u.restaurante_id))
    if not m:
        raise HTTPException(404, "Este restaurante todavía no tiene modelo entrenado.")
    return _resumen_modelo(m)


@app.post("/api/reentrenar")
def reentrenar(u: Usuario = Depends(usuario_actual), sesion: Session = Depends(obtener_sesion)):
    r = sesion.get(Restaurante, u.restaurante_id)
    actual = _cargar_modelo(r)
    if not actual:
        raise HTTPException(400, "Hace falta un modelo de partida (con el calendario y los festivos).")
    try:
        nuevo = entrenar(sesion, actual, restaurante_id=r.id)
    except ErrorEntrenamiento as e:
        raise HTTPException(400, str(e))
    aplicado = nuevo["error_sin"] <= actual["error_sin"] * TOLERANCIA
    if aplicado:
        nombre = f"r{r.id}-{nuevo['generado']}-{int(time.time())}.json"
        guardar(nuevo, CARPETA_MODELOS / nombre)  # los modelos anteriores se conservan
        r.modelo = nombre
        sesion.commit()
    return {"aplicado": aplicado, "antes": _resumen_modelo(actual), "despues": _resumen_modelo(nuevo)}
