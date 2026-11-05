from datetime import date

import pytest

from app.importar import ErrorImportacion, importar_csv
from app.resumen import resumen

RESERVAS = """﻿Fecha;Estado;Turno;Personas;Fecha Añadida
2026-07-12;Sentada;Comida;4;2026-07-01
2026-07-12;Cancelado por el cliente;Comida;6;2026-07-02
2026-07-12;No show;Cena;2;2026-07-10
2026-07-12;Llegada;Cena;3;2026-07-12
2026-07-12;Sentada;Comida;60;2026-05-01
2026-07-13;Confirmada;Comida;2;2026-07-11
""".encode()

TURNOS = """﻿;;"Mi Restaurante";"Capacidad máxima";"% Ocupación"
12-07-2026;Comida;70;253;28%
12-07-2026;Cena;5;253;2%
13-07-2026;Comida;0;0;0%
13-07-2026;Cena;0;0;0%
""".encode()


def test_detecta_e_importa_los_dos_informes(sesion):
    r = importar_csv(sesion, RESERVAS)
    assert (r.tipo, r.filas, r.desde, r.hasta) == ("reservas", 6, date(2026, 7, 12), date(2026, 7, 13))
    t = importar_csv(sesion, TURNOS)
    assert (t.tipo, t.filas) == ("turnos", 4)


def test_resumen_diario(sesion):
    importar_csv(sesion, RESERVAS)
    importar_csv(sesion, TURNOS)
    d12, d13 = resumen(sesion)
    assert (d12.comida, d12.cena) == (4, 3)  # sin cancelados, no shows ni el evento de 60
    assert d12.eventos == 60
    assert d12.reservadas == 75 - 60
    assert not d12.cerrado
    assert d13.cerrado


def test_reimportar_no_duplica(sesion):
    importar_csv(sesion, RESERVAS)
    importar_csv(sesion, RESERVAS)
    importar_csv(sesion, TURNOS)
    importar_csv(sesion, TURNOS)
    assert resumen(sesion)[0].comida == 4


def test_csv_desconocido(sesion):
    with pytest.raises(ErrorImportacion):
        importar_csv(sesion, b"nombre;telefono\nPepe;600000000\n")
