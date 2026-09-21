import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Eye, KeyRound, ShieldCheck, Lock, AlertCircle } from "lucide-react";
import "../styles/panpass.css";
import { usePanPassServicos } from "../hooks/queries/usePanPassServicos";
import { useRevelarCredencial } from "../hooks/mutations/usePanPassMutations";
import { PanTooltip } from "../components/ui/PanTooltip";
import { copiarTexto } from "../lib/clipboard";

const SEGUNDOS_VISIVEL = 60;

function BotaoCopiar({ valor, titulo = "Copiar" }) {
  const [estado, setEstado] = useState("");

  useEffect(() => {
    if (!estado) return undefined;
    const timer = setTimeout(() => setEstado(""), 1500);
    return () => clearTimeout(timer);
  }, [estado]);

  const copiado = estado === "ok";
  const falhou = estado === "erro";

  return (
    <PanTooltip texto={copiado ? "Copiado!" : falhou ? "Não foi possível copiar" : titulo}>
      <button
        className="panpass-v2-copy"
        aria-label={titulo}
        onClick={async () => {
          // Antes era um writeText solto: quando o navegador rejeitava (foco,
          // permissao), a promise virava unhandled e o botao nao fazia nada.
          setEstado((await copiarTexto(valor)) ? "ok" : "erro");
        }}
      >
        {copiado ? <Check size={13} /> : falhou ? <AlertCircle size={13} /> : <Copy size={13} />}
      </button>
    </PanTooltip>
  );
}

function ServicoCard({ servico }) {
  const revelar = useRevelarCredencial();
  const [segredo, setSegredo] = useState(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!segredo) return undefined;
    const fim = setTimeout(() => setSegredo(null), Math.max(0, segredo.expiraEm - Date.now()));
    const tick = setInterval(() => setAgora(Date.now()), 500);
    return () => {
      clearTimeout(fim);
      clearInterval(tick);
    };
  }, [segredo]);

  const restante = segredo ? Math.max(0, Math.ceil((segredo.expiraEm - agora) / 1000)) : 0;
  const percentRestante = segredo ? Math.max(0, Math.min(100, (restante / SEGUNDOS_VISIVEL) * 100)) : 0;
  const isUrgente = restante <= 10 && restante > 0;

  const pedir = () => {
    setErro("");
    revelar.mutate(
      { servicoId: servico.id, tipo: "senha" },
      {
        onSuccess: (data) => {
          setAgora(Date.now());
          setSegredo({ valor: data.senha, expiraEm: Date.now() + SEGUNDOS_VISIVEL * 1000 });
        },
        onError: (e) => setErro(e.message),
      },
    );
  };

  const carregando = revelar.isPending;

  return (
    <div className="panpass-v2-card">
      <div className="panpass-v2-card-glow" aria-hidden="true" />

      <div className="panpass-v2-card-head">
        <div className="panpass-v2-logo-wrap">
          {servico.logo_url ? (
            <img className="panpass-v2-logo" src={servico.logo_url} alt="" width={44} height={44} loading="lazy" />
          ) : (
            <span className="panpass-v2-logo panpass-v2-logo-fallback" aria-hidden="true">
              <KeyRound size={20} />
            </span>
          )}
        </div>
        <div className="panpass-v2-titulo-wrap">
          <h3 className="panpass-v2-nome">{servico.nome}</h3>
          {servico.categoria && (
            <span className="panpass-v2-categoria">{servico.categoria}</span>
          )}
        </div>
        {servico.url_login && (
          <PanTooltip texto="Abrir o site do serviço">
            <a
              className="panpass-v2-abrir"
              href={servico.url_login}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir o site do serviço"
            >
              <ExternalLink size={14} />
            </a>
          </PanTooltip>
        )}
      </div>

      <div className="panpass-v2-creds">
        <div className="panpass-v2-linha">
          <div className="panpass-v2-linha-info">
            <span className="panpass-v2-rotulo">Login</span>
            <code className="panpass-v2-valor">{servico.usuario}</code>
          </div>
          <BotaoCopiar valor={servico.usuario} titulo="Copiar login" />
        </div>

        {segredo ? (
          <div className={`panpass-v2-linha panpass-v2-revelado ${isUrgente ? "panpass-v2-urgente" : ""}`}>
            <div className="panpass-v2-linha-info">
              <span className="panpass-v2-rotulo">Senha</span>
              <code className="panpass-v2-valor panpass-v2-segredo">{segredo.valor}</code>
            </div>
            <div className="panpass-v2-linha-acoes">
              <BotaoCopiar valor={segredo.valor} titulo="Copiar senha" />
              <PanTooltip texto={isUrgente ? "Expira em breve!" : "Some automaticamente"}>
                <span
                  className={`panpass-v2-contagem ${isUrgente ? "panpass-v2-contagem--alerta" : ""}`}
                  style={{ "--pct": percentRestante }}
                >
                  <span className="panpass-v2-contagem-anel" aria-hidden="true" />
                  <span className="panpass-v2-contagem-num">{restante}</span>
                </span>
              </PanTooltip>
            </div>
          </div>
        ) : (
          <div className="panpass-v2-linha panpass-v2-oculto">
            <div className="panpass-v2-linha-info">
              <span className="panpass-v2-rotulo">Senha</span>
              <span className="panpass-v2-mascarado">
                <Lock size={12} />
                ••••••••
              </span>
            </div>
          </div>
        )}
      </div>

      {erro && (
        <div className="panpass-v2-erro">
          <AlertCircle size={14} />
          {erro}
        </div>
      )}

      <button
        className={`panpass-v2-btn-reveal ${segredo ? "panpass-v2-btn-reveal--ativo" : ""}`}
        onClick={pedir}
        disabled={carregando || !!segredo}
        type="button"
      >
        {carregando ? (
          <>
            <span className="panpass-v2-spinner" />
            Revelando...
          </>
        ) : segredo ? (
          <>
            <ShieldCheck size={14} />
            Senha visível · {restante}s
          </>
        ) : (
          <>
            <Eye size={14} />
            Revelar senha
          </>
        )}
      </button>
    </div>
  );
}

