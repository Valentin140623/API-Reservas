"""Reentrenar el modelo de previsión con los datos importados de CoverManager.

Genera el mismo formato de fichero que usa la web (backend/modelos/*.json):
  - sin_comida / sin_cena: LightGBM poisson con variables de calendario -> personas que vienen.
  - res_comida / res_cena: LightGBM l1 con calendario + reservas ya hechas + días de antelación
    -> personas NUEVAS que se sumarán a las ya reservadas.

El calendario (festivos, puentes, vacaciones...) se reutiliza del modelo actual (va hasta 2040).
Se evalúa con los últimos 6 meses (entrenando solo con lo anterior) y después se entrena con todo.
"""
from __future__ import annotations

import json
import math
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta

import lightgbm as lgb
import numpy as np
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .modelos import Reserva, TurnoDia
from .resumen import ESTADOS_ASISTENCIA, EVENTO_MIN, resumen

HS = [0, 1, 2, 3, 4, 5, 6, 7, 10, 14, 21, 30, 45, 60]
COLS_CAL = ["dia_semana", "mes", "dia_mes", "semana_anio", "dia_anio_sin", "dia_anio_cos", "festivo",
            "vispera_festivo", "post_festivo", "puente", "bloque_libre", "vacaciones_escolares"]
COLS_RES = COLS_CAL + ["libro_comida", "libro_cena", "libro_total", "h"]
DIAS_TEST = 182
PARAMS = {"learning_rate": 0.03, "num_leaves": 15, "min_data_in_leaf": 10, "feature_fraction": 0.9,
          "bagging_fraction": 0.9, "bagging_freq": 1, "lambda_l2": 1.0, "verbose": -1, "seed": 7,
          "num_threads": 2}
N_ARBOLES = 400


class ErrorEntrenamiento(ValueError):
    pass


@dataclass
class Dataset:
    X: np.ndarray
    y: np.ndarray
    fechas: list[date]
    h: list[int] | None = None


# ---------- utilidades ----------
def _fila_cal(cal: dict, f: date):
    ini = date.fromisoformat(cal["inicio"])
    i = (f - ini).days
    return cal["filas"][i] if 0 <= i < len(cal["filas"]) else None


def _exportar(booster: lgb.Booster, obj: str) -> dict:
    """Árboles de LightGBM -> listas anidadas [feature, umbral, izq_por_defecto, missing, izq, der] | hoja."""
    def nodo(n):
        if "leaf_value" in n:
            return n["leaf_value"]
        return [n["split_feature"], n["threshold"], 1 if n["default_left"] else 0, n["missing_type"],
                nodo(n["left_child"]), nodo(n["right_child"])]
    dump = booster.dump_model()
    return {"obj": obj, "trees": [nodo(t["tree_structure"]) for t in dump["tree_info"]],
            "cols": dump["feature_names"]}


def _predecir(m: dict, X: np.ndarray) -> np.ndarray:
    """Igual que el motor de la web (src/motor/arboles.ts), para comprobar la exportación."""
    def arbol(n, x):
        while isinstance(n, list):
            v = x[n[0]]
            if n[3] == "NaN" and math.isnan(v):
                izq = n[2] == 1
            elif n[3] == "Zero" and (v == 0 or math.isnan(v)):
                izq = n[2] == 1
            else:
                izq = (0 if math.isnan(v) else v) <= n[1]
            n = n[4] if izq else n[5]
        return n
    s = np.array([sum(arbol(t, x) for t in m["trees"]) for x in X])
    return np.exp(s) if m["obj"] == "poisson" else s


def _entrenar(X, y, obj: str, n=N_ARBOLES) -> dict:
    p = {**PARAMS, "objective": "poisson" if obj == "poisson" else "l1"}
    b = lgb.train(p, lgb.Dataset(X, y, feature_name=COLS_CAL if X.shape[1] == len(COLS_CAL) else COLS_RES,
                                 free_raw_data=False), num_boost_round=n)
    return _exportar(b, obj)


