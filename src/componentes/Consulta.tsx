import { dsem, sumar } from '../motor';

interface Props {
  hoy: string; fecha: string; rc: string; rn: string; eventoMin: number;
  onFecha: (f: string) => void; onRc: (v: string) => void; onRn: (v: string) => void; onCalcular: () => void;
}

export default function Consulta({ hoy, fecha, rc, rn, eventoMin, onFecha, onRc, onRn, onCalcular }: Props) {
  const enter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') onCalcular(); };
  return (
    <section className="card">
      <h2>Consulta</h2>
      <div className="campo">
        <label htmlFor="fecha">Fecha</label>
        <input type="date" id="fecha" value={fecha} onChange={e => e.target.value && onFecha(e.target.value)} />
        <div className="rapidos">
          <button onClick={() => onFecha(hoy)}>Hoy</button>
          <button onClick={() => onFecha(sumar(hoy, 1))}>Mañana</button>
          <button onClick={() => onFecha(sumar(hoy, (6 - dsem(hoy) + 7) % 7))}>Este sábado</button>
          <button onClick={() => onFecha(sumar(hoy, 7))}>+7 días</button>
        </div>
      </div>
      <div className="campo">
        <label>Personas ya reservadas <span style={{ opacity: 0.8 }}>(opcional)</span></label>
        <div className="row">
          <div><input inputMode="numeric" placeholder="Comida" aria-label="Reservadas comida" value={rc} onChange={e => onRc(e.target.value)} onKeyDown={enter} /></div>
          <div><input inputMode="numeric" placeholder="Cena" aria-label="Reservadas cena" value={rn} onChange={e => onRn(e.target.value)} onKeyDown={enter} /></div>
        </div>
        <div className="nota">No incluyas los eventos (reservas de {eventoMin} personas o más): súmalos tú aparte.</div>
      </div>
      <button className="primario" onClick={onCalcular}>Calcular previsión</button>
      <div className="nota" style={{ marginTop: 12 }}>
        Si pones las reservadas, el total es <b>ya reservadas + nuevas previstas</b>. Si las dejas vacías, la previsión sale del calendario y del histórico.
      </div>
    </section>
  );
}
