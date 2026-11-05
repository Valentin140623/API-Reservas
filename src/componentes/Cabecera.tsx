import type { ReactNode } from 'react';

/** Barra superior: icono, título y, opcionalmente, las pestañas y el botón de salir. */
export default function Cabecera({ subtitulo, children }: { subtitulo: string; children?: ReactNode }) {
  return (
    <header><div className="wrap">
      <div className="titulo">
        <span className="logo" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="13" width="4" height="8" rx="1.5" /><rect x="10" y="8" width="4" height="13" rx="1.5" /><rect x="17" y="4" width="4" height="17" rx="1.5" /></svg>
        </span>
        <div style={{ minWidth: 0 }}>
          <h1>Previsión de reservas</h1>
          <p>{subtitulo}</p>
        </div>
      </div>
      {children}
    </div></header>
  );
}

const ICONOS: Record<string, ReactNode> = {
  prevision: <path d="M4 20V11m6 9V5m6 15v-7m4 7H2" />,
  datos: <><ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" /><path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" /></>,
  modelo: <><rect x="6" y="2.5" width="12" height="19" rx="3" /><path d="M10.5 18.5h3" /></>,
};

/** Control segmentado en el ordenador; barra de pestañas con iconos en el móvil. */
export function Pestanas<T extends string>({ opciones, activa, onCambio }: {
  opciones: { id: T; etiqueta: string; icono: keyof typeof ICONOS }[]; activa: T; onCambio: (id: T) => void;
}) {
  const i = Math.max(0, opciones.findIndex(o => o.id === activa));
  return (
    <nav className="pestanas" role="tablist">
      <span className="indicador" style={{ width: `calc((100% - 4px) / ${opciones.length})`, transform: `translateX(${i * 100}%)` }} />
      {opciones.map(o => (
        <button key={o.id} role="tab" aria-selected={o.id === activa} className={o.id === activa ? 'activa' : ''} onClick={() => onCambio(o.id)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONOS[o.icono]}</svg>
          {o.etiqueta}
        </button>
      ))}
    </nav>
  );
}
