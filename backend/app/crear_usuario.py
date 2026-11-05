"""Crear un usuario a mano.  Uso:  .venv\\Scripts\\python -m app.crear_usuario email@ejemplo.com [restaurante_id]"""
import getpass
import sys

from .db import Base, Sesion, engine
from .modelos import Restaurante, Usuario
from .seguridad import hash_contrasena

Base.metadata.create_all(engine)
email = sys.argv[1].strip().lower()
rid = int(sys.argv[2]) if len(sys.argv) > 2 else 1
with Sesion() as s:
    if not s.get(Restaurante, rid):
        sys.exit(f"No existe el restaurante {rid}. Crea la primera cuenta desde la web.")
    c = getpass.getpass("Contraseña (mínimo 8): ")
    if len(c) < 8:
        sys.exit("Contraseña demasiado corta.")
    s.add(Usuario(email=email, contrasena=hash_contrasena(c), restaurante_id=rid))
    s.commit()
print("Usuario creado:", email)
