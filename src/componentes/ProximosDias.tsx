import { DIAS_C, dsem, fmt, larga, prever, sumar, type DatosModelo, type Tiempo } from '../motor';

interface Props {
  datos: DatosModelo; hoy: string; seleccionado: string; tiempo: Record<string, Tiempo>; onElegir: (f: string) => void;
}

export default function ProximosDias({ datos, hoy, seleccionado, tiempo, onElegir }: Props) {
  const dias = [...Array(14)].map((_, i) => sumar(hoy, i));
  const rs = dias.map(f => prever(datos, f, null, null, hoy));
  const max = Math.max(1, ...rs.map(r => (r.tipo === 'prevision' ? r.comida + r.cena : 0)));
  return (
    <section className="card semana">
      <div className="cab">
        <h2 style={{ margin: 0 }}>Próximos 14 días</h2>
        <span className="nota" style={{ margin: 0 }}>Previsión sin reservas apuntadas. Pulsa un día para verlo.</span>
      </div>
      <div className="cols">
        {rs.map((r, i) => {
          const f = dias[i];
          const p = r.tipo === 'prevision' ? r : null;
          const cerr = !!p?.lunes;
          const lluvia = (tiempo[f]?.prob ?? 0) >= 50 ? ' 🌧' : '';
          return (
            <div key={f} className={`col${f === seleccionado ? ' sel' : ''}${cerr ? ' cerr' : ''}`} title={larga(f)} onClick={() => onElegir(f)}>
              <div className="num">{cerr ? 'cerr.' : fmt(p ? p.comida + p.cena : 0)}</div>
              <div className="pila">
                {cerr ? <span style={{ height: 8 }} /> : (
                  <>
                    <span style={{ height: p ? (150 * p.comida) / max : 0, background: 'var(--comida)' }} />
                    <span style={{ height: p ? (150 * p.cena) / max : 0, background: 'var(--cena)' }} />
                  </>
                )}
              </div>
              <div className="dia">{DIAS_C[dsem(f)]}<br />{+f.slice(8)}{lluvia}</div>
            </div>
          );
        })}
      </div>
      <div className="leyenda" style={{ marginTop: 12 }}>
        <span><i style={{ background: 'var(--comida)' }} />Comida</span>
        <span><i style={{ background: 'var(--cena)' }} />Cena</span>
      </div>
    </section>
  );
}
