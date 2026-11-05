import { useCallback, useEffect, useState } from 'react';
import { api, SIN_BACKEND, SIN_SESION, type Yo } from './servicios/api';
import type { DatosModelo } from './motor';
import { MODO_NAVEGADOR } from './modo';
import { leerModeloGuardado } from './servicios/almacen';
import Panel from './componentes/Panel';
import Cabecera from './componentes/Cabecera';
import Datos from './componentes/Datos';
import Entrar from './componentes/Entrar';
import SinBackend from './componentes/SinBackend';
import MiModelo from './componentes/MiModelo';
import demoUrl from '../backend/modelos/demo.json?url';

export default function App() {
  return MODO_NAVEGADOR ? <AppNavegador /> : <AppServidor />;
}

/** Versión sin servidor: modelo guardado en el navegador o, si no hay, el de demostración. */
function AppNavegador() {
  const cargar = useCallback(async (): Promise<DatosModelo> => {
    const propio = await leerModeloGuardado();
    if (propio) return JSON.parse(propio);
    const r = await fetch(demoUrl);
    if (!r.ok) throw new Error(`Error ${r.status}`);
    return r.json();
  }, []);
  return <Panel cargar={cargar} extra={{ etiqueta: 'Mi modelo', icono: 'modelo', contenido: recargar => <MiModelo onCambio={recargar} /> }} />;
}

type Acceso = 'comprobando' | 'fuera' | 'dentro' | 'sin-backend';

/** Versión completa: con servidor, cuenta e importación de CSV. */
function AppServidor() {
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
  const onError = useCallback((e: Error) => {
    if (e.message !== SIN_SESION) return false;
    setYo(null); setAcceso('fuera');
    return true;
  }, []);
  const salir = () => { api.logout().finally(() => { setYo(null); setAcceso('fuera'); }); };

  if (acceso === 'dentro' && yo)
    return (
      <Panel
        cargar={api.modelo}
        restaurante={yo.restaurante}
        onError={onError}
        salir={{ email: yo.email, onSalir: salir }}
        extra={{ etiqueta: 'Datos', icono: 'datos', contenido: recargar => <Datos onModeloNuevo={recargar} restaurante={yo.restaurante} /> }}
      />
    );
  return (
    <>
      <Cabecera subtitulo="Personas por día, a comida y a cena" />
      <main><div className="wrap">
        {acceso === 'comprobando' && <div className="cargando">Cargando…</div>}
        {acceso === 'sin-backend' && <SinBackend onReintentar={comprobar} />}
        {acceso === 'fuera' && <Entrar onDentro={y => { setYo(y); setAcceso('dentro'); }} onSinBackend={sinBackend} />}
      </div></main>
    </>
  );
}