export function PanPassPage() {
  const servicosQuery = usePanPassServicos();

  const servicos = servicosQuery.data || [];
  const totalServicos = servicos.length;

  return (
    <div className="panpass-v2-page">
      {/* Hero Banner */}
      <div className="panpass-v2-hero">
        <div className="panpass-v2-hero-bg" aria-hidden="true" />
        <div className="panpass-v2-hero-content">
          <div className="panpass-v2-hero-text">
            <div className="panpass-v2-hero-badge">
              <ShieldCheck size={12} />
              Acesso seguro
            </div>
            <h1 className="panpass-v2-hero-titulo">PanPass</h1>
            <p className="panpass-v2-hero-sub">
              Acesse as credenciais dos serviços que a Pan utiliza no dia a dia.
              Por segurança, as senhas ficam visíveis por apenas 60 segundos.
            </p>
          </div>
          <div className="panpass-v2-hero-stats">
            <div className="panpass-v2-stat">
              <span className="panpass-v2-stat-num">{totalServicos}</span>
              <span className="panpass-v2-stat-label">Serviços disponíveis</span>
            </div>
            <div className="panpass-v2-stat">
              <span className="panpass-v2-stat-num">{SEGUNDOS_VISIVEL}s</span>
              <span className="panpass-v2-stat-label">Tempo de visibilidade</span>
            </div>
          </div>
        </div>
      </div>

      {/* Erro global */}
      {servicosQuery.isError && (
        <div className="panpass-v2-error-banner">
          <AlertCircle size={18} />
          <div>
            <strong>Falha ao carregar o PanPass</strong>
            <p>{servicosQuery.error?.message}</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {servicosQuery.isLoading && (
        <div className="panpass-v2-loading">
          <div className="panpass-v2-loading-spinner" />
          <span>Carregando serviços...</span>
        </div>
      )}

      {/* Estado vazio */}
      {!servicosQuery.isLoading && servicos.length === 0 && (
        <div className="panpass-v2-empty">
          <div className="panpass-v2-empty-icon">
            <KeyRound size={28} />
          </div>
          <h3 className="panpass-v2-empty-titulo">Nenhum serviço disponível</h3>
          <p className="panpass-v2-empty-sub">
            Você ainda não tem acesso a nenhum serviço. Fale com o administrador.
          </p>
        </div>
      )}

      {/* Grid de cards */}
      {servicos.length > 0 && (
        <div className="panpass-v2-grid">
          {servicos.map((s) => <ServicoCard key={s.id} servico={s} />)}
        </div>
      )}
    </div>
  );
}