import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { prever, errorPara, filaCalendario } from './prevision';
import type { DatosModelo } from './tipos';

const datos: DatosModelo = JSON.parse(readFileSync('public/modelo/restaurante.json', 'utf8'));
const fixture = JSON.parse(readFileSync('src/motor/__fixtures__/original.json', 'utf8'));

describe('motor de previsión', () => {
  it(`da exactamente lo mismo que el HTML original (${fixture.casos.length} casos)`, () => {
    for (const c of fixture.casos) {
      const r = prever(datos, c.f, c.rc, c.rn, fixture.hoy) as Record<string, unknown>;
      const esperado = { ...c.r };
      delete esperado.tiempo; // el tiempo ya no va dentro del motor
      expect(r, `${c.f} rc=${c.rc} rn=${c.rn}`).toEqual(esperado);
    }
  });

  it('el calendario cubre hasta 2040', () => {
    expect(filaCalendario(datos, '2040-12-31')).toBeDefined();
    expect(filaCalendario(datos, '2041-01-01')).toBeUndefined();
  });

  it('el margen crece con la antelación', () => {
    expect(errorPara(datos, 0)).toBeLessThan(errorPara(datos, 30));
    expect(errorPara(datos, 8)).toBe(datos.error_res['7']);
  });
});
