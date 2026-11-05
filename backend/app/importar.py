"""Lectura de los CSV que exporta CoverManager.

Se reconocen dos informes:
  - Reservas  (report_reserv_stats_basic): Fecha;Estado;Turno;Personas;Fecha Añadida
  - Personas por turno (report_persons_turn_days): DD-MM-AAAA;Turno;Personas;Capacidad;% Ocupación

Importar es idempotente: al subir un fichero se sustituyen los datos de las fechas que cubre,
así que volver a subir el mismo CSV (o uno más reciente que se solape) no duplica nada.
"""
import csv
import io
from dataclasses import dataclass
from datetime import date, datetime

from sqlalchemy import delete
from sqlalchemy.orm import Session

from .modelos import Reserva, TurnoDia

TURNOS = {"comida": "Comida", "cena": "Cena"}


class ErrorImportacion(ValueError):
    pass


@dataclass
class Resultado:
    tipo: str  # 'reservas' | 'turnos'
    filas: int
    desde: date
    hasta: date
    ignoradas: int


def _texto(contenido: bytes) -> str:
    for cod in ("utf-8-sig", "cp1252"):
        try:
            return contenido.decode(cod)
        except UnicodeDecodeError:
            continue
    raise ErrorImportacion("No puedo leer el fichero: codificación desconocida.")


def _fecha(s: str) -> date:
    s = s.strip()
    for formato in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(s, formato).date()
        except ValueError:
            continue
    raise ValueError(f"fecha no válida: {s!r}")


def _turno(s: str) -> str:
    t = TURNOS.get(s.strip().lower())
    if not t:
        raise ValueError(f"turno no válido: {s!r}")
    return t


def detectar(filas: list[list[str]]) -> str:
    cab = [c.strip().lower() for c in filas[0]] if filas else []
    if cab[:4] == ["fecha", "estado", "turno", "personas"]:
        return "reservas"
    if len(cab) >= 4 and "capacidad" in " ".join(cab):
        return "turnos"
    raise ErrorImportacion(
        "No reconozco este CSV. Sube el informe de reservas (report_reserv_stats_basic) "
        "o el de personas por turno (report_persons_turn_days) de CoverManager."
    )


def importar_csv(sesion: Session, contenido: bytes, restaurante_id: int = 1) -> Resultado:
    filas = list(csv.reader(io.StringIO(_texto(contenido)), delimiter=";"))
    tipo = detectar(filas)
    objetos, ignoradas = [], 0
    for fila in filas[1:]:
        if not any(c.strip() for c in fila):
            continue
        try:
            if tipo == "reservas":
                objetos.append(Reserva(
                    restaurante_id=restaurante_id, fecha=_fecha(fila[0]), estado=fila[1].strip(),
                    turno=_turno(fila[2]), personas=int(fila[3] or 0),
                    fecha_anadida=_fecha(fila[4]) if len(fila) > 4 and fila[4].strip() else None,
                ))
            else:
                objetos.append(TurnoDia(
                    restaurante_id=restaurante_id, fecha=_fecha(fila[0]), turno=_turno(fila[1]),
                    personas=int(fila[2] or 0), capacidad=int(fila[3] or 0),
                ))
        except (ValueError, IndexError):
            ignoradas += 1
    if not objetos:
        raise ErrorImportacion("El fichero no tiene ninguna fila válida.")

    desde = min(o.fecha for o in objetos)
    hasta = max(o.fecha for o in objetos)
    tabla = Reserva if tipo == "reservas" else TurnoDia
    sesion.execute(delete(tabla).where(
        tabla.restaurante_id == restaurante_id, tabla.fecha >= desde, tabla.fecha <= hasta))
    if tipo == "turnos":
        # por si el CSV trae la misma fecha y turno dos veces: gana la última
        objetos = list({(o.fecha, o.turno): o for o in objetos}.values())
    sesion.add_all(objetos)
    sesion.commit()
    return Resultado(tipo=tipo, filas=len(objetos), desde=desde, hasta=hasta, ignoradas=ignoradas)
