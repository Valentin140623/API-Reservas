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
    r = c.post("/api/registro", json={"email": "Ana@Ejemplo.es", "contrasena": "contraseña1"})
    assert r.status_code == 200, r.text
    assert r.json()["restaurante"]["nombre"] == "Mi restaurante"
    assert c.get("/api/yo").json()["email"] == "ana@ejemplo.es"
    assert c.get("/api/modelo").status_code == 200
    # nadie más puede registrarse
    assert c.post("/api/registro", json={"email": "otro@x.es", "contrasena": "12345678"}).status_code == 403
    c.post("/api/logout")
    assert c.get("/api/yo").status_code == 401
    assert c.post("/api/login", json={"email": "ana@ejemplo.es", "contrasena": "mal"}).status_code == 401
    assert c.post("/api/login", json={"email": "ana@ejemplo.es", "contrasena": "contraseña1"}).status_code == 200
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


def test_primer_email(monkeypatch):
    c = nuevo_cliente()
    monkeypatch.setenv("PRIMER_EMAIL", "ana@ejemplo.es")
    assert c.post("/api/registro", json={"email": "intruso@x.es", "contrasena": "12345678"}).status_code == 403
    assert c.post("/api/registro", json={"email": "Ana@ejemplo.es", "contrasena": "12345678"}).status_code == 200


def test_sirve_la_web(tmp_path, monkeypatch):
    import importlib
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<title>web</title>")
    (tmp_path / "manifest.webmanifest").write_text("{}")
    monkeypatch.setenv("CARPETA_WEB", str(tmp_path))
    import app.main as main
    importlib.reload(main)
    c = TestClient(main.app)
    assert "web" in c.get("/").text
    assert "web" in c.get("/cualquier/ruta").text  # la web decide qué pantalla mostrar
    assert c.get("/manifest.webmanifest").text == "{}"
    assert c.get("/api/no-existe").status_code == 404
    monkeypatch.delenv("CARPETA_WEB")
    importlib.reload(main)


def test_invitar_companeros():
    c = nuevo_cliente()
    c.post("/api/registro", json={"email": "jefe@x.es", "contrasena": "12345678"})
    assert c.post("/api/usuarios", json={"email": "Ana@x.es", "contrasena": "corta"}).status_code == 400
    assert c.post("/api/usuarios", json={"email": "Ana@x.es", "contrasena": "12345678"}).status_code == 200
    assert c.post("/api/usuarios", json={"email": "ana@x.es", "contrasena": "12345678"}).status_code == 409
    assert [x["email"] for x in c.get("/api/usuarios").json()] == ["jefe@x.es", "ana@x.es"]
    ana = TestClient(app)
    assert ana.post("/api/login", json={"email": "ana@x.es", "contrasena": "12345678"}).status_code == 200
    assert ana.get("/api/yo").json()["restaurante"]["id"] == 1  # mismo restaurante
    assert c.delete("/api/usuarios/jefe@x.es").status_code == 400
    assert c.delete("/api/usuarios/ana@x.es").status_code == 200
    assert ana.get("/api/yo").status_code == 401  # ya no puede entrar
    assert TestClient(app).post("/api/usuarios", json={"email": "z@x.es", "contrasena": "12345678"}).status_code == 401
