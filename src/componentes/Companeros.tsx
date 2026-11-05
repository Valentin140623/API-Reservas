import { useCallback, useEffect, useState } from 'react';
import { api } from '../servicios/api';

/** Contraseña fácil de dictar: 3 bloques de letras y números sin caracteres que se confundan. */
function contrasenaAleatoria() {
  const c = 'abcdefghjkmnpqrstuvwxyz23456789';
  const r = crypto.getRandomValues(new Uint32Array(12));
  return [0, 4, 8].map(i => [...r.slice(i, i + 4)].map(n => c[n % c.length]).join('')).join('-');
}

/** Crear usuarios para los compañeros del mismo restaurante y pasarles el acceso. */
export default function Companeros() {
  const [lista, setLista] = useState<{ email: string; tu: boolean }[]>([]);
  const [email, setEmail] = useState('');
  const [creado, setCreado] = useState<{ email: string; contrasena: string } | null>(null);
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState(false);

  const recargar = useCallback(() => { api.usuarios().then(setLista).catch(() => {}); }, []);
  useEffect(recargar, [recargar]);

  const invitar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setCreado(null); setCopiado(false);
    const contrasena = contrasenaAleatoria();
    try {
      await api.invitar(email, contrasena);
      setCreado({ email: email.trim().toLowerCase(), contrasena });
      setEmail('');
      recargar();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const mensaje = creado &&
    `Te he dado acceso a la previsión de comensales.\nEntra en ${location.origin}${location.pathname}\nUsuario: ${creado.email}\nContraseña: ${creado.contrasena}\nEn el móvil puedes añadirla a la pantalla de inicio para abrirla como una app.`;

  const compartir = async () => {
    if (!mensaje) return;
    if (navigator.share) {
      try { await navigator.share({ text: mensaje }); return; } catch { /* cancelado: copiamos */ }
    }
    await navigator.clipboard.writeText(mensaje);
    setCopiado(true);
  };

  return (
    <section className="card semana">
      <h2>Compañeros</h2>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <form onSubmit={invitar}>
          <div className="campo">
            <label htmlFor="inv">Email del compañero</label>
            <input id="inv" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="nombre@ejemplo.com" />
          </div>
          <button className="primario">Invitar compañero</button>
          {error && <div className="aviso">{error}</div>}
          {creado && (
            <div className="invitacion">
              <div className="nota" style={{ marginTop: 0 }}>Cuenta creada. Mándale esto (la contraseña no se vuelve a mostrar):</div>
              <pre>{mensaje}</pre>
              <button onClick={compartir} type="button">{copiado ? '✓ Copiado' : 'Enviar por WhatsApp / copiar'}</button>
            </div>
          )}
        </form>
        <div>
          <label>Con acceso a este restaurante</label>
          <table className="tabla">
            <tbody>
              {lista.map(u => (
                <tr key={u.email}>
                  <td>{u.email}{u.tu ? ' (tú)' : ''}</td>
                  <td style={{ textAlign: 'right' }}>
                    {!u.tu && <button type="button" onClick={() => api.quitarUsuario(u.email).then(recargar)}>Quitar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
