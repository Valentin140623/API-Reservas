# Previsión de comensales

App web que predice cuántas personas vendrán a un restaurante cada día (comida y cena),
con o sin las reservas ya apuntadas. Primer cliente: **Mi restaurante**.

Es la versión "de verdad" del HTML original (`original/Prevision_reservas_restaurante.html`):
mismo modelo (árboles LightGBM exportados) y mismos resultados, pero organizada como un
proyecto que se puede mantener, probar y desplegar.

## Arrancar en local

Necesitas [Node.js 22](https://nodejs.org/).

```bash
npm install
npm run dev       # abre http://localhost:5173
npm test          # comprueba que el motor da lo mismo que el HTML original
npm run build     # genera la web estática en dist/
```

## Estructura

```
public/modelo/restaurante.json   Modelo + calendario + histórico (sacado del HTML original)
src/motor/                 Lógica de previsión pura (sin interfaz), con tests
src/componentes/           Pantallas en React
src/servicios/tiempo.ts    Previsión del tiempo (Open-Meteo)
src/config.ts              Datos del restaurante (nombre, ubicación, modelo)
scripts/                   Extraer el modelo del HTML y generar los casos de prueba
original/                  HTML original, como referencia
```

Si llega un HTML nuevo con el modelo reentrenado:

```bash
cp NUEVO.html original/Prevision_reservas_restaurante.html
npm run extraer   # actualiza public/modelo/restaurante.json
npm run fixture   # regenera los casos de prueba
npm test
```

## Desplegar

Es una web estática: cualquier hosting sirve. Lo más fácil es **Vercel** o **Netlify**:
conectas el repositorio de GitHub, comando de build `npm run build`, carpeta `dist`.

> ⚠️ `public/modelo/restaurante.json` contiene el histórico real del restaurante. Mientras no haya
> inicio de sesión (paso 3), cualquiera con el enlace puede verlo. Usa un repositorio
> **privado** y no compartas el enlace fuera del equipo.

## Hoja de ruta

1. **Proyecto base** ✅ — el HTML convertido en app (React + TypeScript + Vite), con tests y CI.
2. **Datos reales del día a día** — backend (Python + FastAPI + PostgreSQL) donde guardar
   reservas y comensales reales, en vez de tenerlos dentro de un fichero.
3. **Cuentas y acceso** — inicio de sesión; cada usuario solo ve su restaurante.
4. **Reentrenamiento automático** — el modelo LightGBM se reentrena solo con los datos nuevos.
5. **Multi-restaurante y comercialización** — alta de nuevos locales (ubicación, festivos),
   planes de pago (Stripe), integración con programas de reservas.
