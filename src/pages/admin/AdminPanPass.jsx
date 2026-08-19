import { useEffect, useMemo, useRef, useState } from "react";
import DatePicker from "react-datepicker";
import { ptBR } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import {
  Activity, AlertTriangle, Check, ChevronDown, Clock, Download, Eye, Globe2, KeyRound,
  Pencil, Plus, Search, ShieldCheck, Trash2, UserCheck, Users, X,
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
import { formatDateForStore } from "../../lib/adminAusenciaForm.js";
import "../../styles/panpass.css";

const parseIsoToDate = (isoDate) => {
  if (!isoDate) return null;
  const [year, month, day] = String(isoDate).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12, 0, 0);
};

const VAZIO = {
  id: null,
  nome: "",
  categoria: "",
  url_login: "",
  logo_url: "",
  usuario: "",
  senha: "",
  restrito_a: [],
  ativo: true,
};

// "totp"/"codigo_email" só aparecem em registros antigos de auditoria (a
// funcionalidade de MFA foi removida do PanPass — hoje só existe "senha").
const ACAO = {
  senha: { label: "Senha", Icon: Eye },
  totp: { label: "Código TOTP (descontinuado)", Icon: KeyRound },
  codigo_email: { label: "Código por e-mail (descontinuado)", Icon: KeyRound },
};

// Frase natural da auditoria — sem badge de ação, já que hoje só existe
// "revelar senha". Os verbos de totp/codigo_email só aparecem em histórico.
const ACAO_VERBO = {
  senha: "revelou a senha de",
  totp: "gerou o código de",
  codigo_email: "buscou o código de",
};

const formatarData = (iso) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

const formatarHora = (iso) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const formatarDataCurta = (iso) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");

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

