import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isoHoy, sumar, type DatosModelo, type Tiempo } from '../motor';
import { cargarTiempo } from '../servicios/tiempo';
import { guardar, recuperar } from '../memoria';
import Consulta from './Consulta';
import Resultado from './Resultado';
import ProximosDias from './ProximosDias';
import InfoModelo from './InfoModelo';
import Cabecera, { Pestanas } from './Cabecera';

export interface Restaurante { nombre: string; lat: number; lon: number }

interface Props {
  /** Carga el modelo (del servidor o del navegador). */
  cargar: () => Promise<DatosModelo>;
  /** Si no se pasa, se usa el que venga dentro del modelo. */
  restaurante?: Restaurante;
  /** Segunda pestaña ("Datos" con servidor, "Mi modelo" sin servidor). */
  extra: { etiqueta: string; icono: 'datos' | 'modelo'; contenido: (recargar: () => void) => ReactNode };
  salir?: { email: string; onSalir: () => void };
  onError?: (e: Error) => boolean;
}

const POR_DEFECTO: Restaurante = { nombre: 'Mi restaurante', lat: 41.39, lon: 2.17 };

export default function Panel({ cargar, restaurante, extra, salir, onError }: Props) {
  const hoy = useMemo(() => isoHoy(), []);
  const [datos, setDatos] = useState<DatosModelo | null>(null);
  const [error, setError] = useState('');
  const [pestana, setPestana] = useState<'prevision' | 'extra'>(location.hash === '#cargar' ? 'extra' : 'prevision');
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

  const recargar = useCallback(() => {
    cargar()
      .then(d => { setDatos(d); setError(''); })
      .catch((e: Error) => { if (!onError?.(e)) setError(`No se ha podido cargar el modelo: ${e.message}`); });
  }, [cargar, onError]);
  useEffect(recargar, [recargar]);

  const rest = restaurante ?? datos?.restaurante ?? POR_DEFECTO;
  useEffect(() => { cargarTiempo(rest.lat, rest.lon).then(setTiempo); }, [rest.lat, rest.lon]);
  useEffect(() => { guardar(consulta); }, [consulta]);

  const cambiar = (p: 'prevision' | 'extra') => { setPestana(p); window.scrollTo({ top: 0 }); };
  const irA = (f: string) => { setFecha(f); setRc(''); setRn(''); setConsulta({ f, rc: '', rn: '' }); };

  return (
    <>
      <Cabecera subtitulo={`${rest.nombre} · personas por día, sin contar eventos`}>
        <Pestanas
          opciones={[{ id: 'prevision', etiqueta: 'Previsión', icono: 'prevision' }, { id: 'extra', etiqueta: extra.etiqueta, icono: extra.icono }]}
          activa={pestana} onCambio={cambiar}
        />
        {salir && <button className="salir" onClick={salir.onSalir} title={salir.email}>Salir</button>}
      </Cabecera>
      <main><div className="wrap vista" key={pestana}>
        {pestana === 'extra' && extra.contenido(recargar)}
        {pestana === 'prevision' && datos?.demo && (
          <div className="aviso demo">
            Estás viendo un <b>restaurante de demostración con datos inventados</b>. Para ver el tuyo, ve a «{extra.etiqueta}».
          </div>
        )}
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
