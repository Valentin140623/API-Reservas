import type { Modelo, Nodo } from './tipos';

/** Recorre un árbol LightGBM exportado y devuelve el valor de la hoja. */
export function arbol(n: Nodo, x: number[]): number {
  while (Array.isArray(n)) {
    let v = x[n[0]];
    const mt = n[3];
    let izq: boolean;
    if (mt === 'NaN' && Number.isNaN(v)) izq = n[2] === 1;
    else if (mt === 'Zero' && (v === 0 || Number.isNaN(v))) izq = n[2] === 1;
    else {
      if (Number.isNaN(v)) v = 0;
      izq = v <= n[1];
    }
    n = izq ? n[4] : n[5];
  }
  return n;
}

/** Suma todos los árboles; con objetivo poisson la salida va en escala logarítmica. */
export function predecirModelo(m: Modelo, x: number[]): number {
  let s = 0;
  for (const t of m.trees) s += arbol(t, x);
  return m.obj === 'poisson' ? Math.exp(s) : s;
}
