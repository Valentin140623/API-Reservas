// Forma del fichero de modelo (public/modelo/*.json), tal como lo genera el entrenamiento.

/** Nodo de árbol LightGBM exportado: [feature, umbral, izquierdaPorDefecto, tipoMissing, izq, der] u hoja (número). */
export type Nodo = number | [number, number, number, 'None' | 'NaN' | 'Zero', Nodo, Nodo];

export interface Modelo {
  obj: 'poisson' | 'l1' | string;
  trees: Nodo[];
  cols?: string[];
}

/** [comida, cena, reservadas, cerrado]. comida/cena son null antes de oct-2024 (solo hay total reservado). */
export type DiaHistorico = [number | null, number | null, number, 0 | 1];

export interface DatosModelo {
  generado: string;
  datos_hasta: string;
  evento_min: number;
  hs: number[];
  error_res: Record<string, number>;
  error_sin: number;
  media_test: number;
  modelos: { res_comida: Modelo; res_cena: Modelo; sin_comida: Modelo; sin_cena: Modelo };
  calendario: { inicio: string; filas: number[][] };
  festivos: Record<string, string>;
  especiales: Record<string, { nombre: string; anios: [number, number, number][] }>;
  historico: Record<string, DiaHistorico>;
}

export interface Tiempo {
  tmax: number | null;
  lluvia: number | null;
  prob: number | null;
}

export type Prevision =
  | { tipo: 'fuera'; fecha: string }
  | { tipo: 'pasado'; fecha: string; comida: number | null; cena: number | null; reservadas: number; cerrado: boolean }
  | {
      tipo: 'prevision';
      fecha: string;
      conRes: boolean;
      rc: number;
      rn: number;
      comida: number;
      cena: number;
      /** nuevas previstas (comida / cena) además de las ya reservadas */
      nc: number;
      nn: number;
      margen: number;
      especial: { nombre: string; anios: [number, number, number][] } | null;
      festivo: string | null;
      lunes: boolean;
    };
