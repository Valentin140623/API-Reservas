import { useEffect, useMemo, useState } from 'react';
import { RESTAURANTE } from './config';
import { isoHoy, sumar, type DatosModelo, type Tiempo } from './motor';
import { cargarTiempo } from './servicios/tiempo';
import { guardar, recuperar } from './memoria';
import Consulta from './componentes/Consulta';
import Resultado from './componentes/Resultado';
import ProximosDias from './componentes/ProximosDias';
import InfoModelo from './componentes/InfoModelo';

export default function App() {
  const hoy = useMemo(() => isoHoy(), []);
  const [datos, setDatos] = useState<DatosModelo | null>(null);
  const [error, setError] = useState('');
  const [tiempo, setTiempo] = useState<Record<string, Tiempo>>({});
  const prev = useMemo(() => {
    const p = recuperar();
    return p && p.f >= hoy ? p : null;
  }, [hoy]);
  const [fecha, setFecha] = useState(prev?.f ?? sumar(hoy, 1));
  const [rc, setRc] = useState(prev?.rc ?? '');
  const [rn, setRn] = useState(prev?.rn ?? '');
  // lo que se calculó al pulsar "Calcular" (o al cambiar de fecha)
  const [consulta, setConsulta] = useState({ f: fecha, rc, rn });

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + RESTAURANTE.modelo)
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(setDatos)
      .catch(e => setError(`No se ha podido cargar el modelo (${e.message}).`));
    cargarTiempo(RESTAURANTE.lat, RESTAURANTE.lon).then(setTiempo);
  }, []);

  useEffect(() => { guardar(consulta); }, [consulta]);

  const irA = (f: string) => { setFecha(f); setRc(''); setRn(''); setConsulta({ f, rc: '', rn: '' }); };

  return (
    <>
      <header><div className="wrap">
        <h1>Previsión de reservas</h1>
        <p>{RESTAURANTE.nombre} · personas por día, sin contar eventos</p>
      </div></header>
      <main><div className="wrap">
        {error && <div className="aviso">{error}</div>}
        {!datos && !error && <div className="cargando">Cargando modelo…</div>}
        {datos && (
          <>
            <div className="grid">
              <Consulta
                hoy={hoy} fecha={fecha} rc={rc} rn={rn} eventoMin={datos.evento_min}
                onFecha={irA} onRc={setRc} onRn={setRn}
                onCalcular={() => setConsulta({ f: fecha, rc, rn })}
              />
              <Resultado datos={datos} hoy={hoy} consulta={consulta} tiempo={tiempo} />
            </div>
            <ProximosDias datos={datos} hoy={hoy} seleccionado={consulta.f} tiempo={tiempo} onElegir={irA} />
            <InfoModelo datos={datos} />
            <footer>
              Modelo generado el {datos.generado.split('-').reverse().join('-')} · funciona sin internet (el tiempo previsto sí necesita conexión).
            </footer>
          </>
        )}
      </div></main>
    </>
  );
}
