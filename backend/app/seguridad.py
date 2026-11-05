"""Contraseñas y sesiones, solo con la librería estándar de Python.

- Contraseñas: scrypt con sal aleatoria (nunca se guarda la contraseña).
- Sesión: cookie httpOnly firmada con HMAC que caduca a los 30 días.
  La clave se lee de SECRET_KEY; si no existe, se crea una en backend/.clave (no se sube a GitHub).
"""
import base64
import hashlib
import hmac
import os
import secrets
import time
from pathlib import Path

DURACION_SESION = 30 * 24 * 3600


def _clave() -> bytes:
    if os.environ.get("SECRET_KEY"):
        return os.environ["SECRET_KEY"].encode()
    f = Path(__file__).resolve().parent.parent / ".clave"
    if not f.exists():
        f.write_text(secrets.token_hex(32))
    return f.read_text().strip().encode()


CLAVE = _clave()


def hash_contrasena(contrasena: str) -> str:
    sal = secrets.token_bytes(16)
    h = hashlib.scrypt(contrasena.encode(), salt=sal, n=2**14, r=8, p=1)
    return f"scrypt${sal.hex()}${h.hex()}"


def comprobar_contrasena(contrasena: str, guardado: str) -> bool:
    try:
        _, sal, h = guardado.split("$")
        calc = hashlib.scrypt(contrasena.encode(), salt=bytes.fromhex(sal), n=2**14, r=8, p=1)
        return hmac.compare_digest(calc.hex(), h)
    except ValueError:
        return False


def crear_token(usuario_id: int, ahora: float | None = None) -> str:
    caduca = int((ahora or time.time()) + DURACION_SESION)
    datos = f"{usuario_id}.{caduca}"
    firma = hmac.new(CLAVE, datos.encode(), hashlib.sha256).digest()
    return datos + "." + base64.urlsafe_b64encode(firma).decode().rstrip("=")


def leer_token(token: str | None, ahora: float | None = None) -> int | None:
    """Devuelve el id de usuario si el token es válido y no ha caducado."""
    if not token:
        return None
    try:
        uid, caduca, firma = token.split(".")
        esperado = base64.urlsafe_b64encode(
            hmac.new(CLAVE, f"{uid}.{caduca}".encode(), hashlib.sha256).digest()).decode().rstrip("=")
        if not hmac.compare_digest(firma, esperado) or int(caduca) < (ahora or time.time()):
            return None
        return int(uid)
    except ValueError:
        return None
