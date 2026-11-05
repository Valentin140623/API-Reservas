import { dif, fmt, larga, prever, referencia, type DatosModelo, type Tiempo } from '../motor';

interface Props {
  datos: DatosModelo; hoy: string; consulta: { f: string; rc: string; rn: string }; tiempo: Record<string, Tiempo>;
}

/** '' → null (no se sabe); número entero ≥ 0 → número; cualquier otra cosa → NaN (error). */
function num(v: string): number | null {
  const s = v.trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

export default function Resultado({ datos, hoy, consulta, tiempo }: Props) {
  const { f } = consulta;
  const rc = num(consulta.rc), rn = num(consulta.rn);
  const d = dif(f, hoy);
  const cuando = d === 0 ? 'hoy' : d === 1 ? 'mañana' : d > 1 ? `dentro de ${d} días` : d === -1 ? 'ayer' : `hace ${-d} días`;
  const cab = <div className="fecha"><b>{larga(f)}</b> · {cuando}</div>;

  if (Number.isNaN(rc) || Number.isNaN(rn))
    return <section className="card resultado">{cab}<div className="aviso">Las personas reservadas tienen que ser números enteros.</div></section>;

  const r = prever(datos, f, rc, rn, hoy);

  if (r.tipo === 'fuera')
    return (
      <section className="card resultado">{cab}
        <div className="total"><span className="n">—</span></div>
        <div className="margen">Fecha fuera del rango de la app (hasta 2040).</div>
      </section>
    );

  if (r.tipo === 'pasado') {
    const sinDetalle = r.comida === null;
    return (
      <section className="card resultado" aria-live="polite">{cab}
        <div className="total">
          <span className="n">{r.cerrado ? 'Cerrado' : fmt(sinDetalle ? r.reservadas : r.comida! + r.cena!)}</span>
          <span className="u">{r.cerrado ? '' : sinDetalle ? 'reservadas' : 'personas vinieron'}</span>
        </div>
        <div className="margen">
          {sinDetalle ? 'Antes de octubre de 2024 solo hay el total reservado (con cancelaciones).' : `Dato real. Reservadas ese día (con cancelaciones): ${fmt(r.reservadas)}.`}
        </div>
        <div className="turnos">
          <Turno t="Comida" v={sinDetalle ? '—' : fmt(r.comida!)} />
          <Turno t="Cena" v={sinDetalle ? '—' : fmt(r.cena!)} />
        </div>
        <div className="chips"><span className="chip">Día ya pasado</span></div>
      </section>
    );
  }

  const total = r.comida + r.cena;
  const pct = (v: number) => (total ? (100 * v) / total : 0);
  const t = tiempo[f];
  const avisos: string[] = [];
  if (r.especial) avisos.push(`${r.especial.nombre}: se usa lo que vino ese día otros años (` + r.especial.anios.map(a => `${a[0]}: ${a[1]} + ${a[2]}`).join(', ') + ').');
  if (r.lunes && !r.conRes) avisos.push('Los lunes normalmente está cerrado. Si abrís, esta es la previsión.');
  if (!r.conRes && d >= 0 && d <= 14) avisos.push('Pon las personas ya reservadas para afinar la previsión.');
  const refs = referencia(datos, f);

  return (
    <section className="card resultado" aria-live="polite">{cab}
      <div className="total"><span className="n">{fmt(total)}</span><span className="u">personas</span></div>
      <div className="margen">Margen habitual: ±{Math.round(r.margen)} personas{r.conRes ? ' en las nuevas' : ''}</div>
      {r.conRes ? (
        <>
          <div className="barra">
            <span style={{ width: `${pct(r.rc + r.rn)}%`, background: 'var(--comida)' }} />
            <span style={{ width: `${pct(r.nc + r.nn)}%`, background: 'var(--nuevas)' }} />
          </div>
          <div className="leyenda">
            <span><i style={{ background: 'var(--comida)' }} />{fmt(r.rc + r.rn)} ya reservadas</span>
            <span><i style={{ background: 'var(--nuevas)' }} />{fmt(r.nc + r.nn)} nuevas previstas</span>
          </div>
        </>
      ) : (
        <>
          <div className="barra">
            <span style={{ width: `${pct(r.comida)}%`, background: 'var(--comida)' }} />
            <span style={{ width: `${pct(r.cena)}%`, background: 'var(--cena)' }} />
          </div>
          <div className="leyenda">
            <span><i style={{ background: 'var(--comida)' }} />Comida</span>
            <span><i style={{ background: 'var(--cena)' }} />Cena</span>
          </div>
        </>
      )}
      <div className="turnos">
        <Turno t="Comida" v={fmt(r.comida)} d={r.conRes ? `${fmt(r.rc)} reservadas + ${fmt(r.nc)} nuevas` : 'sin reservas apuntadas'} />
        <Turno t="Cena" v={fmt(r.cena)} d={r.conRes ? `${fmt(r.rn)} reservadas + ${fmt(r.nn)} nuevas` : 'sin reservas apuntadas'} />
      </div>
      {refs.length > 0 && (
        <div className="ref">
          {refs.map(x => <div key={x.titulo}><div className="t">{x.titulo}</div><div className="v">{x.valor}</div><div className="d">{x.detalle}</div></div>)}
        </div>
      )}
      <div className="chips">
        {r.festivo && <span className="chip">Festivo: {r.festivo}</span>}
        {r.especial && <span className="chip warn">{r.especial.nombre}</span>}
        {t && <ChipTiempo t={t} />}
      </div>
      {avisos.length > 0 && <div className="aviso">{avisos.join(' ')}</div>}
    </section>
  );
}

function Turno({ t, v, d = '' }: { t: string; v: string; d?: string }) {
  return <div className="turno"><div className="t">{t}</div><div className="v">{v}</div><div className="d">{d}</div></div>;
}

function ChipTiempo({ t }: { t: Tiempo }) {
  const llueve = (t.prob ?? 0) >= 50 || (t.lluvia ?? 0) >= 1;
  const partes: string[] = [];
  if (t.tmax != null) partes.push(`${Math.round(t.tmax)} °C`);
  if (t.lluvia != null) partes.push(`lluvia ${t.lluvia.toFixed(1)} mm`);
  if (t.prob != null) partes.push(`probabilidad de lluvia ${t.prob}%`);
  if (!partes.length) return null;
  return <span className={`chip${llueve ? ' warn' : ''}`}>{llueve ? '🌧 ' : ''}Tiempo: {partes.join(' · ')}</span>;
}
