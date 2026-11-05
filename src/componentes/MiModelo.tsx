import { useEffect, useState } from 'react';
import { borrarModelo, guardarModelo, leerModeloGuardado } from '../servicios/almacen';
import type { DatosModelo } from '../motor';

/** Validación mínima de un fichero de modelo. Devuelve el error o null. */
export function validarModelo(d: Partial<DatosModelo>): string | null {
  const m = d?.modelos;
  if (!m || !m.sin_comida || !m.sin_cena || !m.res_comida || !m.res_cena) return 'No es un fichero de modelo de esta app.';
  if (!d.calendario?.filas?.length || !d.historico || !d.datos_hasta) return 'Al fichero le faltan partes (calendario o histórico).';
  return null;
}

/** Pestaña de la versión sin servidor: cargar tu modelo en este dispositivo. */
export default function MiModelo({ onCambio }: { onCambio: () => void }) {
  const [propio, setPropio] = useState<{ nombre: string; hasta: string } | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const leer = async () => {
    const t = await leerModeloGuardado();
    if (!t) return setPropio(null);
    const d = JSON.parse(t) as DatosModelo;
    setPropio({ nombre: d.restaurante?.nombre ?? 'Mi restaurante', hasta: d.datos_hasta });
  };
  useEffect(() => { leer(); }, []);

  const cargar = async (f: File | undefined) => {
    setError(''); setMensaje('');
    if (!f) return;
    if (/\.csv$/i.test(f.name))
      return setError('Los CSV de CoverManager se importan en la app del ordenador (pestaña «Datos»). Allí pulsa «Descargar modelo para el móvil» y carga aquí ese fichero .json.');
    try {
      const texto = await f.text();
      const fallo = validarModelo(JSON.parse(texto));
      if (fallo) return setError(fallo);
      await guardarModelo(texto);
      await leer();
      setMensaje('✓ Modelo cargado. Ya puedes ver tu previsión en «Previsión».');
      onCambio();
    } catch {
      setError('No se ha podido leer el fichero. ¿Es el .json que descargaste de la app?');
    }
  };

  const quitar = async () => {
    await borrarModelo();
    await leer();
    setMensaje('Se ha quitado tu modelo de este dispositivo. Vuelves a ver la demostración.');
    onCambio();
  };

  return (
    <div className="grid">
      <section className="card">
        <h2>Cargar mi modelo</h2>
        <ol className="pasos">
          <li>En el ordenador, abre la app completa, ve a <b>Datos</b> e importa tus CSV de CoverManager.</li>
          <li>Pulsa <b>Descargar modelo para el móvil</b> y pásate el fichero <b>.json</b> (WhatsApp, correo…).</li>
          <li>Aquí, elige ese fichero.</li>
        </ol>
        <div className="campo">
          <label htmlFor="modelo">Fichero del modelo (.json)</label>
          <input id="modelo" type="file" accept=".json,application/json,.csv,text/csv" onChange={e => cargar(e.target.files?.[0])} />
          <div className="nota">
            Es el fichero que descargas en la versión completa de la app, en «Datos» → «Descargar modelo para el móvil».
            Se guarda solo en este dispositivo: no se sube a ningún sitio.
          </div>
        </div>
        {mensaje && <div className="chips"><span className="chip">{mensaje}</span></div>}
        {error && <div className="aviso">{error}</div>}
      </section>
      <section className="card">
        <h2>En este dispositivo</h2>
        {propio ? (
          <>
            <div className="turno"><div className="t">Usando el modelo de</div><div className="v">{propio.nombre}</div>
              <div className="d">aprendido hasta el {propio.hasta.split('-').reverse().join('-')}</div></div>
            <button style={{ marginTop: 14 }} onClick={quitar}>Quitar mi modelo y volver a la demostración</button>
          </>
        ) : (
          <p className="nota" style={{ marginTop: 0 }}>Ahora mismo ves el <b>restaurante de demostración</b>, con datos inventados.</p>
        )}
        <div className="nota" style={{ marginTop: 14 }}>
          Esta versión funciona sin servidor: calcula la previsión en el propio móvil.
          Para importar CSV de CoverManager y reentrenar el modelo hace falta la versión completa.
          En el móvil puedes añadirla a la pantalla de inicio para abrirla como una app.
        </div>
      </section>
    </div>
  );
}
