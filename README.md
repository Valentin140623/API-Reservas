# Previsión de comensales

App web que predice cuántas personas vendrán a un restaurante cada día, a comida y a cena,
con o sin las reservas ya apuntadas. Aprende del histórico de reservas que exporta
**CoverManager** y usa modelos **LightGBM**.

**Pruébala:** https://valentin140623.github.io/Prevision-de-reservas/. Abre un restaurante de
demostración con datos inventados. En el móvil se puede añadir a la pantalla de inicio y se abre como una app.

## Dos formas de usarla

| | Versión sin servidor (GitHub Pages) | Versión completa (con servidor) |
|---|---|---|
| Para qué | Ver la previsión en el móvil, pasársela a un compañero | Llevar el restaurante: importar datos, reentrenar |
| Instalar | Nada: es un enlace | Node.js + Python, o desplegar en Render |
| Previsión por día y turno | ✅ | ✅ |
| Importar CSV de CoverManager | — | ✅ |
| Reentrenar el modelo | — | ✅ (automático al importar) |
| Cuentas e inicio de sesión | — | ✅ |
| Tus datos | Solo en tu dispositivo | En tu base de datos |

**Llevar tu modelo al móvil:** en la versión completa, ve a *Datos* → **Descargar modelo para el móvil**.
Pásate el `.json` (por WhatsApp, correo...), abre el enlace de GitHub Pages en el móvil, entra en
*Mi modelo* y cárgalo. Se guarda solo en ese dispositivo, nunca se sube a ningún sitio.

## Privacidad

En este repositorio **no hay datos reales**. Lo único que hay es `backend/modelos/demo.json`, entrenado con
reservas inventadas por `backend/scripts/crear_modelo_demo.py`. Git ignora los modelos reales, los CSV,
la base de datos y la clave de sesiones (`.gitignore`), así que no se suben aunque estén en tu carpeta.

## Arrancar la versión completa en local

Necesitas [Node.js](https://nodejs.org/) (LTS) y [Python 3.13](https://www.python.org/downloads/).

**En Windows:** doble clic en `iniciar.bat`. La primera vez lo instala todo; después abre el servidor
de datos, la web y el navegador en http://localhost:5173.

A mano, con dos terminales:

```bash
# terminal 1: servidor de datos (API)
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt     # en Mac/Linux: .venv/bin/pip
.venv\Scripts\uvicorn app.main:app --reload       # http://localhost:8000/docs

# terminal 2: web
npm install
npm run dev                                       # http://localhost:5173
```

La primera vez te pide **crear la primera cuenta** (restaurante, email y contraseña). El restaurante
empieza con el modelo de demostración. En cuanto importas tus CSV, se entrena uno con tus datos.

Para usar un modelo propio como punto de partida, ponlo en `backend/modelos/` y arranca con
`MODELO_INICIAL=mi_modelo.json`. Git no lo subirá.

## Datos de CoverManager

En la pestaña **Datos** se suben los dos informes que exporta CoverManager:

- **Reservas** (`report_reserv_stats_basic.csv`): una fila por reserva, con estado y fecha en que se hizo.
- **Personas por turno** (`report_persons_turn_days.csv`): personas reservadas y capacidad por día y turno.

Puedes subirlos tantas veces como quieras: las fechas que cubre el fichero se sustituyen, no se duplican.
"Vinieron" cuenta las reservas sentadas, llegadas o confirmadas. Los eventos (50 personas o más) van aparte.

## Reentrenar el modelo

Cada vez que importas CSV, el modelo se reentrena solo en unos segundos. También hay un botón
**Reentrenar ahora**. Lo hace `backend/app/entrenar.py`:

- Hay 4 modelos LightGBM: comida y cena, con y sin reservas ya apuntadas.
- El error se mide entrenando sin los últimos 6 meses y comparando con lo que vino de verdad.
- Si el modelo nuevo se equivoca más de un 15 % que el actual, se mantiene el actual.
- Los modelos se guardan en la base de datos y los anteriores se conservan.

## Estructura

```
src/motor/                 Lógica de previsión (sin interfaz), con tests
src/componentes/           Pantallas en React
src/modo.ts                Versión sin servidor (VITE_MODO=navegador) o completa
backend/app/main.py        API: cuentas, modelo, importar, reentrenar; sirve también la web
backend/app/importar.py    Lectura de los CSV de CoverManager
backend/app/resumen.py     Resumen diario (cuántos vinieron por turno, reservadas, eventos, cerrado)
backend/app/entrenar.py    Reentrenamiento (LightGBM)
backend/app/seguridad.py   Contraseñas (scrypt) y cookie de sesión firmada
backend/modelos/demo.json  Modelo de demostración (datos inventados)
scripts/motor-original.js  Motor del prototipo original; los tests comprueban que la app da lo mismo
```

Tests: `npm test` (web) y `cd backend && .venv/bin/python -m pytest` (servidor).

## Publicar

**Versión sin servidor (gratis, GitHub Pages).** Ve a *Settings → Pages → Source: GitHub Actions*.
Cada `git push` a `main` la vuelve a publicar con `.github/workflows/pages.yml`.

**Versión completa en internet (Render).** Ve a *New → Blueprint* y elige este repositorio. `render.yaml` crea
el servidor (`Dockerfile`) y una base PostgreSQL. Cuando lo pida, pon tu email en `PRIMER_EMAIL`:
así solo tú puedes crear la primera cuenta.

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | PostgreSQL (Render la pone sola) |
| `SECRET_KEY` | firma de las sesiones (Render la genera) |
| `COOKIE_SEGURA=1` | la cookie solo viaja por https |
| `PRIMER_EMAIL` | único email que puede crear la primera cuenta |
| `MODELO_INICIAL` | modelo de partida (por defecto `demo.json`) |

## Hoja de ruta

1. ✅ Prototipo HTML convertido en app (React + TypeScript + Vite), con tests y CI.
2. ✅ Importar los CSV de CoverManager (FastAPI + SQLite/PostgreSQL).
3. ✅ Cuentas: cada usuario solo ve su restaurante.
4. ✅ Reentrenamiento automático.
5. ✅ Lista para internet (un servidor, Docker, Render) y versión sin servidor para el móvil.
6. Alta de otros restaurantes con su ubicación y sus festivos.
7. Comercialización: planes de pago, integración directa con CoverManager.
