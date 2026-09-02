import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";

const validatePassword = (password) => {
  if (password.length < 8) return "A senha deve ter pelo menos 8 caracteres.";
  if (!/[a-z]/.test(password)) return "A senha precisa ter pelo menos uma letra minúscula.";
  if (!/[A-Z]/.test(password)) return "A senha precisa ter pelo menos uma letra maiúscula.";
  if (!/[0-9]/.test(password)) return "A senha precisa ter pelo menos um número.";
  if (!/[^A-Za-z0-9]/.test(password)) return "A senha precisa ter pelo menos um caractere especial.";
  return "";
};

export function PrimeiroAcessoPage({ onConcluir, theme }) {
  const navigate = useNavigate();
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  const forca = nova.length === 0 ? 0 : nova.length < 4 ? 1 : nova.length < 6 ? 2 : nova.length < 8 ? 3 : 4;
  const forcaLabel = ["", "Muito fraca", "Fraca", "Razoável", "Boa força"];
  const forcaCor = ["", "#FF6B6B", "#E8B84B", "#E8955A", "var(--accent)"];

  const salvar = async () => {
    const passwordError = validatePassword(nova);
    if (passwordError) {
      setErro(passwordError);
      return;
    }

    if (nova !== confirma) {
      setErro("As senhas não coincidem.");
      return;
    }

    try {
      setLoading(true);
      setErro("");
      await onConcluir(nova);
      setOk(true);
      // O texto ja diz "Redirecionando...": aqui esta o navigate que faltava
      // -- antes so trocava um estado (tela) que nao controla mais as rotas
      // desde a migracao para react-router, entao a tela ficava presa aqui.
      setTimeout(() => navigate("/", { replace: true }), 700);
    } catch (err) {
      setErro(err?.message || "Não foi possível atualizar a senha.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    await salvar();
  };

  return (
    <div className="login-wrap">
      <div className="login-bg" />
      <div className="login-card">
        <div className="login-logo">
          <img src={theme === "light" ? "/pan-logo-animado-light.svg" : "/pan-logo-animado.svg"} alt="Panet" className="login-logo-image" />
        </div>

        <div
          style={{
            background: "rgba(17,231,231,0.08)",
            border: "1px solid rgba(17,231,231,0.2)",
            borderRadius: 8,
            padding: "12px 14px",
            marginBottom: 24,
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <span style={{ display: "inline-flex" }}><Lock size={18} color="var(--accent)" /></span>
          <div>
            <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: 13, marginBottom: 2 }}>Primeiro acesso detectado</div>
            <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
              Por segurança, você precisa cadastrar uma nova senha antes de continuar.
            </div>
          </div>
        </div>

        <div className="login-title" style={{ fontSize: 18 }}>
          Crie sua nova senha
        </div>
        <div className="login-sub">Ela substituirá a senha temporária enviada pelo administrador.</div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">NOVA SENHA</label>
            <input
              className="form-input"
              type="password"
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              value={nova}
              onChange={(e) => {
                setNova(e.target.value);
                setErro("");
              }}
            />
          </div>

          {nova.length > 0 && (
            <div style={{ marginBottom: 14, marginTop: -8 }}>
              <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: 3,
                      borderRadius: 2,
                      background: forca >= i ? forcaCor[forca] : "var(--border)",
                      transition: "background 0.3s",
                    }}
                  />
                ))}
              </div>
              <div style={{ fontSize: 11, color: forcaCor[forca], transition: "color 0.3s" }}>{forcaLabel[forca]}</div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">CONFIRMAR SENHA</label>
            <input
              className="form-input"
              type="password"
              placeholder="Repita a nova senha"
              autoComplete="new-password"
              value={confirma}
              onChange={(e) => {
                setConfirma(e.target.value);
                setErro("");
              }}
            />
          </div>

          {erro && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{erro}</div>}

          {ok ? (
            <div
              style={{
                background: "rgba(86,211,100,0.1)",
                border: "1px solid rgba(86,211,100,0.3)",
                borderRadius: 8,
                padding: "12px 14px",
                textAlign: "center",
                color: "var(--success)",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Senha criada! Redirecionando...
            </div>
          ) : (
            <button className="btn-primary btn-full" type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar e entrar na Panet"}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

