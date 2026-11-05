"""Tablas. restaurante_id ya está preparado para cuando haya varios restaurantes (paso 5)."""
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class Reserva(Base):
    """Una reserva tal cual viene de CoverManager (report_reserv_stats_basic.csv)."""
    __tablename__ = "reservas"
    id: Mapped[int] = mapped_column(primary_key=True)
    restaurante_id: Mapped[int] = mapped_column(Integer, default=1)
    fecha: Mapped[date] = mapped_column(Date)
    turno: Mapped[str] = mapped_column(String(10))  # 'Comida' | 'Cena'
    estado: Mapped[str] = mapped_column(String(40))
    personas: Mapped[int] = mapped_column(Integer)
    fecha_anadida: Mapped[date | None] = mapped_column(Date, nullable=True)

    __table_args__ = (Index("ix_reservas_rest_fecha", "restaurante_id", "fecha"),)


class TurnoDia(Base):
    """Personas reservadas y capacidad por día y turno (report_persons_turn_days.csv)."""
    __tablename__ = "turnos_dia"
    restaurante_id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    fecha: Mapped[date] = mapped_column(Date, primary_key=True)
    turno: Mapped[str] = mapped_column(String(10), primary_key=True)
    personas: Mapped[int] = mapped_column(Integer)
    capacidad: Mapped[int] = mapped_column(Integer)


class Restaurante(Base):
    __tablename__ = "restaurantes"
    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(120))
    lat: Mapped[float] = mapped_column(Float)  # ubicación para la previsión del tiempo
    lon: Mapped[float] = mapped_column(Float)
    modelo: Mapped[str] = mapped_column(String(120))  # fichero en backend/modelos/


class Usuario(Base):
    __tablename__ = "usuarios"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(200), unique=True)
    contrasena: Mapped[str] = mapped_column(String(200))  # hash scrypt, nunca la contraseña
    restaurante_id: Mapped[int] = mapped_column(ForeignKey("restaurantes.id"))


class ModeloEntrenado(Base):
    """Cada reentrenamiento se guarda aquí (en la base de datos, no en disco: en la nube el disco
    se borra en cada despliegue). Se usa el más reciente; los anteriores se conservan."""
    __tablename__ = "modelos_entrenados"
    id: Mapped[int] = mapped_column(primary_key=True)
    restaurante_id: Mapped[int] = mapped_column(ForeignKey("restaurantes.id"), index=True)
    creado: Mapped[datetime] = mapped_column(DateTime)
    contenido: Mapped[str] = mapped_column(Text)  # el JSON completo del modelo
