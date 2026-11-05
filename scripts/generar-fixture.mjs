// Ejecuta el motor ORIGINAL (scripts/motor-original.js) con un modelo y un "hoy" fijo y guarda sus resultados.
// Los tests comparan el motor nuevo contra esto para garantizar que da exactamente lo mismo.
// Uso: node scripts/generar-fixture.mjs <modelo.json> <salida.json>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import vm from 'node:vm';

const [, , modelo, salida] = process.argv;
const datos = readFileSync(modelo, 'utf8');
const motor = readFileSync(new URL('./motor-original.js', import.meta.url), 'utf8');

const HOY = '2026-11-05';
const ctx = vm.createContext({ __DATOS__: datos, __HOY__: HOY, Math, Date, Object, Array, Number, JSON, String, Set, console });
vm.runInContext(motor + `\nthis.prever = prever; this.sumar = sumar;`, ctx);

const casos = [];
const reservas = [[null, null], [0, 0], [10, 0], [0, 25], [40, 60], [120, 80]];
for (let i = -400; i <= 420; i += 1) {
  const f = ctx.sumar(HOY, i);
  casos.push({ f, rc: null, rn: null, r: ctx.prever(f, null, null) });
  if (i >= 0 && i <= 70 && i % 3 === 0) for (const [rc, rn] of reservas.slice(1)) casos.push({ f, rc, rn, r: ctx.prever(f, rc, rn) });
}
for (const f of ['2041-01-01', '2023-12-24', '2026-12-24', '2026-12-31', '2027-02-14'])
  casos.push({ f, rc: null, rn: null, r: ctx.prever(f, null, null) });
mkdirSync(dirname(salida), { recursive: true });
writeFileSync(salida, JSON.stringify({ hoy: HOY, casos }));
console.log(`OK: ${casos.length} casos en ${salida}`);
