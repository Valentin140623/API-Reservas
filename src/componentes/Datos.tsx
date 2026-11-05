import { useCallback, useEffect, useState } from 'react';
import { api, SIN_BACKEND, SIN_SESION, type DiaResumen, type Estado, type ResultadoImportacion } from '../servicios/api';
import { DIAS_C, dsem, fmt, isoHoy, sumar } from '../motor';

const fechaEs = (s: string | null) => (s ? s.split('-').reverse().join('-') : '—');

export default function Datos() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [dias, setDias] = useState<DiaResumen[]>([]);
  const [ficheros, setFicheros] = useState<File[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacion[] | null>(null);
  const [error, setError] = useState('');

  const recargar = useCallback(async () => {
    try {
      const e = await api.estado();
      setEstado(e);
      const hasta = e.reservas.hasta ?? e.turnos.hasta ?? isoHoy();
      setDias((await api.dias(sumar(hasta, -29), hasta)).reverse());
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { recargar(); }, [recargar]);

  const subir = async () => {
    setSubiendo(true); setResultado(null);
    try {
      setResultado(await api.importar(ficheros));
      setFicheros([]);
      await recargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubiendo(false);
    }
  };

  if (error === SIN_BACKEND)
    return (
      <section className="card">
        <h2>Datos</h2>
        <div className="aviso">
          El servidor de datos no está arrancado. Abre otra ventana de PowerShell, entra en la carpeta <b>backend</b> y ejecuta <code>.venv\Scripts\uvicorn app.main:app --reload</code> (mira el README).
        </div>
        <button style={{ marginTop: 14 }} onClick={recargar}>Reintentar</button>
      </section>
    );

  return (
    <>
      <div className="grid">
        <section className="card">
          <h2>Importar de CoverManager</h2>
          <div className="campo">
            <label htmlFor="csv">Ficheros CSV</label>
            <input id="csv" type="file" accept=".csv,text/csv" multiple onChange={e => setFicheros([...(e.target.files ?? [])])} />
            <div className="nota">
              Sube el informe de <b>reservas</b> (report_reserv_stats_basic) y el de <b>personas por turno</b> (report_persons_turn_days).
              Puedes subir los dos a la vez. Si un fichero se solapa con datos ya subidos, se sustituyen esas fechas: no se duplica nada.
            </div>
          </div>
          <button className="primario" disabled={!ficheros.length || subiendo} onClick={subir}>
            {subiendo ? 'Importando…' : `Importar ${ficheros.length || ''} fichero${ficheros.length === 1 ? '' : 's'}`}
          </button>
          {error && <div className="aviso">{error === SIN_SESION ? 'La sesión ha caducado. Recarga la página y vuelve a entrar.' : error}</div>}
          {resultado && (
            <div className="chips">
              {resultado.map(r => (
                <span key={r.fichero} className="chip">
                  ✓ {r.tipo === 'reservas' ? 'Reservas' : 'Personas por turno'}: {fmt(r.filas)} filas ({fechaEs(r.desde)} a {fechaEs(r.hasta)})
                  {r.ignoradas ? ` · ${r.ignoradas} ignoradas` : ''}
                </span>
              ))}
            </div>
          )}
        </section>
        <section className="card">
          <h2>Datos guardados</h2>
          {estado && (
            <div className="turnos" style={{ marginTop: 0 }}>
              <div className="turno"><div className="t">Reservas</div><div className="v">{fmt(estado.reservas.filas)}</div>
                <div className="d">{fechaEs(estado.reservas.desde)} a {fechaEs(estado.reservas.hasta)}</div></div>
              <div className="turno"><div className="t">Días por turno</div><div className="v">{fmt(estado.turnos.filas / 2)}</div>
                <div className="d">{fechaEs(estado.turnos.desde)} a {fechaEs(estado.turnos.hasta)}</div></div>
            </div>
          )}
          <div className="nota" style={{ marginTop: 14 }}>
            "Vinieron" cuenta las reservas sentadas, llegadas o confirmadas, sin eventos de 50 personas o más.
            Estos datos servirán para reentrenar el modelo en un paso posterior.
          </div>
        </section>
      </div>
      {dias.length > 0 && (
        <section className="card semana">
          <h2>Últimos 30 días con datos</h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="tabla">
              <thead><tr><th>Día</th><th>Comida</th><th>Cena</th><th>Total vinieron</th><th>Reservadas</th><th>Eventos</th></tr></thead>
              <tbody>
                {dias.map(d => (
                  <tr key={d.fecha} className={d.cerrado ? 'cerrado' : ''}>
                    <td>{DIAS_C[dsem(d.fecha)]} {fechaEs(d.fecha)}</td>
                    {d.cerrado ? <td colSpan={5}>Cerrado</td> : (
                      <>
                        <td>{d.comida ?? '—'}</td><td>{d.cena ?? '—'}</td>
                        <td><b>{d.comida === null ? '—' : (d.comida ?? 0) + (d.cena ?? 0)}</b></td>
                        <td>{d.reservadas}</td><td>{d.eventos || ''}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
