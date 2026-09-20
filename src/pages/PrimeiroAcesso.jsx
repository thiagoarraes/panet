import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Check, X, Eye, EyeOff } from "lucide-react";
import { REQUISITOS_SENHA, requisitosPendentes } from "../lib/senhaRequisitos";

// O projeto nao tem utilitario .sr-only global (o .vibe-sr-only e de outro escopo).
const SR_ONLY = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

function CampoSenha({ id, label, placeholder, valor, onChange, visivel, onToggleVisivel }) {
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          id={id}
          className="form-input"
          type={visivel ? "text" : "password"}
          placeholder={placeholder}
          autoComplete="new-password"
          value={valor}
          onChange={onChange}
          style={{ paddingRight: 42, width: "100%" }}
        />
        <button
          type="button"
          onClick={onToggleVisivel}
          aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visivel}
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            padding: 0,
            border: "none",
            borderRadius: 6,
            background: "transparent",
            color: "var(--muted)",
            cursor: "pointer",
          }}
        >
          {visivel ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

export function PrimeiroAcessoPage({ onConcluir, theme }) {
  const navigate = useNavigate();
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verNova, setVerNova] = useState(false);
  const [verConfirma, setVerConfirma] = useState(false);

  const pendentes = requisitosPendentes(nova);
  const atendidos = REQUISITOS_SENHA.length - pendentes.length;
  const senhaValida = pendentes.length === 0;
  const confirmaTocado = confirma.length > 0;
  const senhasIguais = nova === confirma;

  const salvar = async () => {
    if (!senhaValida) {
      setErro("A senha ainda não atende aos requisitos abaixo do campo.");
      return;
    }

    if (!senhasIguais) {
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
          <span style={{ display: "inline-flex" }}><Lock size={18} color="var(--accent)" aria-hidden="true" /></span>
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
          <CampoSenha
            id="primeiro-acesso-senha"
            label="NOVA SENHA"
            placeholder="Crie uma senha"
            valor={nova}
            onChange={(e) => {
              setNova(e.target.value);
              setErro("");
            }}
            visivel={verNova}
            onToggleVisivel={() => setVerNova((v) => !v)}
          />

          {/* Requisitos sempre visiveis: a pessoa nao pode descobrir a regra so
              depois de apanhar no submit. */}
          <div style={{ marginTop: -6, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 4, marginBottom: 8 }} aria-hidden="true">
              {REQUISITOS_SENHA.map((r, i) => (
                <div
                  key={r.id}
                  style={{
                    flex: 1,
                    height: 3,
                    borderRadius: 2,
                    background: i < atendidos ? (senhaValida ? "var(--success)" : "var(--accent)") : "var(--border)",
                    transition: "background 0.3s",
                  }}
                />
              ))}
            </div>

            <ul
              aria-live="polite"
              style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}
            >
              {REQUISITOS_SENHA.map((r) => {
                const atende = r.teste(nova);
                return (
                  <li
                    key={r.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      fontSize: 12,
                      lineHeight: 1.4,
                      color: atende ? "var(--success)" : "var(--muted)",
                      transition: "color 0.2s",
                    }}
                  >
                    <span style={{ display: "inline-flex", flexShrink: 0 }}>
                      {atende
                        ? <Check size={13} aria-hidden="true" />
                        : <span style={{
                            display: "inline-block",
                            width: 13,
                            height: 13,
                            borderRadius: "50%",
                            border: "1.5px solid var(--border)",
                          }} />}
                    </span>
                    <span>{r.label}</span>
                    <span style={SR_ONLY}>{atende ? " — requisito atendido" : " — pendente"}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <CampoSenha
            id="primeiro-acesso-confirmar"
            label="CONFIRMAR SENHA"
            placeholder="Repita a nova senha"
            valor={confirma}
            onChange={(e) => {
              setConfirma(e.target.value);
              setErro("");
            }}
            visivel={verConfirma}
            onToggleVisivel={() => setVerConfirma((v) => !v)}
          />

          {confirmaTocado && (
            <div
              aria-live="polite"
              style={{
                marginTop: -8,
                marginBottom: 12,
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: senhasIguais ? "var(--success)" : "var(--danger)",
              }}
            >
              {senhasIguais ? <Check size={13} aria-hidden="true" /> : <X size={13} aria-hidden="true" />}
              <span>{senhasIguais ? "As senhas coincidem." : "As senhas não coincidem."}</span>
            </div>
          )}

          {erro && (
            <div role="alert" style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>
              {erro}
            </div>
          )}

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