// Combobox flutuante pro filtro de auditoria: mostra avatar+nome do
// selecionado no gatilho, painel com busca reaproveita o mesmo padrão de
// SeletorColaboradores (lista com avatar+nome+cargo).
function FiltroColaborador({ colaboradores, selecionadoId, onChange }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;
    const onClickFora = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setAberto(false);
    };
    document.addEventListener("mousedown", onClickFora);
    return () => document.removeEventListener("mousedown", onClickFora);
  }, [aberto]);

  const selecionado = colaboradores.find((c) => c.id === selecionadoId) || null;

  const sugestoes = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return colaboradores.filter((c) => (termo ? c.nome.toLowerCase().includes(termo) : true)).slice(0, 30);
  }, [colaboradores, busca]);

  const selecionar = (id) => {
    onChange(id);
    setAberto(false);
    setBusca("");
  };

  return (
    <div className="pp-filtro-colab" ref={wrapRef}>
      <button type="button" className="pp-filtro-colab-trigger" onClick={() => setAberto((v) => !v)}>
        {selecionado ? (
          <>
            <Avatar col={selecionado} size={18} />
            <span>{selecionado.nome}</span>
          </>
        ) : (
          <>
            <Users size={14} />
            <span>Todos os colaboradores</span>
          </>
        )}
        <ChevronDown size={13} />
      </button>

      {aberto && (
        <div className="pp-filtro-colab-painel pp-mfa-painel">
          <div className="pp-busca pp-busca-pessoas">
            <Search size={13} />
            <input
              autoFocus
              placeholder="Buscar colaborador..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          <ul className="pp-sugestoes">
            <li>
              <button type="button" onClick={() => selecionar(null)}>
                <span className="pp-filtro-colab-todos-icone"><Users size={14} /></span>
                <span className="pp-sugestao-nome">Todos os colaboradores</span>
              </button>
            </li>
            {sugestoes.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => selecionar(c.id)}>
                  <Avatar col={c} size={22} />
                  <span className="pp-sugestao-nome">{c.nome}</span>
                  {c.cargo && <span className="pp-sugestao-cargo">{c.cargo}</span>}
                </button>
              </li>
            ))}
          </ul>
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

  const submeter = (e) => {
    e.preventDefault();
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
            <button type="submit" className="btn-primary" disabled={salvar.isPending}>
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
  const [filtroColaboradorId, setFiltroColaboradorId] = useState(null);
  const [filtroDataDe, setFiltroDataDe] = useState("");
  const [filtroDataAte, setFiltroDataAte] = useState("");
  // Instante fixo da montagem: a janela de "7 dias" não pode mudar a cada render.
  const [montadoEm] = useState(() => Date.now());

  // Os `|| []` viram useMemo próprios: sem isso a identidade muda a cada render
  // e invalida os useMemo abaixo.
  const servicosTodos = useMemo(() => servicosQuery.data || [], [servicosQuery.data]);
  const acessos = useMemo(() => acessosQuery.data || [], [acessosQuery.data]);
  const colaboradores = colaboradoresQuery.data || [];
  const colaboradoresPorId = useMemo(
    () => new Map(colaboradores.map((c) => [c.id, c])),
    [colaboradores],
  );

  const servicos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return servicosTodos;
    return servicosTodos.filter((s) =>
      `${s.nome} ${s.categoria || ""} ${s.usuario}`.toLowerCase().includes(termo),
    );
  }, [servicosTodos, busca]);

  const acessosFiltrados = useMemo(() => {
    // Até inclui o dia inteiro: comparação por string yyyy-mm-dd evita fuso
    // horário estragar o "hoje" do filtro.
    const dataDe = filtroDataDe || null;
    const dataAte = filtroDataAte || null;
    return acessos.filter((a) => {
      if (filtroColaboradorId && a.colaborador_id !== filtroColaboradorId) return false;
      const dia = a.created_at.slice(0, 10);
      if (dataDe && dia < dataDe) return false;
      if (dataAte && dia > dataAte) return false;
      return true;
    });
  }, [acessos, filtroColaboradorId, filtroDataDe, filtroDataAte]);

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
                  setModal({ ...VAZIO, ...sv, senha: "", restrito_a: sv.restrito_a || [] })
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
            <div className="pp-filtro-data">
              <div className="form-group">
                <label className="form-label">DE</label>
                <DatePicker
                  selected={parseIsoToDate(filtroDataDe)}
                  onChange={(date) => setFiltroDataDe(formatDateForStore(date))}
                  locale={ptBR}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="dd/mm/aaaa"
                  isClearable
                  maxDate={parseIsoToDate(filtroDataAte)}
                  className="form-input datepicker-input"
                  calendarClassName="panet-datepicker"
                  popperClassName="panet-datepicker-popper"
                />
              </div>
              <div className="form-group">
                <label className="form-label">ATÉ</label>
                <DatePicker
                  selected={parseIsoToDate(filtroDataAte)}
                  onChange={(date) => setFiltroDataAte(formatDateForStore(date))}
                  locale={ptBR}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="dd/mm/aaaa"
                  isClearable
                  minDate={parseIsoToDate(filtroDataDe)}
                  className="form-input datepicker-input"
                  calendarClassName="panet-datepicker"
                  popperClassName="panet-datepicker-popper"
                />
              </div>
            </div>
            <FiltroColaborador
              colaboradores={colaboradores}
              selecionadoId={filtroColaboradorId}
              onChange={setFiltroColaboradorId}
            />
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
              const verbo = ACAO_VERBO[a.acao] || "acessou";
              const colaboradorAvatar = colaboradoresPorId.get(a.colaborador_id) || {
                nome: a.colaborador?.nome,
              };
              return (
                <li key={a.id} className={`pp-log-item ${a.sucesso ? "" : "is-falha"}`}>
                  <Avatar col={colaboradorAvatar} size={34} />
                  <div className="pp-log-corpo">
                    <div className="pp-log-linha">
                      <strong>{a.colaborador?.nome || "Colaborador removido"}</strong>
                      <span className="pp-log-conector">{a.sucesso ? verbo : `tentou ${verbo}`}</span>
                      <strong className="pp-log-servico">{a.servico?.nome || "serviço removido"}</strong>
                    </div>
                    {!a.sucesso && (
                      <div className="pp-log-detalhe">
                        <AlertTriangle size={11} /> Negado — {a.detalhe || "sem detalhe"}
                      </div>
                    )}
                  </div>
                  <div className="pp-log-meta">
                    <span className="pp-log-quando">
                      <Clock size={11} />
                      <strong>{formatarHora(a.created_at)}</strong>
                      <span className="pp-log-quando-data">{formatarDataCurta(a.created_at)}</span>
                    </span>
                    {a.ip && (
                      <span className="pp-log-ip">
                        <Globe2 size={10} />
                        {a.ip}
                      </span>
                    )}
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
