export default function SinBackend({ onReintentar }: { onReintentar: () => void }) {
  return (
    <section className="card entrar">
      <h2>Servidor de datos apagado</h2>
      <div className="aviso" style={{ marginTop: 0 }}>
        La web necesita el servidor de datos. Arranca la app con <b>iniciar.bat</b>, o abre una ventana en la carpeta <b>backend</b> y ejecuta <code>.venv\Scripts\uvicorn app.main:app --reload</code>.
      </div>
      <button style={{ marginTop: 14 }} onClick={onReintentar}>Reintentar</button>
    </section>
  );
}
