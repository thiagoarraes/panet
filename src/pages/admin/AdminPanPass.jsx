import { useMemo, useState } from "react";
import {
  Activity, AlertTriangle, Check, ClipboardPaste, Download, Eye, KeyRound, Mail,
  Pencil, Plus, Search, ShieldCheck, Smartphone, Trash2, UserCheck, Users, X,
} from "lucide-react";
import { Avatar } from "../../components/Avatar";
import {
  useAdminPanPassAcessos,
  useAdminPanPassServicos,
} from "../../hooks/queries/admin/useAdminPanPass";
import {
  useExcluirServicoPanPass,
  useSalvarServicoPanPass,
} from "../../hooks/mutations/usePanPassMutations";
import { useColaboradores } from "../../hooks/queries/useColaboradores";
import "../../styles/panpass.css";

const VAZIO = {
  id: null,
  nome: "",
  categoria: "",
  url_login: "",
  logo_url: "",
  usuario: "",
  senha: "",
  mfa_tipo: "nenhum",
  totp_secret: "",
  restrito_a: [],
  ativo: true,
};

// Só caixa @agenciapan.com está sob a delegação do Google Workspace — é o que
// permite o PanPass buscar o código sozinho. Mesma regra de PanPassPage.jsx e
// de panpass-reveal/index.ts; detectado automaticamente, sem toggle manual
// (um admin já esqueceu de marcar isso à mão e quebrou o fluxo do colaborador).
const ehEmailCorporativo = (email) => Boolean(email?.toLowerCase().endsWith("@agenciapan.com"));

const ACAO = {
  senha: { label: "Senha", Icon: Eye },
  totp: { label: "Código TOTP", Icon: Smartphone },
  codigo_email: { label: "Código por e-mail", Icon: Mail },
};

const MFA = {
  nenhum: { label: "Sem 2FA", desc: "Só login e senha", Icon: KeyRound },
  totp: { label: "Autenticador", desc: "Código de 6 dígitos", Icon: Smartphone },
  email: { label: "Por e-mail", desc: "Código enviado na hora", Icon: Mail },
};

// Base32 (RFC 4648) é o formato em que todo serviço entrega o secret do TOTP.
// Validar no cadastro evita descobrir o erro só quando o colaborador precisa.
const BASE32_VALIDO = /^[A-Z2-7]+=*$/;
const normalizarSecret = (v) => String(v || "").toUpperCase().replace(/[\s-]/g, "");

const formatarData = (iso) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

