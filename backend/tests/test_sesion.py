from fastapi.testclient import TestClient

from app import seguridad
from app.main import app
from app.db import Base, engine
from tests.test_importar import RESERVAS


def nuevo_cliente():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    return TestClient(app)


def test_contrasenas_y_tokens():
    h = seguridad.hash_contrasena("secreta123")
    assert "secreta123" not in h
    assert seguridad.comprobar_contrasena("secreta123", h)
    assert not seguridad.comprobar_contrasena("otra", h)
    t = seguridad.crear_token(7, ahora=1000)
    assert seguridad.leer_token(t, ahora=2000) == 7
    assert seguridad.leer_token(t, ahora=1000 + seguridad.DURACION_SESION + 1) is None
    assert seguridad.leer_token(t[:-2] + "xx", ahora=2000) is None
    assert seguridad.leer_token("8" + t[1:], ahora=2000) is None


def test_sin_sesion_no_se_ve_nada():
    c = nuevo_cliente()
    for url in ["/api/modelo", "/api/estado", "/api/dias", "/api/yo"]:
        assert c.get(url).status_code == 401, url
    assert c.post("/api/importar", files=[("ficheros", ("r.csv", RESERVAS, "text/csv"))]).status_code == 401


def test_primera_cuenta_login_y_logout():
    c = nuevo_cliente()
    assert c.get("/api/primera-vez").json() == {"primera_vez": True}
    r = c.post("/api/registro", json={"email": "Valen@restaurante.es", "contrasena": "contraseña1"})
    assert r.status_code == 200, r.text
    assert r.json()["restaurante"]["nombre"] == "Mi restaurante"
    assert c.get("/api/yo").json()["email"] == "valen@restaurante.es"
    assert c.get("/api/modelo").status_code == 200
    # nadie más puede registrarse
    assert c.post("/api/registro", json={"email": "otro@x.es", "contrasena": "12345678"}).status_code == 403
    c.post("/api/logout")
    assert c.get("/api/yo").status_code == 401
    assert c.post("/api/login", json={"email": "valen@restaurante.es", "contrasena": "mal"}).status_code == 401
    assert c.post("/api/login", json={"email": "valen@restaurante.es", "contrasena": "contraseña1"}).status_code == 200
    assert c.get("/api/estado").status_code == 200


def test_cada_restaurante_ve_lo_suyo():
    from app.db import Sesion
    from app.modelos import Restaurante, Usuario
    c = nuevo_cliente()
    c.post("/api/registro", json={"email": "a@a.es", "contrasena": "12345678"})
    c.post("/api/importar", files=[("ficheros", ("r.csv", RESERVAS, "text/csv"))])
    with Sesion() as s:
        s.add(Restaurante(id=2, nombre="Otro", lat=0, lon=0, modelo="no-existe.json"))
        s.add(Usuario(email="b@b.es", contrasena=seguridad.hash_contrasena("12345678"), restaurante_id=2))
        s.commit()
    c2 = TestClient(app)
    c2.post("/api/login", json={"email": "b@b.es", "contrasena": "12345678"})
    assert c2.get("/api/estado").json()["reservas"]["filas"] == 0
    assert c2.get("/api/dias").json() == []
    assert c2.get("/api/modelo").status_code == 404
    assert c.get("/api/estado").json()["reservas"]["filas"] == 6
