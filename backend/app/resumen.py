"""Resumen diario: lo que el modelo necesita para aprender (personas que vinieron por turno).

Reglas (reproducen el histórico del HTML original en ~98% de los días):
  - Vinieron = personas de reservas en un estado de "asistencia" (Sentada, Llegada, Confirmada...).
  - Los eventos (reservas de EVENTO_MIN personas o más) no cuentan: se suman aparte.
  - Reservadas = personas reservadas del informe por turno (incluye cancelaciones), sin eventos.
    Si ese día no está en el informe por turno, se suman todas las reservas detalladas.
  - Cerrado = capacidad 0 en comida y en cena.
"""
from collections import defaultdict
from dataclasses import dataclass
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .modelos import Reserva, TurnoDia

EVENTO_MIN = 50
ESTADOS_ASISTENCIA = {
    "Sentada", "Llegada", "Llegada Barra", "Cuenta solicitada", "Liberada", "Confirmada", "Reconfirmada",
}


@dataclass
class Dia:
    fecha: date
    comida: int | None  # None = no hay reservas detalladas ese día
    cena: int | None
    reservadas: int
    eventos: int
    cerrado: bool


def resumen(sesion: Session, desde: date | None = None, hasta: date | None = None, restaurante_id: int = 1) -> list[Dia]:
    def rango(q, tabla):
        q = q.where(tabla.restaurante_id == restaurante_id)
        if desde:
            q = q.where(tabla.fecha >= desde)
        if hasta:
            q = q.where(tabla.fecha <= hasta)
        return q

    vinieron: dict[date, list[int]] = defaultdict(lambda: [0, 0])
    eventos: dict[date, int] = defaultdict(int)
    reservadas_detalle: dict[date, int] = defaultdict(int)
    for r in sesion.scalars(rango(select(Reserva), Reserva)):
        if r.personas >= EVENTO_MIN:
            eventos[r.fecha] += r.personas
            continue
        reservadas_detalle[r.fecha] += r.personas
        if r.estado in ESTADOS_ASISTENCIA:
            vinieron[r.fecha][0 if r.turno == "Comida" else 1] += r.personas
    # desde la primera reserva detallada, un día sin reservas es un 0 real (no "sin datos")
    inicio_detalle = sesion.scalar(select(func.min(Reserva.fecha)).where(Reserva.restaurante_id == restaurante_id))

    reservadas: dict[date, int] = defaultdict(int)
    capacidad: dict[date, int] = defaultdict(int)
    for t in sesion.scalars(rango(select(TurnoDia), TurnoDia)):
        reservadas[t.fecha] += t.personas
        capacidad[t.fecha] += t.capacidad

    dias = []
    for f in sorted(set(vinieron) | set(eventos) | set(reservadas_detalle) | set(reservadas)):
        v = vinieron[f] if inicio_detalle and f >= inicio_detalle else [None, None]
        dias.append(Dia(
            fecha=f, comida=v[0], cena=v[1],
            reservadas=max(0, reservadas[f] - eventos[f]) if f in reservadas else reservadas_detalle[f],
            eventos=eventos[f],
            cerrado=f in capacidad and capacidad[f] == 0,
        ))
    return dias
