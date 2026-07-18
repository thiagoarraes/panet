import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, Clock3, Gift, LockKeyhole, MapPin, Pencil, ShieldCheck, Trash2, Users } from "lucide-react";
import DatePicker from "react-datepicker";
import { ptBR } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { Avatar } from "../../components/Avatar";
import { useAdminPresencial } from "../../hooks/queries/admin/useAdminPresencial.js";
import { useColaboradores } from "../../hooks/queries/useColaboradores.js";
import {
  useCreatePresencialAgenda,
  useUpdatePresencialAgenda,
  useDeletePresencialAgenda,
  useRunSecretSanta,
} from "../../hooks/mutations/usePresencialMutations.js";

const PAGE_SIZE = 20;
const normalizeIds = (value) => Array.from(new Set((Array.isArray(value) ? value : []).map((id) => String(id || "").trim()).filter(Boolean)));
const sameIds = (left, right) => {
  const a = normalizeIds(left);
  const b = normalizeIds(right);
  if (a.length !== b.length) return false;
  const bSet = new Set(b);
  return a.every((id) => bSet.has(id));
};
const parseIsoToDate = (isoDate) => {
  if (!isoDate) return null;
  const [y, m, d] = String(isoDate).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0);
};
const formatDateForStore = (date) => {
  if (!date || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const formatDateLabel = (isoDate) => new Date(`${isoDate}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const formatDateTimeLabel = (isoDateTime) => isoDateTime ? new Date(isoDateTime).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
const formatTimeLabel = (timeValue) => String(timeValue || "").slice(0, 5);
const normalizeTimeInput = (rawValue) => {
  const digits = String(rawValue || "").replace(/\D/g, "").slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
};
const isValidTime24h = (value) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || ""));
const createDefaultForm = () => ({
  titulo: "",
  dataIso: "",
  horaIso: "",
  amigoSecretoAtivo: false,
  amigoSecretoRegras: "",
  amigoSecretoSorteadoAt: null,
  local: "Agencia Pan",
  mapsUrl: "https://maps.app.goo.gl/QzdePpy5Zf2JLvNp7",
  vagas: 12,
  observacao: "",
  status: "aberto",
  visibilidadeRestrita: false,
  selectedColaboradorIds: [],
  initialSelectedColaboradorIds: [],
  colaboradoresSelecionadosPreview: [],
});

export function AdminPresencial({ currentUserId }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(createDefaultForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmarExcluir, setConfirmarExcluir] = useState(null);
  const [removingId, setRemovingId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [audienceSearch, setAudienceSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [drawState, setDrawState] = useState({ agendaId: "", status: "idle", message: "" });
  const [filtroStatus, setFiltroStatus] = useState("ativos");
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchTerm(searchInput.trim().toLowerCase());
      setCurrentPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Reset page when switching between Ativos / Passados
  useEffect(() => {
    const id = setTimeout(() => setCurrentPage(1), 0);
    return () => clearTimeout(id);
  }, [filtroStatus]);

  useEffect(() => {
    if (drawState.status !== "success" && drawState.status !== "error") return undefined;
    const timer = window.setTimeout(() => setDrawState((current) => (current.status === "success" || current.status === "error" ? { agendaId: "", status: "idle", message: "" } : current)), 6000);
    return () => window.clearTimeout(timer);
  }, [drawState]);

  const { data, isLoading } = useAdminPresencial({ page: currentPage, pageSize: PAGE_SIZE, search: searchTerm, filtro: filtroStatus });
  const { data: colaboradoresData = [], isLoading: isLoadingColaboradores } = useColaboradores(currentUserId, { summaryOnly: true, enabled: modal !== null });
  const createAgenda = useCreatePresencialAgenda();
  const updateAgenda = useUpdatePresencialAgenda();
  const deleteAgenda = useDeletePresencialAgenda();
  const runSecretSanta = useRunSecretSanta();

  const rows = data?.rows || [];
  const totalItems = data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const uiPage = Math.min(currentPage, totalPages);
  const audienceLocked = Boolean(form.amigoSecretoSorteadoAt);
  const selectableColaboradores = useMemo(() => colaboradoresData.filter((colaborador) => colaborador?.perfil !== "admin"), [colaboradoresData]);
  const selectedColaboradorIds = useMemo(() => normalizeIds(form.selectedColaboradorIds), [form.selectedColaboradorIds]);
  const selectedSet = useMemo(() => new Set(selectedColaboradorIds), [selectedColaboradorIds]);
  const selectedColaboradores = useMemo(() => {
    const byId = new Map(selectableColaboradores.map((colaborador) => [String(colaborador.id), colaborador]));
    const previewById = new Map((form.colaboradoresSelecionadosPreview || []).map((colaborador) => [String(colaborador.id), colaborador]));
    return selectedColaboradorIds.map((id) => byId.get(String(id)) || previewById.get(String(id))).filter(Boolean);
  }, [form.colaboradoresSelecionadosPreview, selectableColaboradores, selectedColaboradorIds]);
  const filteredColaboradores = useMemo(() => {
    const term = audienceSearch.trim().toLowerCase();
    if (!term) return selectableColaboradores;
    return selectableColaboradores.filter((colaborador) => [colaborador.nome, colaborador.cargo, colaborador.email].map((value) => String(value || "").toLowerCase()).join(" ").includes(term));
  }, [audienceSearch, selectableColaboradores]);

  const closeAgendaModal = () => {
    setModal(null);
    setForm(createDefaultForm());
    setFormError("");
    setAudienceSearch("");
  };

  const openNew = () => {
    setForm(createDefaultForm());
    setFormError("");
    setAudienceSearch("");
    setModal("novo");
  };

  const openEdit = (agenda) => {
    const selectedIds = normalizeIds(agenda.selectedColaboradorIds);
    setForm({
      id: agenda.id,
      titulo: agenda.titulo || "",
      dataIso: agenda.dataIso || "",
      horaIso: agenda.horaIso || "",
      amigoSecretoAtivo: Boolean(agenda.amigoSecretoAtivo),
      amigoSecretoRegras: agenda.amigoSecretoRegras || "",
      amigoSecretoSorteadoAt: agenda.amigoSecretoSorteadoAt || null,
      local: agenda.local || "",
      mapsUrl: agenda.mapsUrl || "",
      vagas: agenda.vagas || 0,
      observacao: agenda.observacao || "",
      status: agenda.status || "aberto",
      visibilidadeRestrita: selectedIds.length > 0,
      selectedColaboradorIds: selectedIds,
      initialSelectedColaboradorIds: selectedIds,
      colaboradoresSelecionadosPreview: agenda.colaboradoresSelecionados || [],
    });
    setFormError("");
    setAudienceSearch("");
    setModal(agenda.id);
  };

  const toggleAudienceColaborador = (colaboradorId) => {
    if (audienceLocked) return;
    const normalizedId = String(colaboradorId || "");
    setForm((prev) => {
      const current = new Set(normalizeIds(prev.selectedColaboradorIds));
      current.has(normalizedId) ? current.delete(normalizedId) : current.add(normalizedId);
      return { ...prev, selectedColaboradorIds: Array.from(current) };
    });
  };

  const saveAgenda = async () => {
    const normalizedSelectedIds = form.visibilidadeRestrita ? normalizeIds(form.selectedColaboradorIds) : [];
    if (!String(form.titulo || "").trim() || !form.dataIso) return setFormError("Preencha pelo menos titulo e data.");
    if (form.horaIso && !isValidTime24h(form.horaIso)) return setFormError("Use um horario valido no formato HH:MM.");
    if (form.visibilidadeRestrita && normalizedSelectedIds.length === 0) return setFormError("Selecione ao menos um colaborador para restringir o evento.");
    if (audienceLocked && !sameIds(normalizedSelectedIds, form.initialSelectedColaboradorIds)) return setFormError("Nao e possivel alterar os convidados depois que o sorteio do amigo secreto foi iniciado.");

    try {
      setSaving(true);
      setFormError("");
      const payload = {
        titulo: form.titulo,
        dataIso: form.dataIso,
        horaIso: String(form.horaIso || "").slice(0, 5),
        amigoSecretoAtivo: Boolean(form.amigoSecretoAtivo),
        amigoSecretoRegras: form.amigoSecretoRegras || "",
        local: form.local,
        mapsUrl: form.mapsUrl,
        vagas: Number(form.vagas || 0),
        observacao: form.observacao,
        status: form.status || "aberto",
        selectedColaboradorIds: normalizedSelectedIds,
      };
      if (modal === "novo") await createAgenda.mutateAsync(payload);
      else await updateAgenda.mutateAsync({ id: form.id, payload });
      closeAgendaModal();
      setFiltroStatus("ativos");
      setCurrentPage(1);
      queryClient.refetchQueries({ queryKey: ["admin", "presencial"] });
    } catch (error) {
      setFormError(error?.message || "Nao foi possivel salvar o evento agora.");
    } finally {
      setSaving(false);
    }
  };

  const removeAgenda = async () => {
    if (!confirmarExcluir?.id) return;
    try {
      setRemovingId(confirmarExcluir.id);
      await deleteAgenda.mutateAsync(confirmarExcluir.id);
      setConfirmarExcluir(null);
      queryClient.refetchQueries({ queryKey: ["admin", "presencial"] });
    } finally {
      setRemovingId("");
    }
  };

  const handleRunSecretSanta = async (agenda) => {
    if (!agenda?.id) return;
    setDrawState({ agendaId: agenda.id, status: "pending", message: "Realizando o sorteio e travando novas inscricoes. Isso pode levar alguns segundos." });
    try {
      const participantCount = await runSecretSanta.mutateAsync(agenda.id);
      setDrawState({ agendaId: agenda.id, status: "success", message: `Sorteio iniciado com ${participantCount} participante(s). O evento ja foi atualizado para evitar clique duplo.` });
    } catch (error) {
      setDrawState({ agendaId: agenda.id, status: "error", message: error?.message || "Nao foi possivel iniciar o sorteio agora. Tente novamente em instantes." });
    }
  };

  return (
    <div>
      <div className="admin-toolbar" style={{ marginBottom: 12 }}>
        <div>
          <div className="section-title" style={{ fontSize: 17 }}>Eventos</div>
          <div className="section-sub">Crie eventos da Pan e defina se eles aparecem para todo o time ou para um grupo selecionado.</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input className="form-input" style={{ maxWidth: 320 }} placeholder="Buscar por titulo, local ou observacao" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          <button className="btn-primary" onClick={openNew}>+ Novo evento</button>
        </div>
      </div>

      <div className="filter-tabs" style={{ marginBottom: 16 }}>
        {[
          { id: "ativos",   label: "Ativos" },
          { id: "passados", label: "Passados" },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`filter-tab ${filtroStatus === tab.id ? "active" : ""}`}
            onClick={() => setFiltroStatus(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((agenda) => {
          const confirmados = (agenda.confirmacoes || []).filter((item) => item.status === "confirmado" || item.status === "talvez").length;
          const participantesSorteio = (agenda.confirmacoes || []).filter((item) => item.status === "talvez").length;
          const vagas = Number(agenda.vagas || 0);
          const isDrawingThisAgenda = drawState.agendaId === agenda.id && drawState.status === "pending";
          const hasDrawFeedback = drawState.agendaId === agenda.id && drawState.status !== "idle";
          const canRunDraw = agenda.amigoSecretoAtivo && !agenda.amigoSecretoSorteadoAt && participantesSorteio >= 2 && !runSecretSanta.isPending;
          const agendaStatusLabel = agenda.status === "encerrado" ? "Encerrado" : agenda.status === "cancelado" ? "Cancelado" : "Aberto";
          const agendaStatusClass = agenda.status === "encerrado" ? "status-andamento" : "status-marcado";
          return (
            <div key={agenda.id} className="card" style={{ padding: 16 }}>
              <div className="admin-presencial-row">
                <div className="admin-presencial-main">
                  <div className="admin-presencial-title-row">
                    <div className="admin-presencial-title">{agenda.titulo}</div>
                    <span className={`status-chip ${agendaStatusClass} admin-presencial-status-chip`}>{agendaStatusLabel}</span>
                  </div>
                  <div className="admin-presencial-meta">
                    <span><CalendarDays size={13} /> {formatDateLabel(agenda.dataIso)}</span>
                    {agenda.horaIso && <span><Clock3 size={13} /> {formatTimeLabel(agenda.horaIso)}</span>}
                    <span><MapPin size={13} /> {agenda.local || "Escritorio Pan"}</span>
                    <span><Users size={13} /> {confirmados} confirmado(s){vagas > 0 ? ` / ${vagas} vaga(s)` : ""}</span>
                    {agenda.amigoSecretoAtivo && <span><Gift size={13} /> {participantesSorteio} no sorteio</span>}
                  </div>
                  {agenda.visibilidadeRestrita ? (
                    <div className="admin-presencial-audience-summary">
                      <div className="admin-presencial-audience-badge"><LockKeyhole size={12} /> Evento restrito</div>
                      <div className="admin-presencial-audience-text">Visivel para {agenda.selectedColaboradorIds?.length || 0} colaborador(es) selecionado(s). Todos os admins continuam vendo este evento.</div>
                      {(agenda.colaboradoresSelecionados || []).length > 0 && <div className="admin-presencial-audience-preview">{(agenda.colaboradoresSelecionados || []).slice(0, 4).map((colaborador) => <div key={colaborador.id} className="admin-presencial-audience-preview-item"><Avatar col={colaborador} size={28} /><span>{colaborador.nome}</span></div>)}{(agenda.colaboradoresSelecionados || []).length > 4 && <div className="admin-presencial-audience-more">+{(agenda.colaboradoresSelecionados || []).length - 4}</div>}</div>}
                    </div>
                  ) : <div className="admin-presencial-note" style={{ marginTop: 10 }}>Evento visivel para todo o time em /eventos.</div>}
                  {agenda.observacao && <div className="admin-presencial-note">{agenda.observacao}</div>}
                  {agenda.amigoSecretoAtivo && agenda.amigoSecretoRegras && <div className="admin-presencial-note" style={{ marginTop: 8 }}><strong>Regras do amigo secreto:</strong> {agenda.amigoSecretoRegras}</div>}
                  {agenda.amigoSecretoAtivo && agenda.amigoSecretoSorteadoAt && <div className="admin-presencial-draw-info"><strong>Sorteio concluido com {participantesSorteio} participante(s):</strong> {formatDateTimeLabel(agenda.amigoSecretoSorteadoAt)}. Novas inscricoes no amigo secreto estao bloqueadas.</div>}
                  {hasDrawFeedback && <div className={`admin-presencial-draw-feedback is-${drawState.status}`}><div className="admin-presencial-draw-feedback-title">{drawState.status === "pending" ? "Sorteando agora" : drawState.status === "success" ? "Sorteio concluido" : "Falha ao iniciar sorteio"}</div><div className="admin-presencial-draw-feedback-text">{drawState.message}</div></div>}
                </div>
                <div className="admin-presencial-side">
                  <div className="admin-presencial-actions">
                    {agenda.amigoSecretoAtivo && <button className={`btn-ghost ${isDrawingThisAgenda ? "admin-presencial-draw-btn is-running" : "admin-presencial-draw-btn"}`} onClick={() => handleRunSecretSanta(agenda)} disabled={!canRunDraw}>{isDrawingThisAgenda ? "Sorteando..." : agenda.amigoSecretoSorteadoAt ? `Sorteio concluido (${participantesSorteio})` : participantesSorteio < 2 ? "Minimo 2 no sorteio" : "Iniciar sorteio"}</button>}
                    <button
                      className="admin-action-icon"
                      type="button"
                      onClick={() => openEdit(agenda)}
                      aria-label={`Editar ${agenda.titulo}`}
                      title="Editar"
                    >
                      <Pencil />
                    </button>
                    <button
                      className="admin-action-icon is-danger"
                      type="button"
                      onClick={() => setConfirmarExcluir(agenda)}
                      disabled={removingId === agenda.id}
                      aria-label={removingId === agenda.id ? "Removendo evento" : `Remover ${agenda.titulo}`}
                      title={removingId === agenda.id ? "Removendo..." : "Remover"}
                    >
                      <Trash2 />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="empty-state">
            {isLoading
              ? "Carregando..."
              : filtroStatus === "passados"
                ? "Nenhum evento passado encontrado."
                : "Nenhum evento ativo no momento."}
          </div>
        )}
      </div>

      {totalItems > PAGE_SIZE && <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}><div style={{ fontSize: 12, color: "var(--muted)" }}>Pagina {uiPage} de {totalPages} · {totalItems} item(ns)</div><div style={{ display: "flex", gap: 8 }}><button className="btn-ghost" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={uiPage <= 1}>Anterior</button><button className="btn-ghost" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={uiPage >= totalPages}>Proxima</button></div></div>}

      {modal !== null && <div className="modal-overlay" style={{ alignItems: "center", justifyItems: "center" }} onClick={closeAgendaModal}><div className="modal" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}><div className="modal-header"><div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17 }}>{modal === "novo" ? "Novo evento" : "Editar evento"}</div><button className="modal-close" onClick={closeAgendaModal}>x</button></div><div className="modal-body">
        <div className="form-group"><label className="form-label">TITULO *</label><input className="form-input" value={form.titulo || ""} onChange={(e) => setForm((prev) => ({ ...prev, titulo: e.target.value }))} /></div>
        <div className="grid-2"><div className="form-group"><label className="form-label">DATA *</label><DatePicker selected={parseIsoToDate(form.dataIso)} onChange={(date) => setForm((prev) => ({ ...prev, dataIso: formatDateForStore(date) }))} locale={ptBR} dateFormat="dd/MM/yyyy" placeholderText="dd/mm/aaaa" className="form-input datepicker-input" calendarClassName="panet-datepicker" popperClassName="panet-datepicker-popper" /></div><div className="form-group"><label className="form-label">HORA</label><input className="form-input" type="text" inputMode="numeric" placeholder="HH:MM" maxLength={5} value={form.horaIso || ""} onChange={(e) => setForm((prev) => ({ ...prev, horaIso: normalizeTimeInput(e.target.value) }))} /></div></div>
        <div className="form-group"><label className="form-label">VAGAS</label><input className="form-input" type="number" min="0" value={form.vagas ?? 0} onChange={(e) => setForm((prev) => ({ ...prev, vagas: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">LOCAL</label><input className="form-input" value={form.local || ""} onChange={(e) => setForm((prev) => ({ ...prev, local: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">LINK DO GOOGLE MAPS</label><input className="form-input" type="url" placeholder="https://maps.google.com/..." value={form.mapsUrl || ""} onChange={(e) => setForm((prev) => ({ ...prev, mapsUrl: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">STATUS</label><select className="form-input" value={form.status || "aberto"} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}><option value="aberto">Aberto</option><option value="encerrado">Encerrado</option><option value="cancelado">Cancelado</option></select></div>
        <div className="form-group"><div className="admin-presencial-audience-panel"><div className="admin-presencial-audience-panel-head"><div><label className="form-label">VISIBILIDADE</label><div className="admin-presencial-audience-note">Para tornar este evento restrito selecione o campo &quot;Restringir para convidados&quot; e selecione os convidados.</div></div><label className="admin-presencial-audience-switch"><input type="checkbox" checked={Boolean(form.visibilidadeRestrita)} disabled={audienceLocked} onChange={(e) => setForm((prev) => ({ ...prev, visibilidadeRestrita: e.target.checked }))} /> Restringir para convidados</label></div>
          {form.visibilidadeRestrita ? <>
            <div className="admin-presencial-audience-toolbar"><div className="admin-presencial-audience-pill"><ShieldCheck size={14} /> {selectedColaboradorIds.length} colaborador(es) selecionado(s)</div><input className="form-input" style={{ maxWidth: 260 }} placeholder="Buscar colaborador" value={audienceSearch} onChange={(e) => setAudienceSearch(e.target.value)} disabled={audienceLocked} /></div>
            {selectedColaboradores.length > 0 && <div className="admin-presencial-audience-preview is-modal">{selectedColaboradores.map((colaborador) => <div key={colaborador.id} className="admin-presencial-audience-preview-item"><Avatar col={colaborador} size={28} /><span>{colaborador.nome}</span></div>)}</div>}
            <div className="admin-presencial-audience-grid">{isLoadingColaboradores ? <div className="admin-presencial-audience-empty">Carregando colaboradores...</div> : filteredColaboradores.length === 0 ? <div className="admin-presencial-audience-empty">Nenhum colaborador encontrado.</div> : filteredColaboradores.map((colaborador) => { const isSelected = selectedSet.has(String(colaborador.id)); return <button key={colaborador.id} type="button" className={`admin-presencial-audience-card ${isSelected ? "is-selected" : ""}`} onClick={() => toggleAudienceColaborador(colaborador.id)} disabled={audienceLocked}><div className="admin-presencial-audience-card-head"><Avatar col={colaborador} size={34} /><div className="admin-presencial-audience-card-copy"><div className="admin-presencial-audience-card-name">{colaborador.nome}</div><div className="admin-presencial-audience-card-role">{colaborador.cargo || "Colaborador"}</div></div></div><span className={`admin-presencial-audience-card-state ${isSelected ? "is-selected" : ""}`}>{isSelected ? "Selecionado" : "Selecionar"}</span></button>; })}</div>
            {audienceLocked && <div className="admin-presencial-audience-lock">O publico deste evento foi travado porque o sorteio do amigo secreto ja foi iniciado.</div>}
          </> : <div className="admin-presencial-audience-public">Este evento vai aparecer para todo o time em /eventos.</div>}
        </div></div>
        <div className="form-group"><label className="form-label" style={{ display: "flex", alignItems: "center", gap: 10 }}><input type="checkbox" checked={Boolean(form.amigoSecretoAtivo)} disabled={Boolean(form.amigoSecretoSorteadoAt)} onChange={(e) => setForm((prev) => ({ ...prev, amigoSecretoAtivo: e.target.checked }))} /> Ativar amigo secreto neste evento</label></div>
        {form.amigoSecretoAtivo && <div className="form-group"><label className="form-label">REGRAS DO SORTEIO</label><textarea className="form-input" rows="4" value={form.amigoSecretoRegras || ""} onChange={(e) => setForm((prev) => ({ ...prev, amigoSecretoRegras: e.target.value }))} /></div>}
        <div className="form-group"><label className="form-label">OBSERVACAO</label><textarea className="form-input" rows="4" value={form.observacao || ""} onChange={(e) => setForm((prev) => ({ ...prev, observacao: e.target.value }))} /></div>
        {formError && <div className="admin-presencial-form-error">{formError}</div>}
        <div className="admin-modal-actions" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button className="btn-ghost" onClick={closeAgendaModal}>Cancelar</button><button className="btn-primary" onClick={saveAgenda} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button></div>
      </div></div></div>}

      {confirmarExcluir !== null && <div className="modal-overlay" style={{ alignItems: "center", justifyItems: "center" }} onClick={() => setConfirmarExcluir(null)}><div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}><div className="modal-body" style={{ textAlign: "center", padding: 32 }}><div style={{ fontSize: 40, marginBottom: 12, display: "inline-flex", color: "var(--danger)" }}><AlertTriangle size={36} /></div><div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Remover dia presencial?</div><div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 22 }}>Esta acao remove a data e todas as confirmacoes vinculadas.</div><div className="admin-modal-actions" style={{ display: "flex", gap: 8, justifyContent: "center" }}><button className="btn-ghost" onClick={() => setConfirmarExcluir(null)}>Cancelar</button><button onClick={removeAgenda} style={{ background: "var(--danger)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 600, cursor: "pointer", fontSize: 13 }} disabled={removingId === confirmarExcluir.id}>{removingId === confirmarExcluir.id ? "Removendo..." : "Remover"}</button></div></div></div></div>}
    </div>
  );
}
