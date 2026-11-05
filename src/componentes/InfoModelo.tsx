import { errorPara, type DatosModelo } from '../motor';

export default function InfoModelo({ datos }: { datos: DatosModelo }) {
  const e = (h: number) => Math.round(errorPara(datos, h));
  const e1 = [1, 7, 30].map(h => `${h} ${h === 1 ? 'día' : 'días'}: ±${e(h)}`).join(' · ');
  return (
    <section className="info">
      <div className="card"><p>Error medio con las reservas puestas</p><div className="k">±{e(1)}–{e(30)}</div>
        <p>personas nuevas, según la antelación ({e1}). Medido en los últimos 6 meses.</p></div>
      <div className="card"><p>Error medio sin reservas</p><div className="k">±{Math.round(datos.error_sin)}</div>
        <p>personas por día, con una media de {datos.media_test} personas/día. Últimos 6 meses.</p></div>
      <div className="card"><p>Aprendido de</p><div className="k">{Object.keys(datos.historico).length.toLocaleString('es-ES')} días</div>
        <p>de histórico, hasta el {datos.datos_hasta.split('-').reverse().join('-')}. Festivos de Catalunya incluidos.</p></div>
    </section>
  );
}