# ---------- datos ----------
def cuenta_como_reservada(estado: str) -> bool:
    """Qué reservas cuentan como "ya reservadas" al entrenar.

    No sabemos cuándo se canceló cada reserva, así que contamos las que acabaron viniendo.
    Es lo que hacía el modelo original y da el menor error (probado con datos reales).
    """
    return estado in ESTADOS_ASISTENCIA


def fecha_exportacion(sesion: Session, restaurante_id: int) -> date | None:
    """Día en que se exportó el CSV (la reserva más reciente que se hizo). A partir de ahí los
    días todavía no han pasado: sus reservas "Confirmada" no son asistencia real."""
    return sesion.scalar(select(func.max(Reserva.fecha_anadida)).where(Reserva.restaurante_id == restaurante_id))


def preparar(sesion: Session, cal: dict, restaurante_id: int):
    hasta = fecha_exportacion(sesion, restaurante_id)
    dias = [d for d in resumen(sesion, restaurante_id=restaurante_id)
            if d.comida is not None and not d.cerrado and hasta and d.fecha < hasta]
    if len(dias) < 120:
        raise ErrorEntrenamiento(f"Hacen falta al menos 120 días con reservas detalladas (hay {len(dias)}).")
    dias = [d for d in dias if _fila_cal(cal, d.fecha) is not None]

    # modelos "sin reservas": calendario -> personas que vinieron
    sin = {t: Dataset(np.array([_fila_cal(cal, d.fecha) for d in dias], float),
                      np.array([getattr(d, t) for d in dias], float), [d.fecha for d in dias])
           for t in ("comida", "cena")}

    # modelos "con reservas": para cada día y antelación h, lo que había reservado h días antes
    por_dia: dict[date, list[tuple[date | None, str, int]]] = defaultdict(list)
    q = select(Reserva).where(Reserva.restaurante_id == restaurante_id)
    for r in sesion.scalars(q):
        if r.personas < EVENTO_MIN and cuenta_como_reservada(r.estado):
            por_dia[r.fecha].append((r.fecha_anadida, r.turno, r.personas))
    filas, yc, yn, fechas, hs = [], [], [], [], []
    for d in dias:
        base = _fila_cal(cal, d.fecha)
        for h in HS:
            corte = d.fecha - timedelta(days=h)
            rc = sum(p for fa, t, p in por_dia[d.fecha] if t == "Comida" and fa and fa <= corte)
            rn = sum(p for fa, t, p in por_dia[d.fecha] if t == "Cena" and fa and fa <= corte)
            filas.append(base + [rc, rn, rc + rn, h])
            yc.append(d.comida - rc)
            yn.append(d.cena - rn)
            fechas.append(d.fecha)
            hs.append(h)
    X = np.array(filas, float)
    res = {"comida": Dataset(X, np.array(yc, float), fechas, hs), "cena": Dataset(X, np.array(yn, float), fechas, hs)}
    return dias, sin, res


def _especiales(sesion: Session, actuales: dict, restaurante_id: int) -> dict:
    """Recalcula lo que vino cada año en los días especiales (Nochebuena, San Valentín...)."""
    vinieron = {d.fecha: (d.comida, d.cena) for d in resumen(sesion, restaurante_id=restaurante_id)}
    turnos = defaultdict(lambda: [0, 0])
    for t in sesion.scalars(select(TurnoDia).where(TurnoDia.restaurante_id == restaurante_id)):
        turnos[t.fecha][0 if t.turno == "Comida" else 1] += t.personas
    # para años sin reservas detalladas solo hay "reservadas" (con cancelaciones): se corrige con
    # la proporción real de gente que acaba viniendo
    res_tot = sum(sum(turnos[f]) for f, v in vinieron.items() if v[0] is not None and f in turnos)
    vin_tot = sum(v[0] + v[1] for f, v in vinieron.items() if v[0] is not None and f in turnos)
    ratio = vin_tot / res_tot if res_tot else 1.0
    out = {}
    for k, e in actuales.items():
        anios = []
        for a in sorted({f.year for f in list(vinieron) + list(turnos)}):
            try:
                f = date.fromisoformat(f"{a}-{k}")
            except ValueError:
                continue
            v = vinieron.get(f)
            if v and v[0] is not None:
                c, n = v
            elif f in turnos:
                c, n = (round(x * ratio) for x in turnos[f])
            else:
                continue
            if c or n:
                anios.append([a, c, n])
        out[k] = {"nombre": e["nombre"], "anios": anios or e["anios"]}
    return out


