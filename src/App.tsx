import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, SIN_BACKEND, SIN_SESION, type Yo } from './servicios/api';
import { isoHoy, sumar, type DatosModelo, type Tiempo } from './motor';
import { cargarTiempo } from './servicios/tiempo';
import { guardar, recuperar } from './memoria';
import Consulta from './componentes/Consulta';
import Resultado from './componentes/Resultado';
import ProximosDias from './componentes/ProximosDias';
import InfoModelo from './componentes/InfoModelo';
import Datos from './componentes/Datos';
import Entrar from './componentes/Entrar';
import SinBackend from './componentes/SinBackend';

type Acceso = 'comprobando' | 'fuera' | 'dentro' | 'sin-backend';

export default function App() {
  const [acceso, setAcceso] = useState<Acceso>('comprobando');
  const [yo, setYo] = useState<Yo | null>(null);
  const comprobar = useCallback(() => {
    setAcceso('comprobando');
    api.yo()
      .then(y => { setYo(y); setAcceso('dentro'); })
      .catch(e => setAcceso(e.message === SIN_BACKEND ? 'sin-backend' : 'fuera'));
  }, []);
  useEffect(comprobar, [comprobar]);
  const sinBackend = useCallback(() => setAcceso('sin-backend'), []);
  const sinSesion = useCallback(() => { setYo(null); setAcceso('fuera'); }, []);
  const salir = () => { api.logout().finally(() => { setYo(null); setAcceso('fuera'); }); };

  const cabecera = (
    <header><div className="wrap">
      <h1>Previsión de reservas</h1>
      <p>Previsión de comensales</p>
    </div></header>
  );
  if (acceso !== 'dentro')
    return (
      <>
        {cabecera}
        <main><div className="wrap">
          {acceso === 'comprobando' && <div className="cargando">Cargando…</div>}
          {acceso === 'sin-backend' && <SinBackend onReintentar={comprobar} />}
          {acceso === 'fuera' && <Entrar onDentro={y => { setYo(y); setAcceso('dentro'); }} onSinBackend={sinBackend} />}
        </div></main>
      </>
    );
  return <Panel yo={yo!} onSalir={salir} onSinSesion={sinSesion} />;
}

function Panel({ yo, onSalir, onSinSesion }: { yo: Yo; onSalir: () => void; onSinSesion: () => void }) {
  const hoy = useMemo(() => isoHoy(), []);
  const [datos, setDatos] = useState<DatosModelo | null>(null);
  const [error, setError] = useState('');
  const [pestana, setPestana] = useState<'prevision' | 'datos'>('prevision');
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
    api.modelo()
      .then(setDatos)
      .catch(e => (e.message === SIN_SESION ? onSinSesion() : setError(`No se ha podido cargar el modelo: ${e.message}`)));
    cargarTiempo(yo.restaurante.lat, yo.restaurante.lon).then(setTiempo);
  }, [yo, onSinSesion]);

  useEffect(() => { guardar(consulta); }, [consulta]);

  const irA = (f: string) => { setFecha(f); setRc(''); setRn(''); setConsulta({ f, rc: '', rn: '' }); };

  return (
    <>
      <header><div className="wrap">
        <h1>Previsión de reservas</h1>
        <p>{yo.restaurante.nombre} · personas por día, sin contar eventos</p>
        <nav className="pestanas">
          <button className={pestana === 'prevision' ? 'activa' : ''} onClick={() => setPestana('prevision')}>Previsión</button>
          <button className={pestana === 'datos' ? 'activa' : ''} onClick={() => setPestana('datos')}>Datos</button>
          <button onClick={onSalir} title={yo.email}>Salir</button>
        </nav>
      </div></header>
      <main><div className="wrap">
        {pestana === 'datos' && <Datos />}
        {pestana === 'prevision' && error && <div className="aviso">{error}</div>}
        {pestana === 'prevision' && !datos && !error && <div className="cargando">Cargando modelo…</div>}
        {pestana === 'prevision' && datos && (
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
