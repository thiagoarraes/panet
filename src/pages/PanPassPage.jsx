import { useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink, Eye, KeyRound, Mail, Smartphone, UserRound } from "lucide-react";

// Só http(s) — nunca renderiza javascript:/data: vindo do corpo de um e-mail.
const linkSeguro = (url) => {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? url : null;
  } catch {
    return null;
  }
};
import { usePanPassServicos } from "../hooks/queries/usePanPassServicos";
import { useRevelarCredencial } from "../hooks/mutations/usePanPassMutations";

const SEGUNDOS_VISIVEL = 60;

// A busca automática de código só funciona para caixas @agenciapan.com: é só
// para o domínio da empresa que a delegação do Google Workspace vale — Gmail
// pessoal, Outlook de cliente etc. nunca vão funcionar, então nem mostramos o
// botão. Mesmo padrão de domínio usado no login (LoginPage.jsx).
const ehEmailCorporativo = (email) => Boolean(email?.toLowerCase().endsWith("@agenciapan.com"));

function BotaoCopiar({ valor, titulo = "Copiar" }) {
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!copiado) return undefined;
    const timer = setTimeout(() => setCopiado(false), 1500);
    return () => clearTimeout(timer);
  }, [copiado]);

  return (
    <button
      className="btn-ghost panpass-copy"
      title={titulo}
      aria-label={titulo}
      onClick={async () => {
        await navigator.clipboard.writeText(valor);
        setCopiado(true);
      }}
    >
      {copiado ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

// Só aparece depois que a senha é revelada — antes disso o colaborador nem
// tentou logar, então avisar sobre o código seria ruído fora de hora. Quando
// a caixa não é gerenciada pela empresa, a delegação do Google Workspace não
// alcança — é só um lembrete, não um erro.
function AvisoPedirAoDono() {
  return (
    <div className="panpass-aviso-dono">
      <UserRound size={13} />
      <span>O código de login vai para o e-mail acima — peça ao dono dessa caixa.</span>
    </div>
  );
}

function ServicoCard({ servico }) {
  const revelar = useRevelarCredencial();
  const [segredo, setSegredo] = useState(null); // { valor, rotulo, expiraEm }
  const [agora, setAgora] = useState(() => Date.now());
  const [erro, setErro] = useState("");

  // Um timer descarta o segredo no vencimento; outro só faz a contagem andar.
  // Nenhum setState no corpo do efeito — tudo acontece em callback de timer.
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
  const percentRestante = segredo ? Math.max(0, Math.min(100, (restante / segredo.duracao) * 100)) : 0;

  const pedir = (tipo) => {
    setErro("");
    revelar.mutate(
      { servicoId: servico.id, tipo },
      {
        onSuccess: (data) => {
          const revelado =
            tipo === "senha"
              ? { valor: data.senha, rotulo: "Senha", segundos: SEGUNDOS_VISIVEL, ehLink: false }
              : tipo === "totp"
                ? {
                    valor: data.codigo,
                    rotulo: "Código do autenticador",
                    segundos: data.segundos_restantes || 30,
                    ehLink: false,
                  }
                : data.email_tipo === "link"
                  ? {
                      valor: data.valor,
                      rotulo: "Link de login",
                      segundos: SEGUNDOS_VISIVEL,
                      ehLink: true,
                    }
                  : {
                      valor: data.valor,
                      rotulo: "Código recebido por e-mail",
                      segundos: SEGUNDOS_VISIVEL,
                      ehLink: false,
                    };
          setAgora(Date.now());
          setSegredo({
            valor: revelado.valor,
            rotulo: revelado.rotulo,
            ehLink: revelado.ehLink,
            duracao: revelado.segundos,
            expiraEm: Date.now() + revelado.segundos * 1000,
          });
        },
        onError: (e) => setErro(e.message),
      },
    );
  };

  const carregando = revelar.isPending;
  const codigoPorEmailGerenciado = servico.mfa_tipo === "email" && ehEmailCorporativo(servico.usuario);
  const codigoPorEmailExterno = servico.mfa_tipo === "email" && !ehEmailCorporativo(servico.usuario);

  return (
    <div className="card panpass-card">
      <div className="panpass-card-glow" aria-hidden="true" />
      <div className="card-body">
        <div className="panpass-card-head">
          {servico.logo_url ? (
            <img className="panpass-logo" src={servico.logo_url} alt="" width={40} height={40} />
          ) : (
            <span className="panpass-logo panpass-logo-fallback" aria-hidden="true">
              <KeyRound size={19} />
            </span>
          )}
          <div className="panpass-titulo-wrap">
            <h3 className="panpass-nome">{servico.nome}</h3>
            {servico.categoria && <span className="panpass-categoria">{servico.categoria}</span>}
          </div>
          {servico.url_login && (
            <a
              className="panpass-abrir"
              href={servico.url_login}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir o site do serviço"
            >
              <ExternalLink size={13} />
            </a>
          )}
        </div>

        <div className="panpass-credencial">
          <div className="panpass-linha">
            <span className="panpass-rotulo">Login</span>
            <code className="panpass-valor">{servico.usuario}</code>
            <BotaoCopiar valor={servico.usuario} titulo="Copiar login" />
          </div>

          {segredo && segredo.ehLink && (
            <div className="panpass-linha panpass-revelado panpass-linha-link">
              <a
                className="btn-primary panpass-btn-link"
                href={linkSeguro(segredo.valor) || undefined}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={14} /> Abrir link de login
              </a>
              <BotaoCopiar valor={segredo.valor} titulo="Copiar link" />
              <span
                className="panpass-contagem"
                style={{ "--pct": percentRestante }}
                title="Some automaticamente"
              >
                <span className="panpass-contagem-anel" aria-hidden="true" />
                <span className="panpass-contagem-num">{restante}</span>
              </span>
            </div>
          )}

          {segredo && !segredo.ehLink && (
            <div className="panpass-linha panpass-revelado">
              <span className="panpass-rotulo">{segredo.rotulo}</span>
              <code className="panpass-valor panpass-segredo">{segredo.valor}</code>
              <BotaoCopiar valor={segredo.valor} titulo={`Copiar ${segredo.rotulo.toLowerCase()}`} />
              <span
                className="panpass-contagem"
                style={{ "--pct": percentRestante }}
                title="Some automaticamente"
              >
                <span className="panpass-contagem-anel" aria-hidden="true" />
                <span className="panpass-contagem-num">{restante}</span>
              </span>
            </div>
          )}
        </div>

        {erro && <div className="section-sub panpass-erro">{erro}</div>}

        <div className="panpass-acoes">
          <button className="btn-primary" onClick={() => pedir("senha")} disabled={carregando}>
            <Eye size={14} /> Revelar senha
          </button>

          {servico.mfa_tipo === "totp" && (
            <button className="btn-ghost" onClick={() => pedir("totp")} disabled={carregando}>
              <Smartphone size={14} /> Gerar código
            </button>
          )}

          {codigoPorEmailGerenciado && (
            <button className="btn-ghost" onClick={() => pedir("codigo_email")} disabled={carregando}>
              <Mail size={14} /> Buscar código do e-mail
            </button>
          )}
        </div>

        {codigoPorEmailGerenciado && (
          <div className="section-sub panpass-dica">
            Peça o envio do código na tela do serviço e clique em buscar.
          </div>
        )}

        {codigoPorEmailExterno && segredo && <AvisoPedirAoDono />}
      </div>
    </div>
  );
}

export function PanPassPage() {
  const servicosQuery = usePanPassServicos();
  const [busca, setBusca] = useState("");

  const servicos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const todos = servicosQuery.data || [];
    if (!termo) return todos;
    return todos.filter((s) =>
      `${s.nome} ${s.categoria || ""}`.toLowerCase().includes(termo),
    );
  }, [servicosQuery.data, busca]);

  return (
    <div className="fade-up panpass-page">
      <div className="section-header">
        <div>
          <div className="section-title">PanPass</div>
          <div className="section-sub">
            Acessos dos serviços contratados pela empresa.
          </div>
        </div>
        <input
          className="search-input"
          placeholder="Buscar serviço..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ width: 220 }}
        />
      </div>

      {servicosQuery.isError && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-body">
            <div className="section-title" style={{ fontSize: 16 }}>Falha ao carregar o PanPass</div>
            <div className="section-sub">{servicosQuery.error?.message}</div>
          </div>
        </div>
      )}

      {!servicosQuery.isLoading && servicos.length === 0 && (
        <div className="card">
          <div className="card-body">
            <div className="section-sub">
              {busca ? "Nenhum serviço encontrado." : "Nenhum serviço liberado para você ainda."}
            </div>
          </div>
        </div>
      )}

      <div className="grid-3 stagger panpass-grid">
        {servicos.map((s) => <ServicoCard key={s.id} servico={s} />)}
      </div>
    </div>
  );
}
