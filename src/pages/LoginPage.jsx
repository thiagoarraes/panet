import { useState } from "react";

export function LoginPage({ onLogin, theme }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.endsWith("@agenciapan.com")) {
      setError("Use seu e-mail corporativo @agenciapan.com");
      return;
    }
    if (pass.length < 4) {
      setError("Senha inválida.");
      return;
    }
    try {
      setLoading(true);
      await onLogin(email, pass);
    } catch (err) {
      setError(err?.message || "Não foi possível entrar agora.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    await handleLogin();
  };

  return (
    <div className="login-wrap login-wrap--premium">
      <div className="login-bg" />
      <div className="login-bubbles" aria-hidden="true">
        <span className="bubble b1" />
        <span className="bubble b2" />
        <span className="bubble b3" />
        <span className="bubble b4" />
        <span className="bubble b5" />
        <span className="bubble b6" />
        <span className="bubble b7" />
      </div>
      <div className="login-card">
        <div className="login-logo">
          <img src={theme === "light" ? "/pan-logo-light.svg" : "/pan-logo.svg"} alt="Panet" className="login-logo-image" />
        </div>
        <div className="login-title">Olá, Panner!</div>
        <div className="login-sub">Entre com seu email da Pan e acompanhe os bastidores.</div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">SEU E-MAIL DA PAN</label>
            <input
              className="form-input"
              type="email"
              placeholder="seu.nome@agenciapan.com"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">SENHA</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={pass}
              onChange={(e) => {
                setPass(e.target.value);
                setError("");
              }}
            />
          </div>
          {error && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12, marginTop: -4 }}>{error}</div>}
          <button className="btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar na Panet"}
          </button>
        </form>
        <div className="login-domain">Não nos responsabilizamos pelo conteúdo que você irá encontrar.</div>
      </div>
    </div>
  );
}