# ---------- entrenamiento completo ----------
def entrenar(sesion: Session, actual: dict, restaurante_id: int = 1, hoy: date | None = None) -> dict:
    """Devuelve un fichero de modelo nuevo (dict) con sus errores medidos en los últimos 6 meses."""
    cal = actual["calendario"]
    dias, sin, res = preparar(sesion, cal, restaurante_id)
    datos_hasta = fecha_exportacion(sesion, restaurante_id)
    corte = datos_hasta - timedelta(days=DIAS_TEST)

    # 1) evaluación honesta: entrenar con lo anterior a los últimos 6 meses
    def separar(ds: Dataset):
        tr = np.array([f <= corte for f in ds.fechas])
        return tr, ~tr
    tr, te = separar(sin["comida"])
    if te.sum() < 30 or tr.sum() < 90:
        raise ErrorEntrenamiento("No hay suficientes días para evaluar (hacen falta ~9 meses de datos detallados).")
    pc = _predecir(_entrenar(sin["comida"].X[tr], sin["comida"].y[tr], "poisson", 400), sin["comida"].X[te])
    pn = _predecir(_entrenar(sin["cena"].X[tr], sin["cena"].y[tr], "poisson", 400), sin["cena"].X[te])
    real = sin["comida"].y[te] + sin["cena"].y[te]
    error_sin = float(np.mean(np.abs(np.round(pc) + np.round(pn) - real)))
    media_test = int(round(float(np.mean(real))))

    rtr, rte = separar(res["comida"])
    mc = _entrenar(res["comida"].X[rtr], res["comida"].y[rtr], "l1")
    mn = _entrenar(res["cena"].X[rtr], res["cena"].y[rtr], "l1")
    Xte = res["comida"].X[rte]
    nuevas = np.maximum(0, np.round(_predecir(mc, Xte))) + np.maximum(0, np.round(_predecir(mn, Xte)))
    real_nuevas = res["comida"].y[rte] + res["cena"].y[rte]
    hte = np.array(res["comida"].h)[rte]
    error_res = {str(h): round(float(np.mean(np.abs(nuevas[hte == h] - real_nuevas[hte == h]))), 1) for h in HS}

    # 2) modelo final con todos los datos
    modelos = {
        "sin_comida": _entrenar(sin["comida"].X, sin["comida"].y, "poisson"),
        "sin_cena": _entrenar(sin["cena"].X, sin["cena"].y, "poisson"),
        "res_comida": _entrenar(res["comida"].X, res["comida"].y, "l1"),
        "res_cena": _entrenar(res["cena"].X, res["cena"].y, "l1"),
    }

    historico = {}
    for d in resumen(sesion, restaurante_id=restaurante_id):
        if d.fecha < datos_hasta:
            historico[d.fecha.isoformat()] = [d.comida, d.cena, d.reservadas, 1 if d.cerrado else 0]

    return {
        "generado": (hoy or date.today()).isoformat(),
        "datos_hasta": datos_hasta.isoformat(),
        "evento_min": EVENTO_MIN,
        "hs": HS,
        "error_res": error_res,
        "error_sin": round(error_sin, 1),
        "media_test": media_test,
        "modelos": modelos,
        "calendario": cal,
        "festivos": actual["festivos"],
        "especiales": _especiales(sesion, actual["especiales"], restaurante_id),
        "historico": historico,
    }
