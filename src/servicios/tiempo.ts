import type { Tiempo } from '../motor';

/** Previsión del tiempo de Open-Meteo (16 días). Si no hay internet, devuelve {}. */
export async function cargarTiempo(lat: number, lon: number): Promise<Record<string, Tiempo>> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=Europe%2FMadrid` +
    '&daily=temperature_2m_max,precipitation_sum,precipitation_probability_max&forecast_days=16';
  try {
    const j = await (await fetch(url)).json();
    const out: Record<string, Tiempo> = {};
    j.daily.time.forEach((t: string, i: number) => {
      out[t] = { tmax: j.daily.temperature_2m_max[i], lluvia: j.daily.precipitation_sum[i], prob: j.daily.precipitation_probability_max[i] };
    });
    return out;
  } catch {
    return {};
  }
}
