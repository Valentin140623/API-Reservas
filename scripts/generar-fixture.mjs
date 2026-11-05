// Ejecuta el motor ORIGINAL del HTML (sin tocarlo) con un "hoy" fijo y guarda sus resultados.
// Los tests comparan el motor nuevo contra esto para garantizar que da exactamente lo mismo.
// Uso: node scripts/generar-fixture.mjs <original.html> <salida.json>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import vm from 'node:vm';

const [, , entrada, salida] = process.argv;
const html = readFileSync(entrada, 'utf8');
const datos = html.match(/<script id="datos" type="application\/json">([\s\S]*?)<\/script>/)[1];
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
// Nos quedamos con el motor (hasta el pintado de la interfaz) y quitamos la llamada al tiempo.
let motor = scripts.slice(0, scripts.indexOf('// ---- pintar resultado'));
motor = motor.replace(/fetch\([\s\S]*?\.catch\(\(\) => \{\}\);/, '');
motor = motor.replace(/const isoHoy = \(\) => \{[^\n]*\n/, 'const isoHoy = () => __HOY__;\n');
motor = motor.replace("JSON.parse(document.getElementById('datos').textContent)", 'JSON.parse(__DATOS__)');

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
