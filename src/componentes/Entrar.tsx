import { useEffect, useState } from 'react';
import { api, type Yo } from '../servicios/api';

/** Pantalla de inicio de sesión. Si aún no hay ninguna cuenta, sirve para crear la primera. */
export default function Entrar({ onDentro, onSinBackend }: { onDentro: (yo: Yo) => void; onSinBackend: () => void }) {
  const [primeraVez, setPrimeraVez] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [restaurante, setRestaurante] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.primeraVez().then(r => setPrimeraVez(r.primera_vez)).catch(onSinBackend);
  }, [onSinBackend]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true); setError('');
    try {
      onDentro(primeraVez ? await api.registro(email, contrasena, restaurante) : await api.login(email, contrasena));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  if (primeraVez === null) return <div className="cargando">Cargando…</div>;
  return (
    <section className="card entrar">
      <h2>{primeraVez ? 'Crear la primera cuenta' : 'Entrar'}</h2>
      {primeraVez && <p className="nota" style={{ marginTop: 0, marginBottom: 16 }}>Todavía no hay ninguna cuenta. La que crees ahora será la del restaurante.</p>}
      <form onSubmit={enviar}>
        {primeraVez && (
          <div className="campo">
            <label htmlFor="rest">Restaurante</label>
            <input id="rest" value={restaurante} onChange={e => setRestaurante(e.target.value)} required />
          </div>
        )}
        <div className="campo">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="campo">
          <label htmlFor="pass">Contraseña{primeraVez ? ' (mínimo 8 caracteres)' : ''}</label>
          <input id="pass" type="password" autoComplete={primeraVez ? 'new-password' : 'current-password'} minLength={primeraVez ? 8 : undefined}
            value={contrasena} onChange={e => setContrasena(e.target.value)} required />
        </div>
        <button className="primario" disabled={enviando}>{enviando ? '…' : primeraVez ? 'Crear cuenta y entrar' : 'Entrar'}</button>
        {error && <div className="aviso">{error}</div>}
      </form>
    </section>
  );
}
