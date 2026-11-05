# Previsión de comensales

App web que predice cuántas personas vendrán a un restaurante cada día (comida y cena),
con o sin las reservas ya apuntadas. Primer cliente: **Mi restaurante**.

Es la versión "de verdad" del HTML original (`original/Prevision_reservas_restaurante.html`):
mismo modelo (árboles LightGBM exportados) y mismos resultados, pero organizada como un
proyecto que se puede mantener, probar y desplegar.

## Arrancar en local

Necesitas [Node.js](https://nodejs.org/) (LTS) y [Python 3.12 o superior](https://www.python.org/downloads/).

**En Windows, lo fácil:** doble clic en `iniciar.bat`. La primera vez instala todo; después abre
el servidor de datos, la web y el navegador en http://localhost:5173.

A mano (dos terminales):

```bash
# terminal 1: servidor de datos (API)
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt     # en Mac/Linux: .venv/bin/pip
.venv\Scripts\uvicorn app.main:app --reload       # http://localhost:8000/docs

# terminal 2: web

```bash
npm install
npm run dev       # abre http://localhost:5173
npm test          # comprueba que el motor da lo mismo que el HTML original
npm run build     # genera la web estática en dist/
```

## Estructura

```
backend/modelos/restaurante.json Modelo + calendario + histórico (solo se sirve con sesión iniciada)
src/motor/                 Lógica de previsión pura (sin interfaz), con tests
src/componentes/           Pantallas en React
src/servicios/tiempo.ts    Previsión del tiempo (Open-Meteo)
src/componentes/Datos.tsx  Pestaña "Datos": subir los CSV de CoverManager
backend/app/importar.py    Lectura de los CSV de CoverManager
backend/app/resumen.py     Resumen diario (cuántos vinieron por turno, reservadas, eventos, cerrado)
backend/app/main.py        API: login, modelo, importar, estado, días
backend/app/seguridad.py   Contraseñas (scrypt) y cookie de sesión firmada
backend/app/entrenar.py    Reentrenamiento del modelo (LightGBM)
backend/datos.db           Base de datos local (SQLite; no se sube a GitHub)
scripts/                   Extraer el modelo del HTML y generar los casos de prueba
original/                  HTML original, como referencia
```

Si llega un HTML nuevo con el modelo reentrenado:

```bash
cp NUEVO.html original/Prevision_reservas_restaurante.html
npm run extraer   # actualiza backend/modelos/restaurante.json
npm run fixture   # regenera los casos de prueba
npm test
```

## Cuentas

La primera vez que abres la web te pide **crear la primera cuenta** (restaurante, email y contraseña).
Después ya solo se puede entrar; nadie más puede registrarse. Para añadir otro usuario al mismo restaurante:

```bash
cd backend
.venv\Scripts\python -m app.crear_usuario otra@persona.com
```

Todo (modelo, reservas, resumen) se filtra por el restaurante del usuario, así que cuando haya
más restaurantes cada uno verá solo lo suyo. La sesión dura 30 días.

## Datos de CoverManager

En la pestaña **Datos** se suben los dos informes que exporta CoverManager:

- **Reservas** (`report_reserv_stats_basic.csv`): una fila por reserva, con estado y fecha en que se hizo.
- **Personas por turno** (`report_persons_turn_days.csv`): personas reservadas y capacidad por día y turno.

Se pueden subir tantas veces como quieras: las fechas que cubre el fichero se sustituyen, no se duplican.
Para comprobar las reglas contra el histórico del HTML original:

```bash
cd backend
.venv/bin/python scripts/comparar_historico.py ../original/Prevision_reservas_restaurante.html reservas.csv turnos.csv
```

Con los CSV de restaurante coinciden el 98 % de los días en "vinieron" y el 99,9 % en "reservadas".

## Reentrenar el modelo

Cada vez que importas CSV en la pestaña **Datos**, el modelo se reentrena solo (tarda unos segundos);
también hay un botón **Reentrenar ahora**. Lo hace `backend/app/entrenar.py`:

- 4 modelos LightGBM, como el original: comida y cena, con y sin reservas ya apuntadas.
- El error se mide entrenando sin los últimos 6 meses y comparando con lo que vino de verdad.
- Si el modelo nuevo se equivoca más de un 15 % que el actual, se mantiene el actual.
- Cada modelo se guarda como `backend/modelos/r<restaurante>-<fecha>-<n>.json` y los anteriores se conservan.

Con los CSV de restaurante el error queda igual que el del modelo original (±26 personas/día sin reservas,
±15 con reservas a 1 día).

## Desplegar

La web es estática: cualquier hosting sirve (**Vercel** o **Netlify**: comando de build `npm run build`,
carpeta `dist`). El backend se despliega aparte (Render, Railway, Fly.io...) con una base PostgreSQL:
basta con poner la variable `DATABASE_URL`. 

> ⚠️ `backend/modelos/restaurante.json` contiene el histórico real del restaurante: usa un repositorio
> **privado**. En producción pon `SECRET_KEY` (una clave larga aleatoria) y `COOKIE_SEGURA=1`.

## Hoja de ruta

1. **Proyecto base** ✅ — el HTML convertido en app (React + TypeScript + Vite), con tests y CI.
2. **Datos reales del día a día** ✅ — backend (Python + FastAPI + SQLite/PostgreSQL) que importa
   los CSV de CoverManager y calcula el resumen diario.
3. **Cuentas y acceso** ✅ — inicio de sesión; cada usuario solo ve su restaurante.
4. **Reentrenamiento automático** ✅ — el modelo LightGBM se reentrena solo con los datos nuevos.
5. **Multi-restaurante y comercialización** — alta de nuevos locales (ubicación, festivos),
   planes de pago (Stripe), integración con programas de reservas.