const iniciais = (nome) =>
  (nome || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

function StatTile({ Icon, valor, rotulo, tom }) {
  return (
    <div className={`pp-stat ${tom ? `is-${tom}` : ""}`}>
      <span className="pp-stat-icone"><Icon size={15} /></span>
      <div>
        <div className="pp-stat-valor">{valor}</div>
        <div className="pp-stat-rotulo">{rotulo}</div>
      </div>
    </div>
  );
}

// Substitui o `select multiple` (que ocupava seis linhas fixas) por dois modos:
// "toda a equipe" não gasta espaço nenhum; "escolher pessoas" abre chips com
// avatar e uma busca que só cresce conforme o uso.
function SeletorColaboradores({ colaboradores, selecionados, onChange }) {
  const [busca, setBusca] = useState("");
  const restrito = selecionados.length > 0;

  const porId = useMemo(
    () => new Map(colaboradores.map((c) => [c.id, c])),
    [colaboradores],
  );

  const sugestoes = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return colaboradores
      .filter((c) => !selecionados.includes(c.id))
      .filter((c) => (termo ? c.nome.toLowerCase().includes(termo) : true))
      .slice(0, 24);
  }, [colaboradores, selecionados, busca]);

  const alternarModo = (paraRestrito) => {
    if (!paraRestrito) onChange([]);
    else if (selecionados.length === 0 && colaboradores[0]) onChange([colaboradores[0].id]);
  };

  return (
    <div className="pp-acesso">
      <div className="pp-mfa-grid is-duplo" role="radiogroup" aria-label="Quem pode acessar">
        <button
          type="button"
          role="radio"
          aria-checked={!restrito}
          className={`pp-mfa-card ${restrito ? "" : "is-ativa"}`}
          onClick={() => alternarModo(false)}
        >
          <span className="pp-mfa-card-icone"><Users size={16} /></span>
          <span className="pp-mfa-card-label">Toda a equipe</span>
          <span className="pp-mfa-card-desc">Todos os {colaboradores.length} colaboradores</span>
          {!restrito && <Check size={13} className="pp-mfa-card-check" />}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={restrito}
          className={`pp-mfa-card ${restrito ? "is-ativa" : ""}`}
          onClick={() => alternarModo(true)}
        >
          <span className="pp-mfa-card-icone"><UserCheck size={16} /></span>
          <span className="pp-mfa-card-label">Escolher pessoas</span>
          <span className="pp-mfa-card-desc">
            {restrito ? `${selecionados.length} com acesso` : "Restringir a alguns"}
          </span>
          {restrito && <Check size={13} className="pp-mfa-card-check" />}
        </button>
      </div>

      {restrito && (
        <div className="pp-mfa-painel">
          <div className="pp-mfa-painel-topo">
            <span className="pp-mfa-painel-label">
              Com acesso
              <span className="pp-badge-fmt">{selecionados.length}</span>
            </span>
            {selecionados.length > 0 && (
              <button type="button" className="pp-limpar-tudo" onClick={() => onChange([])}>
                limpar
              </button>
            )}
          </div>

          <div className="pp-chips-pessoas">
            {selecionados.map((id) => {
              const c = porId.get(id);
              if (!c) return null;
              return (
                <span key={id} className="pp-pessoa-chip">
                  <Avatar col={c} size={18} />
                  {c.nome}
                  <button
                    type="button"
                    className="pp-pessoa-remover"
                    aria-label={`Remover ${c.nome}`}
                    onClick={() => onChange(selecionados.filter((x) => x !== id))}
                  >
                    <X size={11} />
                  </button>
                </span>
              );
            })}
          </div>

          <div className="pp-busca pp-busca-pessoas">
            <Search size={13} />
            <input
              placeholder="Buscar colaborador..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          {sugestoes.length > 0 ? (
            <ul className="pp-sugestoes">
              {sugestoes.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => { onChange([...selecionados, c.id]); setBusca(""); }}>
                    <Avatar col={c} size={22} />
                    <span className="pp-sugestao-nome">{c.nome}</span>
                    {c.cargo && <span className="pp-sugestao-cargo">{c.cargo}</span>}
                    <Plus size={12} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="pp-ajuda">
              {busca ? "Ninguém encontrado com esse nome." : "Todo mundo já foi adicionado."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ServicoModal({ inicial, colaboradores, onFechar }) {
  const salvar = useSalvarServicoPanPass();
  const [form, setForm] = useState(inicial);
  const [erro, setErro] = useState("");
  const editando = Boolean(inicial.id);

  const set = (campo) => (e) =>
    setForm((f) => ({
      ...f,
      [campo]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  // Só acusa formato errado depois que o admin digitou algo — campo vazio na
  // edição é válido (significa "mantém o secret atual").
  const secretInvalido =
    form.mfa_tipo === "totp" &&
    Boolean(form.totp_secret) &&
    !BASE32_VALIDO.test(form.totp_secret);

  const colarSecret = async () => {
    try {
      const texto = await navigator.clipboard.readText();
      setForm((f) => ({ ...f, totp_secret: normalizarSecret(texto) }));
    } catch {
      // Sem permissão de leitura da área de transferência: o admin digita.
    }
  };

  const submeter = (e) => {
    e.preventDefault();
    if (secretInvalido) return;
    setErro("");
    salvar.mutate(form, { onSuccess: onFechar, onError: (err) => setErro(err.message) });
  };

  return (
    <div
      className="modal-overlay"
      style={{ alignItems: "center", justifyItems: "center" }}
      onClick={onFechar}
    >
      <div
        className="modal pp-modal"
        style={{ maxWidth: 660, width: "min(660px, calc(100vw - 40px))", margin: "0 auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="pp-modal-icone"><KeyRound size={16} /></span>
            <div>
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17 }}>
                {editando ? "Editar serviço" : "Novo serviço"}
              </div>
              <div className="section-sub" style={{ fontSize: 11 }}>
                A senha é cifrada no servidor e nunca volta para o navegador
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onFechar}>×</button>
        </div>

        <form className="modal-body" onSubmit={submeter}>
          <div className="pp-fieldset">
            <div className="pp-fieldset-titulo">Identificação</div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">NOME *</label>
                <input className="form-input" value={form.nome} onChange={set("nome")} required placeholder="Claude" />
              </div>
              <div className="form-group">
                <label className="form-label">URL DE LOGIN</label>
                <input className="form-input" type="url" value={form.url_login} onChange={set("url_login")} placeholder="https://claude.ai/login" />
              </div>
            </div>
          </div>

          <div className="pp-fieldset">
            <div className="pp-fieldset-titulo">Credencial</div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">LOGIN / E-MAIL *</label>
                <input className="form-input" value={form.usuario} onChange={set("usuario")} required />
              </div>
              <div className="form-group">
                <label className="form-label">
                  SENHA {editando ? "· vazio mantém a atual" : "*"}
                </label>
                <input
                  className="form-input"
                  type="password"
                  autoComplete="new-password"
                  value={form.senha}
                  onChange={set("senha")}
                  required={!editando}
                  placeholder={editando ? "••••••••" : ""}
                />
              </div>
            </div>
          </div>

          <div className="pp-fieldset">
            <div className="pp-fieldset-titulo">Verificação em duas etapas</div>

            <div className="pp-mfa-grid" role="radiogroup" aria-label="Verificação em duas etapas">
              {Object.entries(MFA).map(([valor, { label, desc, Icon }]) => {
                const ativa = form.mfa_tipo === valor;
                return (
                  <button
                    key={valor}
                    type="button"
                    role="radio"
                    aria-checked={ativa}
                    className={`pp-mfa-card ${ativa ? "is-ativa" : ""}`}
                    onClick={() => setForm((f) => ({ ...f, mfa_tipo: valor }))}
                  >
                    <span className="pp-mfa-card-icone"><Icon size={16} /></span>
                    <span className="pp-mfa-card-label">{label}</span>
                    <span className="pp-mfa-card-desc">{desc}</span>
                    {ativa && <Check size={13} className="pp-mfa-card-check" />}
                  </button>
                );
              })}
            </div>

            {form.mfa_tipo === "totp" && (
              <div className="pp-mfa-painel">
                <div className="pp-mfa-painel-topo">
                  <label className="pp-mfa-painel-label" htmlFor="pp-totp-secret">
                    Secret do autenticador
                    <span className="pp-badge-fmt">Base32</span>
                  </label>
                  {editando && <span className="pp-mfa-painel-hint">vazio mantém o atual</span>}
                </div>

                <div className={`pp-input-acao ${secretInvalido ? "is-invalido" : ""}`}>
                  <input
                    id="pp-totp-secret"
                    className="pp-input-mono"
                    autoComplete="off"
                    spellCheck={false}
                    value={form.totp_secret}
                    onChange={(e) => setForm((f) => ({ ...f, totp_secret: normalizarSecret(e.target.value) }))}
                    placeholder="JBSWY3DPEHPK3PXP"
                    aria-invalid={secretInvalido}
                  />
                  {form.totp_secret && !secretInvalido && (
                    <span className="pp-input-ok" title="Base32 válido"><Check size={13} /></span>
                  )}
                  <button type="button" className="pp-input-btn" onClick={colarSecret} title="Colar da área de transferência">
                    <ClipboardPaste size={13} />
                  </button>
                </div>

                {secretInvalido ? (
                  <div className="pp-ajuda pp-ajuda-erro">
                    <AlertTriangle size={11} /> Só letras A–Z e números 2–7. Confira o secret copiado do serviço.
                  </div>
                ) : (
                  <div className="pp-ajuda">
                    O PanPass gera o código de 6 dígitos sozinho — ninguém precisa consultar o celular.
                  </div>
                )}
              </div>
            )}

            {form.mfa_tipo === "email" && form.usuario && (
              <div className="pp-mfa-painel">
                {ehEmailCorporativo(form.usuario) ? (
                  <div className="pp-status-ok">
                    <Mail size={12} /> Domínio @agenciapan.com — o PanPass busca o código sozinho.
                  </div>
                ) : (
                  <div className="pp-status-aviso">
                    <AlertTriangle size={12} /> Fora do domínio da empresa — o colaborador verá um
                    aviso para pedir o código direto ao dono do e-mail de login.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pp-fieldset">
            <div className="pp-fieldset-titulo">Quem pode acessar</div>
            <SeletorColaboradores
              colaboradores={colaboradores}
              selecionados={form.restrito_a}
              onChange={(ids) => setForm((f) => ({ ...f, restrito_a: ids }))}
            />

            <label className="pp-switch-linha">
              <span className="pp-switch-texto">
                <span className="pp-switch-titulo">Serviço ativo</span>
                <span className="pp-switch-desc">
                  {form.ativo
                    ? "Aparece no PanPass para quem tem acesso."
                    : "Fica oculto no PanPass, mas o cadastro é preservado."}
                </span>
              </span>
              <span className="pp-switch">
                <input type="checkbox" checked={form.ativo} onChange={set("ativo")} />
                <span className="pp-switch-trilho"><span className="pp-switch-bolinha" /></span>
              </span>
            </label>
          </div>

          {erro && (
            <div className="pp-erro-box">
              <AlertTriangle size={14} />
              <span>{erro}</span>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <button type="button" className="btn-ghost" onClick={onFechar}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={salvar.isPending || secretInvalido}>
              {salvar.isPending ? "Salvando..." : editando ? "Salvar alterações" : "Cadastrar serviço"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmarExclusao({ servico, onFechar }) {
  const excluir = useExcluirServicoPanPass();
  return (
    <div className="modal-overlay" style={{ alignItems: "center", justifyItems: "center" }} onClick={onFechar}>
      <div
        className="modal"
        style={{ maxWidth: 420, width: "min(420px, calc(100vw - 40px))", margin: "0 auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16 }}>Excluir serviço</div>
          <button className="modal-close" onClick={onFechar}>×</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 4 }}>
            Excluir <strong>{servico.nome}</strong>? A credencial é apagada em definitivo.
          </p>
          <p className="section-sub" style={{ fontSize: 12 }}>
            O histórico de acessos é preservado para auditoria.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
            <button
              className="btn-primary pp-btn-perigo"
              disabled={excluir.isPending}
              onClick={() => excluir.mutate(servico.id, { onSuccess: onFechar })}
            >
              {excluir.isPending ? "Excluindo..." : "Excluir"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ServicoCard({ servico, onEditar, onExcluir }) {
  const mfa = MFA[servico.mfa_tipo] || MFA.nenhum;
  return (
    <article className={`pp-servico ${servico.ativo ? "" : "is-inativo"}`}>
      <div className="pp-servico-topo">
        {servico.logo_url ? (
          <img className="pp-servico-logo" src={servico.logo_url} alt="" width={38} height={38} />
        ) : (
          <span className="pp-servico-logo pp-servico-logo-vazio">{iniciais(servico.nome)}</span>
        )}
        <div className="pp-servico-id">
          <h3 className="pp-servico-nome">{servico.nome}</h3>
          {servico.categoria && <span className="pp-servico-cat">{servico.categoria}</span>}
        </div>
        <div className="pp-servico-acoes">
          <button className="pp-icon-btn" title="Editar" onClick={() => onEditar(servico)}>
            <Pencil size={14} />
          </button>
          <button className="pp-icon-btn is-perigo" title="Excluir" onClick={() => onExcluir(servico)}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="pp-servico-login">{servico.usuario}</div>

      <div className="pp-tags">
        <span className="pp-tag"><mfa.Icon size={11} /> {mfa.label}</span>
        {servico.mfa_tipo === "email" && !ehEmailCorporativo(servico.usuario) && (
          <span className="pp-tag is-aviso" title="Fora do domínio da empresa — busca automática desativada">
            <AlertTriangle size={11} /> Pedir ao dono
          </span>
        )}
        <span className="pp-tag">
          <Users size={11} />
          {servico.restrito_a?.length ? `${servico.restrito_a.length} pessoa(s)` : "Toda a equipe"}
        </span>
        <span className={`pp-tag ${servico.ativo ? "is-ok" : "is-off"}`}>
          <span className="pp-ponto" /> {servico.ativo ? "Ativo" : "Inativo"}
        </span>
      </div>
    </article>
  );
}

export function AdminPanPass({ currentUserId }) {
  const servicosQuery = useAdminPanPassServicos();
  const acessosQuery = useAdminPanPassAcessos();
  const colaboradoresQuery = useColaboradores(currentUserId, { summaryOnly: true });
  const [modal, setModal] = useState(null);
  const [excluindo, setExcluindo] = useState(null);
  const [busca, setBusca] = useState("");
  const [filtroAcao, setFiltroAcao] = useState("todas");
  // Instante fixo da montagem: a janela de "7 dias" não pode mudar a cada render.
  const [montadoEm] = useState(() => Date.now());

  // Os `|| []` viram useMemo próprios: sem isso a identidade muda a cada render
  // e invalida os useMemo abaixo.
  const servicosTodos = useMemo(() => servicosQuery.data || [], [servicosQuery.data]);
  const acessos = useMemo(() => acessosQuery.data || [], [acessosQuery.data]);
  const colaboradores = colaboradoresQuery.data || [];

  const servicos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return servicosTodos;
    return servicosTodos.filter((s) =>
      `${s.nome} ${s.categoria || ""} ${s.usuario}`.toLowerCase().includes(termo),
    );
  }, [servicosTodos, busca]);

  const acessosFiltrados = useMemo(
    () => (filtroAcao === "todas" ? acessos : acessos.filter((a) => a.acao === filtroAcao)),
    [acessos, filtroAcao],
  );

  const stats = useMemo(() => {
    const seteDias = montadoEm - 7 * 24 * 60 * 60 * 1000;
    return {
      ativos: servicosTodos.filter((s) => s.ativo).length,
      total: servicosTodos.length,
      recentes: acessos.filter((a) => new Date(a.created_at).getTime() >= seteDias).length,
      falhas: acessos.filter((a) => !a.sucesso).length,
    };
  }, [servicosTodos, acessos, montadoEm]);

  const baixarCsv = () => {
    const linhas = [
      ["Data", "Colaborador", "Servico", "Acao", "Sucesso", "IP"].join(";"),
      ...acessosFiltrados.map((a) =>
        [
          formatarData(a.created_at),
          a.colaborador?.nome || "-",
          a.servico?.nome || "-",
          ACAO[a.acao]?.label || a.acao,
          a.sucesso ? "sim" : "nao",
          a.ip || "-",
        ].join(";"),
      ),
    ];
    const url = URL.createObjectURL(
      new Blob([linhas.join("\n")], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `panpass-acessos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fade-up pp-admin">
      <header className="pp-hero">
        <div className="pp-hero-texto">
          <span className="pp-hero-selo"><ShieldCheck size={12} /> Cofre auditado</span>
          <h2 className="pp-hero-titulo">PanPass</h2>
          <p className="pp-hero-sub">
            Credenciais dos serviços contratados. As senhas ficam cifradas no banco e só
            saem por função autenticada — cada consulta vira registro.
          </p>
        </div>
        <div className="pp-stats">
          <StatTile Icon={KeyRound} valor={stats.ativos} rotulo="serviços ativos" />
          <StatTile Icon={Activity} valor={stats.recentes} rotulo="consultas em 7 dias" />
          <StatTile
            Icon={AlertTriangle}
            valor={stats.falhas}
            rotulo="tentativas negadas"
            tom={stats.falhas > 0 ? "alerta" : null}
          />
        </div>
      </header>

      <section className="pp-secao">
        <div className="pp-secao-cabeca">
          <div>
            <h3 className="pp-secao-titulo">Serviços</h3>
            <span className="pp-secao-sub">
              {stats.total} {stats.total === 1 ? "cadastrado" : "cadastrados"}
            </span>
          </div>
          <div className="pp-secao-acoes">
            <div className="pp-busca">
              <Search size={14} />
              <input
                placeholder="Buscar serviço..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <button className="btn-primary pp-btn-novo" onClick={() => setModal(VAZIO)}>
              <Plus size={14} /> Novo serviço
            </button>
          </div>
        </div>

        {servicos.length === 0 ? (
          <div className="pp-vazio">
            <span className="pp-vazio-icone"><KeyRound size={20} /></span>
            <div className="pp-vazio-titulo">
              {busca ? "Nenhum serviço encontrado" : "Nenhum serviço cadastrado"}
            </div>
            <div className="pp-vazio-sub">
              {busca
                ? "Tente outro termo de busca."
                : "Cadastre o primeiro serviço para a equipe parar de pedir senha no chat."}
            </div>
          </div>
        ) : (
          <div className="pp-servicos-grid">
            {servicos.map((s) => (
              <ServicoCard
                key={s.id}
                servico={s}
                onEditar={(sv) =>
                  setModal({ ...VAZIO, ...sv, senha: "", totp_secret: "", restrito_a: sv.restrito_a || [] })
                }
                onExcluir={setExcluindo}
              />
            ))}
          </div>
        )}
      </section>

      <section className="pp-secao">
        <div className="pp-secao-cabeca">
          <div>
            <h3 className="pp-secao-titulo">Auditoria</h3>
            <span className="pp-secao-sub">
              últimos 30 dias · {acessosFiltrados.length} {acessosFiltrados.length === 1 ? "registro" : "registros"}
            </span>
          </div>
          <div className="pp-secao-acoes">
            <div className="pp-chips">
              {[["todas", "Todas"], ...Object.entries(ACAO).map(([k, v]) => [k, v.label])].map(
                ([valor, label]) => (
                  <button
                    key={valor}
                    className={`pp-chip ${filtroAcao === valor ? "is-ativo" : ""}`}
                    onClick={() => setFiltroAcao(valor)}
                  >
                    {label}
                  </button>
                ),
              )}
            </div>
            <button className="btn-ghost pp-btn-csv" onClick={baixarCsv} disabled={acessosFiltrados.length === 0}>
              <Download size={14} /> CSV
            </button>
          </div>
        </div>

        {acessosFiltrados.length === 0 ? (
          <div className="pp-vazio">
            <span className="pp-vazio-icone"><Activity size={20} /></span>
            <div className="pp-vazio-titulo">Nenhum acesso registrado</div>
            <div className="pp-vazio-sub">Toda consulta de credencial aparece aqui, com autor, horário e IP.</div>
          </div>
        ) : (
          <ul className="pp-log">
            {acessosFiltrados.map((a) => {
              const { label, Icon } = ACAO[a.acao] || { label: a.acao, Icon: KeyRound };
              return (
                <li key={a.id} className={`pp-log-item ${a.sucesso ? "" : "is-falha"}`}>
                  <span className="pp-log-avatar">{iniciais(a.colaborador?.nome)}</span>
                  <div className="pp-log-corpo">
                    <div className="pp-log-linha">
                      <strong>{a.colaborador?.nome || "Colaborador removido"}</strong>
                      <span className="pp-log-acao"><Icon size={11} /> {label}</span>
                      <span className="pp-log-servico">{a.servico?.nome || "serviço removido"}</span>
                    </div>
                    {!a.sucesso && (
                      <div className="pp-log-detalhe">
                        <AlertTriangle size={11} /> Negado — {a.detalhe || "sem detalhe"}
                      </div>
                    )}
                  </div>
                  <div className="pp-log-meta">
                    <span>{formatarData(a.created_at)}</span>
                    {a.ip && <span className="pp-log-ip">{a.ip}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {modal && (
        <ServicoModal inicial={modal} colaboradores={colaboradores} onFechar={() => setModal(null)} />
      )}
      {excluindo && (
        <ConfirmarExclusao servico={excluindo} onFechar={() => setExcluindo(null)} />
      )}
    </div>
  );
}
