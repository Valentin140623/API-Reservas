// Extrae el JSON del modelo (árboles, calendario, histórico...) del HTML original.
// Uso: node scripts/extraer-datos.mjs <original.html> <salida.json>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [, , entrada, salida] = process.argv;
const html = readFileSync(entrada, 'utf8');
const m = html.match(/<script id="datos" type="application\/json">([\s\S]*?)<\/script>/);
if (!m) throw new Error('No encuentro <script id="datos"> en ' + entrada);
const datos = JSON.parse(m[1]);
mkdirSync(dirname(salida), { recursive: true });
writeFileSync(salida, JSON.stringify(datos));
console.log(`OK: ${salida} (${Object.keys(datos.historico).length} días de histórico, datos hasta ${datos.datos_hasta})`);
