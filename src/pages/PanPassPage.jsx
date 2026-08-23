import { useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink, Eye, KeyRound } from "lucide-react";
import { usePanPassServicos } from "../hooks/queries/usePanPassServicos";
import { useRevelarCredencial } from "../hooks/mutations/usePanPassMutations";
import { PanTooltip } from "../components/ui/PanTooltip";

const SEGUNDOS_VISIVEL = 60;

function BotaoCopiar({ valor, titulo = "Copiar" }) {
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!copiado) return undefined;
    const timer = setTimeout(() => setCopiado(false), 1500);
    return () => clearTimeout(timer);
  }, [copiado]);

  return (
    <PanTooltip texto={titulo}>
      <button
        className="btn-ghost panpass-copy"
        aria-label={titulo}
        onClick={async () => {
          await navigator.clipboard.writeText(valor);
          setCopiado(true);
        }}
      >
        {copiado ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </PanTooltip>
  );
}

function ServicoCard({ servico }) {
  const revelar = useRevelarCredencial();
  const [segredo, setSegredo] = useState(null); // { valor, expiraEm }
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
  const percentRestante = segredo ? Math.max(0, Math.min(100, (restante / SEGUNDOS_VISIVEL) * 100)) : 0;

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
    <div className="pan-card panpass-card">
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
            <PanTooltip texto="Abrir o site do serviço">
              <a
                className="panpass-abrir"
                href={servico.url_login}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Abrir o site do serviço"
              >
                <ExternalLink size={13} />
              </a>
            </PanTooltip>
          )}
        </div>

        <div className="panpass-credencial">
          <div className="panpass-linha">
            <span className="panpass-rotulo">Login</span>
            <code className="panpass-valor">{servico.usuario}</code>
            <BotaoCopiar valor={servico.usuario} titulo="Copiar login" />
          </div>

          {segredo && (
            <div className="panpass-linha panpass-revelado">
              <span className="panpass-rotulo">Senha</span>
              <code className="panpass-valor panpass-segredo">{segredo.valor}</code>
              <BotaoCopiar valor={segredo.valor} titulo="Copiar senha" />
              <PanTooltip texto="Some automaticamente">
                <span className="panpass-contagem" style={{ "--pct": percentRestante }}>
                  <span className="panpass-contagem-anel" aria-hidden="true" />
                  <span className="panpass-contagem-num">{restante}</span>
                </span>
              </PanTooltip>
            </div>
          )}
        </div>

        {erro && <div className="section-sub panpass-erro">{erro}</div>}

        <div className="panpass-acoes">
          <button className="btn-primary" onClick={pedir} disabled={carregando}>
            <Eye size={14} /> Revelar senha
          </button>
        </div>
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
        <div className="pan-card" style={{ marginBottom: 14 }}>
          <div className="card-body">
            <div className="section-title" style={{ fontSize: 16 }}>Falha ao carregar o PanPass</div>
            <div className="section-sub">{servicosQuery.error?.message}</div>
          </div>
        </div>
      )}

      {!servicosQuery.isLoading && servicos.length === 0 && (
        <div className="pan-card">
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
