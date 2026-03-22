import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Clock, Pencil, Plane, Trash2, UserMinus } from "lucide-react";
import DatePicker from "react-datepicker";
import { ptBR } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { Avatar } from "../../components/Avatar";
import { useAdminFerias } from "../../hooks/queries/admin/useAdminFerias.js";
import { useAdminAusencias } from "../../hooks/queries/admin/useAdminAusencias.js";
import { useCreateFerias, useDeleteFerias, useUpdateFerias } from "../../hooks/mutations/useFeriasMutations.js";
import { useCreateAusencia, useDeleteAusencia, useUpdateAusencia } from "../../hooks/mutations/useAusenciasMutations.js";
import { useColaboradores } from "../../hooks/queries/useColaboradores.js";
import {
  formatAusenciaValueForForm,
  formatDateForStore,
  getAusenciaFormComputed,
  localDateToIsoBoundary,
  localToIso,
} from "../../lib/adminAusenciaForm.js";
import { getAusenciaMeta, getAusenciaMobileMeta } from "../../lib/panoff.js";

const AdminAusenciaModal = lazy(() =>
  import("./AdminAusenciaModal").then((m) => ({ default: m.AdminAusenciaModal }))
);

const toIso = (brDate) => {
  const [day, month, year] = String(brDate || "").split("/");
  return `${year}-${month}-${day}`;
};

const parseIsoToDate = (isoDate) => {
  if (!isoDate) return null;
  const [year, month, day] = String(isoDate).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12, 0, 0);
};

export function AdminFerias({ currentUserId }) {
  const [sub, setSub] = useState("ferias");

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [confirmarExcluir, setConfirmarExcluir] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingDeleteIds, setPendingDeleteIds] = useState(new Set());

  const [ausenciaModal, setAusenciaModal] = useState(null);
  const [ausenciaForm, setAusenciaForm] = useState({});
  const [ausenciaConfirmarExcluir, setAusenciaConfirmarExcluir] = useState(null);
  const [ausenciaSaving, setAusenciaSaving] = useState(false);
  const [ausenciaSearchInput, setAusenciaSearchInput] = useState("");
  const [ausenciaSearchTerm, setAusenciaSearchTerm] = useState("");
  const [ausenciaPage, setAusenciaPage] = useState(1);
  const [ausenciaPendingDelete, setAusenciaPendingDelete] = useState(new Set());

  const PAGE_SIZE = 20;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchTerm(searchInput.trim().toLowerCase());
      setCurrentPage(1);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAusenciaSearchTerm(ausenciaSearchInput.trim().toLowerCase());
      setAusenciaPage(1);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [ausenciaSearchInput]);

  useEffect(() => {
    setCurrentPage(1);
  }, [sub]);

  const { data: feriasData, isLoading: feriasLoading } = useAdminFerias({
    page: currentPage,
    pageSize: PAGE_SIZE,
    search: searchTerm,
    tipo: sub === "ferias" ? "ferias" : "dayoff",
  });
  const rows = sub !== "ausencia" ? feriasData?.rows || [] : [];
  const totalItems = sub !== "ausencia" ? feriasData?.count || 0 : 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  const { data: ausenciaData, isLoading: ausenciaLoading } = useAdminAusencias({
    page: ausenciaPage,
    pageSize: PAGE_SIZE,
    search: ausenciaSearchTerm,
  });
  const ausenciaRows = ausenciaData?.rows || [];
  const ausenciaTotalItems = ausenciaData?.count || 0;
  const ausenciaTotalPages = Math.max(1, Math.ceil(ausenciaTotalItems / PAGE_SIZE));

  const { data: colaboradoresData } = useColaboradores(currentUserId);
  const colaboradoresOpts = useMemo(() => colaboradoresData || [], [colaboradoresData]);

  const createFerias = useCreateFerias();
  const updateFerias = useUpdateFerias();
  const deleteFerias = useDeleteFerias();
  const createAusencia = useCreateAusencia();
  const updateAusencia = useUpdateAusencia();
  const deleteAusencia = useDeleteAusencia();

  const abrirNovo = () => {
    setForm({
      colaboradorId: "",
      inicio: "",
      fim: "",
      status: "marcado",
      motivoReal: "",
    });
    setModal("novo");
  };

  const salvar = async () => {
    if (!form.colaboradorId || !form.inicio || (sub === "ferias" && !form.fim)) return;

    try {
      setSaving(true);
      const payload = {
        colaborador_id: form.colaboradorId,
        inicio: form.inicio,
        fim: sub === "dayoff" ? form.inicio : form.fim,
        status: form.status || "marcado",
        tipo: sub === "ferias" ? "ferias" : "dayoff",
        motivo_real: sub === "dayoff" && form.motivoReal ? form.motivoReal.trim() : null,
      };

      if (modal === "novo") {
        await createFerias.mutateAsync(payload);
      } else {
        await updateFerias.mutateAsync({ id: form.id, payload });
      }

      setModal(null);
    } finally {
      setSaving(false);
    }
  };

  const removerRegistro = async () => {
    if (!confirmarExcluir?.id) return;
    const { id } = confirmarExcluir;

    try {
      setPendingDeleteIds((prev) => new Set(prev).add(id));
      await deleteFerias.mutateAsync(id);
      setConfirmarExcluir(null);
    } catch (error) {
      console.error(error);
    } finally {
      setPendingDeleteIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const abrirAusenciaNova = () => {
    setAusenciaForm({
      colaboradorId: "",
      motivo: "",
      inicio: "",
      fim: "",
      tipoTempo: "especifico",
      diaTodo: false,
    });
    setAusenciaModal("novo");
  };

  const salvarAusencia = async () => {
    const { retornoObrigatorio, retornoInvalido } = getAusenciaFormComputed(ausenciaForm);
    if (!ausenciaForm.colaboradorId || !ausenciaForm.motivo || !ausenciaForm.inicio) return;
    if (retornoObrigatorio || retornoInvalido) return;

    try {
      setAusenciaSaving(true);
      const payload = {
        colaborador_id: ausenciaForm.colaboradorId,
        motivo: ausenciaForm.motivo,
        inicio: ausenciaForm.diaTodo ? localDateToIsoBoundary(ausenciaForm.inicio, "start") : localToIso(ausenciaForm.inicio),
        fim:
          ausenciaForm.tipoTempo === "especifico" && ausenciaForm.fim
            ? ausenciaForm.diaTodo
              ? localDateToIsoBoundary(ausenciaForm.fim, "end")
              : localToIso(ausenciaForm.fim)
            : null,
        estimativa: null,
        dia_todo: Boolean(ausenciaForm.diaTodo),
      };

      if (ausenciaModal === "novo") {
        await createAusencia.mutateAsync(payload);
      } else {
        await updateAusencia.mutateAsync({ id: ausenciaModal, payload });
      }

      setAusenciaModal(null);
    } finally {
      setAusenciaSaving(false);
    }
  };

  const removerAusencia = async () => {
    if (!ausenciaConfirmarExcluir?.id) return;
    const { id } = ausenciaConfirmarExcluir;

    try {
      setAusenciaPendingDelete((prev) => new Set(prev).add(id));
      await deleteAusencia.mutateAsync(id);
      setAusenciaConfirmarExcluir(null);
    } catch (error) {
      console.error(error);
    } finally {
      setAusenciaPendingDelete((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const placeholderBuscaFerias =
    sub === "dayoff" ? "Buscar por colaborador, cargo ou motivo" : "Buscar por colaborador, cargo ou período";

  return (
    <div>
      <div
        className="admin-toolbar"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}
      >
        <div className="filter-tabs">
          <button className={`filter-tab ${sub === "ferias" ? "active" : ""}`} onClick={() => setSub("ferias")}>
            <Plane size={14} style={{ marginRight: 6, verticalAlign: "text-bottom" }} /> Férias
          </button>
          <button className={`filter-tab ${sub === "dayoff" ? "active" : ""}`} onClick={() => setSub("dayoff")}>
            <CalendarDays size={14} style={{ marginRight: 6, verticalAlign: "text-bottom" }} /> Day Off
          </button>
          <button className={`filter-tab ${sub === "ausencia" ? "active" : ""}`} onClick={() => setSub("ausencia")}>
            <UserMinus size={14} style={{ marginRight: 6, verticalAlign: "text-bottom" }} /> Ausência
          </button>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {sub !== "ausencia" ? (
            <>
              <input
                className="form-input"
                style={{ maxWidth: 320 }}
                placeholder={placeholderBuscaFerias}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
              <button className="btn-primary" onClick={abrirNovo}>
                + Adicionar
              </button>
            </>
          ) : (
            <>
              <input
                className="form-input"
                style={{ maxWidth: 320 }}
                placeholder="Buscar por colaborador ou motivo"
                value={ausenciaSearchInput}
                onChange={(event) => setAusenciaSearchInput(event.target.value)}
              />
              <button className="btn-primary" onClick={abrirAusenciaNova}>
                + Registrar ausência
              </button>
            </>
          )}
        </div>
      </div>

      {sub !== "ausencia" && (
        <>
          <div
            className={`stagger ${sub === "dayoff" ? "admin-dayoff-grid" : ""}`}
            style={
              sub === "dayoff"
                ? undefined
                : { display: "flex", flexDirection: "column", gap: 10 }
            }
          >
            {rows.map((item) => (
              <div key={item.id} className={`card ${sub === "dayoff" ? "admin-dayoff-card" : ""}`} style={{ padding: 16 }}>
                <div
                  className={`admin-ferias-row ${sub === "dayoff" ? "admin-dayoff-row" : ""}`}
                  style={{ display: "flex", alignItems: "center", gap: 12 }}
                >
                  <Avatar col={item.colaborador} size={40} />

                  <div className="admin-ferias-main" style={{ flex: 1 }}>
                    {sub === "dayoff" ? (
                      <div className="admin-dayoff-header">
                        <div className="admin-ferias-name">{item.colaborador.nome}</div>
                        <span className="status-chip admin-ferias-status admin-dayoff-chip admin-dayoff-chip-inline">
                          Day Off
                        </span>
                      </div>
                    ) : (
                      <div className="admin-ferias-name">{item.colaborador.nome}</div>
                    )}
                    <div className="admin-ferias-role">{item.colaborador.cargo}</div>
                    <div
                      className={`admin-ferias-dates admin-ferias-date-pill ${sub === "dayoff" ? "is-dayoff" : ""}`}
                      style={{ fontSize: 12, marginTop: 4, display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      <CalendarDays size={12} /> {sub === "dayoff" ? item.inicio : `${item.inicio} - ${item.fim}`}
                    </div>
                  </div>

                  <div className="admin-ferias-side">
                  {sub === "ferias" && (
                    <span
                      className={`status-chip admin-ferias-status ${
                        item.status === "em_andamento" ? "status-andamento" : "status-marcado"
                      }`}
                    >
                      {item.status === "em_andamento" ? "De férias" : "Agendado"}
                    </span>
                  )}
                  <div className="admin-ferias-actions" style={{ display: "flex", gap: 6 }}>
                    <button
                      className="admin-action-icon"
                      type="button"
                      onClick={() => {
                        setForm({
                          id: item.id,
                          colaboradorId: String(item.colaborador.id),
                          inicio: toIso(item.inicio),
                          fim: toIso(item.fim),
                          status: item.status || "marcado",
                          motivoReal: item.motivoReal || "",
                        });
                        setModal(item.id);
                      }}
                      aria-label="Editar registro"
                      title="Editar"
                    >
                      <Pencil />
                    </button>

                    <button
                      className="admin-action-icon is-danger"
                      type="button"
                      onClick={() => setConfirmarExcluir(item)}
                      disabled={pendingDeleteIds.has(item.id)}
                      aria-label={pendingDeleteIds.has(item.id) ? "Removendo registro" : "Remover registro"}
                      title={pendingDeleteIds.has(item.id) ? "Removendo..." : "Remover"}
                    >
                      <Trash2 />
                    </button>
                  </div>
                  </div>

                  {sub === "dayoff" && item.motivoReal ? (
                    <div
                      className="admin-dayoff-motivo"
                      style={{
                        marginTop: 6,
                        padding: "6px 10px",
                        background: "var(--surface2)",
                        borderRadius: 6,
                        fontSize: 12,
                        borderLeft: "3px solid #E84B7A",
                      }}
                    >
                      <span
                        className="admin-dayoff-motivo-label"
                        style={{
                          color: "var(--muted)",
                          fontSize: 10,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        Motivo:{" "}
                      </span>
                      {item.motivoReal}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}

            {rows.length === 0 && (
              <div className="empty-state">{feriasLoading ? "Carregando..." : "Nenhum registro encontrado."}</div>
            )}
          </div>

          {totalItems > PAGE_SIZE && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                Página {safePage} de {totalPages} · {totalItems} item(ns)
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn-ghost"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={safePage <= 1}
                >
                  Anterior
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={safePage >= totalPages}
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {sub === "ausencia" && (
        <>
          <div className="stagger admin-ausencia-grid">
            {ausenciaRows.map((item) => {
              const ausenciaMeta = getAusenciaMeta(item, { dateVariant: "full-date" });
              const ausenciaMobileMeta = getAusenciaMobileMeta(item, ausenciaMeta);

              return (
                <div key={item.id} className="card admin-ausencia-card" style={{ padding: 16 }}>
                  <div className="admin-ferias-row admin-ausencia-row" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Avatar col={item.colaborador} size={40} />

                  <div className="admin-ferias-main admin-ausencia-main" style={{ flex: 1 }}>
                    <div className="admin-ausencia-header">
                      <div className="admin-ferias-name admin-ausencia-name">{item.colaborador.nome}</div>
                      <span
                        className="status-chip admin-ferias-status admin-ausencia-status admin-ausencia-status-inline"
                        style={{
                          background: "rgba(255,160,50,0.15)",
                          color: "#FFA032",
                          border: "1px solid rgba(255,160,50,0.3)",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        Ausente
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{item.colaborador.cargo}</div>
                    <div className="folga-meta admin-ausencia-meta admin-ausencia-meta-desktop" style={{ marginTop: 8 }}>
                      {ausenciaMeta.dateLabel ? (
                        <span className="folga-meta-chip">
                          <CalendarDays size={12} />
                          {ausenciaMeta.dateLabel}
                        </span>
                      ) : null}
                      {ausenciaMeta.timeLabel ? (
                        <span className="folga-meta-chip is-time">
                          <Clock size={12} />
                          {ausenciaMeta.timeLabel}
                        </span>
                      ) : null}
                    </div>
                    <div className="folga-meta admin-ausencia-meta admin-ausencia-meta-mobile" style={{ marginTop: 8 }}>
                      {ausenciaMobileMeta.label ? (
                        <span className={`folga-meta-chip${ausenciaMobileMeta.isTime ? " is-time" : ""}`}>
                          {ausenciaMobileMeta.icon === "clock" ? <Clock size={12} /> : <CalendarDays size={12} />}
                          {ausenciaMobileMeta.label}
                        </span>
                      ) : null}
                    </div>
                    <div
                      className="admin-ausencia-motivo"
                      style={{
                        marginTop: 6,
                        padding: "6px 10px",
                        background: "var(--surface2)",
                        borderRadius: 6,
                        fontSize: 12,
                        borderLeft: "3px solid var(--accent)",
                      }}
                    >
                      <span
                        className="admin-ausencia-motivo-label"
                        style={{
                          color: "var(--muted)",
                          fontSize: 10,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        Motivo ·{" "}
                      </span>
                      {item.motivo}
                    </div>
                  </div>

                    <div className="admin-ferias-actions admin-ausencia-actions" style={{ display: "flex", gap: 6 }}>
                      <button
                        className="admin-action-icon"
                        type="button"
                        onClick={() => {
                          setAusenciaForm({
                            colaboradorId: String(item.colaborador.id),
                            motivo: item.motivo,
                            inicio: formatAusenciaValueForForm(item.inicio, item.diaTodo),
                            fim: formatAusenciaValueForForm(item.fim, item.diaTodo),
                            tipoTempo: item.fim ? "especifico" : "indefinido",
                            diaTodo: Boolean(item.diaTodo),
                          });
                          setAusenciaModal(item.id);
                        }}
                        aria-label="Editar ausência"
                        title="Editar"
                      >
                        <Pencil />
                      </button>

                      <button
                        className="admin-action-icon is-danger"
                        type="button"
                        onClick={() => setAusenciaConfirmarExcluir(item)}
                        disabled={ausenciaPendingDelete.has(item.id)}
                        aria-label={ausenciaPendingDelete.has(item.id) ? "Removendo ausência" : "Remover ausência"}
                        title={ausenciaPendingDelete.has(item.id) ? "Removendo..." : "Remover"}
                      >
                        <Trash2 />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {ausenciaRows.length === 0 && (
              <div className="empty-state">{ausenciaLoading ? "Carregando..." : "Nenhuma ausência registrada."}</div>
            )}
          </div>

          {ausenciaTotalItems > PAGE_SIZE && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                Página {ausenciaPage} de {ausenciaTotalPages} · {ausenciaTotalItems} item(ns)
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn-ghost"
                  onClick={() => setAusenciaPage((page) => Math.max(1, page - 1))}
                  disabled={ausenciaPage <= 1}
                >
                  Anterior
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => setAusenciaPage((page) => Math.min(ausenciaTotalPages, page + 1))}
                  disabled={ausenciaPage >= ausenciaTotalPages}
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {modal !== null && sub !== "ausencia" && (
        <div className="modal-overlay" style={{ alignItems: "center", justifyItems: "center" }} onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17 }}>
                {modal === "novo" ? `Adicionar ${sub === "ferias" ? "Férias" : "Day Off"}` : "Editar registro"}
              </div>
              <button className="modal-close" onClick={() => setModal(null)}>
                x
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">COLABORADOR *</label>
                <select
                  className="form-input"
                  value={form.colaboradorId || ""}
                  onChange={(event) => setForm((prev) => ({ ...prev, colaboradorId: event.target.value }))}
                >
                  <option value="">Selecione...</option>
                  {colaboradoresOpts.map((colaborador) => (
                    <option key={colaborador.id} value={colaborador.id}>
                      {colaborador.nome}
                    </option>
                  ))}
                </select>
              </div>

              {sub === "dayoff" ? (
                <div className="form-group">
                  <label className="form-label">DAY OFF *</label>
                  <DatePicker
                    selected={parseIsoToDate(form.inicio)}
                    onChange={(date) => {
                      const nextDate = formatDateForStore(date);
                      setForm((prev) => ({ ...prev, inicio: nextDate, fim: nextDate }));
                    }}
                    locale={ptBR}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="dd/mm/aaaa"
                    className="form-input datepicker-input"
                    calendarClassName="panet-datepicker"
                    popperClassName="panet-datepicker-popper"
                  />
                </div>
              ) : (
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">INÍCIO *</label>
                    <DatePicker
                      selected={parseIsoToDate(form.inicio)}
                      onChange={(date) => setForm((prev) => ({ ...prev, inicio: formatDateForStore(date) }))}
                      locale={ptBR}
                      dateFormat="dd/MM/yyyy"
                      placeholderText="dd/mm/aaaa"
                      className="form-input datepicker-input"
                      calendarClassName="panet-datepicker"
                      popperClassName="panet-datepicker-popper"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">FIM *</label>
                    <DatePicker
                      selected={parseIsoToDate(form.fim)}
                      onChange={(date) => setForm((prev) => ({ ...prev, fim: formatDateForStore(date) }))}
                      locale={ptBR}
                      dateFormat="dd/MM/yyyy"
                      placeholderText="dd/mm/aaaa"
                      className="form-input datepicker-input"
                      calendarClassName="panet-datepicker"
                      popperClassName="panet-datepicker-popper"
                      minDate={parseIsoToDate(form.inicio)}
                    />
                  </div>
                </div>
              )}

              {sub === "dayoff" && (
                <div className="form-group">
                  <label className="form-label">MOTIVO</label>
                  <input
                    className="form-input"
                    placeholder="Ex: consulta, compromisso pessoal, resolver documento..."
                    value={form.motivoReal || ""}
                    onChange={(event) => setForm((prev) => ({ ...prev, motivoReal: event.target.value }))}
                  />
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Visível apenas para administradores.</div>
                </div>
              )}

              {sub === "ferias" && (
                <div className="form-group">
                  <label className="form-label">STATUS</label>
                  <select
                    className="form-input"
                    value={form.status || "marcado"}
                    onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
                  >
                    <option value="marcado">Agendado</option>
                    <option value="em_andamento">De férias</option>
                  </select>
                </div>
              )}

              <div className="admin-modal-actions" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn-ghost" onClick={() => setModal(null)}>
                  Cancelar
                </button>
                <button className="btn-primary" onClick={salvar} disabled={saving}>
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {ausenciaModal !== null && (
        <Suspense fallback={null}>
          <AdminAusenciaModal
            modal={ausenciaModal}
            form={ausenciaForm}
            setForm={setAusenciaForm}
            colaboradoresOpts={colaboradoresOpts}
            saving={ausenciaSaving}
            onClose={() => setAusenciaModal(null)}
            onSave={salvarAusencia}
          />
        </Suspense>
      )}

      {/* legacy inline ausencia modal kept disabled after extraction
        <div
          className="modal-overlay"
          style={{ alignItems: "center", justifyItems: "center" }}
          onClick={() => setAusenciaModal(null)}
        >
          <div className="modal admin-ausencia-modal" style={{ maxWidth: 560 }} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17 }}>
                {ausenciaModal === "novo" ? "Registrar ausência" : "Editar ausência"}
              </div>
              <button className="modal-close" onClick={() => setAusenciaModal(null)}>
                x
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">COLABORADOR *</label>
                <select
                  className="form-input"
                  value={ausenciaForm.colaboradorId || ""}
                  onChange={(event) => setAusenciaForm((prev) => ({ ...prev, colaboradorId: event.target.value }))}
                >
                  <option value="">Selecione...</option>
                  {colaboradoresOpts.map((colaborador) => (
                    <option key={colaborador.id} value={colaborador.id}>
                      {colaborador.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">MOTIVO *</label>
                <input
                  className="form-input"
                  placeholder="Ex: Médico, problema no carro, buscar filho..."
                  value={ausenciaForm.motivo || ""}
                  onChange={(event) => setAusenciaForm((prev) => ({ ...prev, motivo: event.target.value }))}
                />
                <div className="admin-ausencia-field-note">Só admins veem.</div>
              </div>

              <div className="form-group admin-ausencia-panel">
                <label className="form-label" style={{ marginBottom: 0 }}>
                  INÍCIO
                </label>
                <div className="admin-ausencia-start-options">
                  <label className={`admin-ausencia-return-option admin-ausencia-start-option ${!ausenciaForm.diaTodo ? "is-active" : ""}`}>
                    <input
                      type="radio"
                      name="ausenciaInicioModo"
                      checked={!ausenciaForm.diaTodo}
                      onChange={() => toggleAusenciaDiaTodo(false)}
                    />
                    <span className="admin-ausencia-return-option-title">Com hora</span>
                    <span className="admin-ausencia-return-option-text">Escolher data e hora.</span>
                  </label>
                  <label className={`admin-ausencia-return-option admin-ausencia-start-option ${ausenciaForm.diaTodo ? "is-active" : ""}`}>
                    <input
                      type="radio"
                      name="ausenciaInicioModo"
                      checked={Boolean(ausenciaForm.diaTodo)}
                      onChange={() => toggleAusenciaDiaTodo(true)}
                    />
                    <span className="admin-ausencia-return-option-title">Dia todo</span>
                    <span className="admin-ausencia-return-option-text">Escolher só a data.</span>
                  </label>
                </div>
                {ausenciaForm.diaTodo ? (
                  <div className="admin-ausencia-inline-field">
                    <label className="form-label admin-ausencia-inline-label">DATA DE INÍCIO *</label>
                    <DatePicker
                      selected={ausenciaInicioDate}
                      onChange={(date) =>
                        setAusenciaForm((prev) => ({
                          ...prev,
                          inicio: formatDateForStore(date),
                        }))
                      }
                      locale={ptBR}
                      dateFormat="dd/MM/yyyy"
                      placeholderText="dd/mm/aaaa"
                      className="form-input datepicker-input"
                      calendarClassName="panet-datepicker panet-datepicker--datetime"
                      popperClassName="panet-datepicker-popper"
                    />
                  </div>
                ) : (
                  <div className="admin-ausencia-date-time-row">
                    <div className="admin-ausencia-inline-field">
                      <label className="form-label admin-ausencia-inline-label">DATA DE INÍCIO *</label>
                      <DatePicker
                        selected={ausenciaInicioDate}
                        onChange={(date) =>
                          setAusenciaForm((prev) => ({
                            ...prev,
                            inicio: combineLocalDateAndTime(formatDateForStore(date), getLocalTimePart(prev.inicio) || "00:00"),
                          }))
                        }
                        locale={ptBR}
                        dateFormat="dd/MM/yyyy"
                        placeholderText="dd/mm/aaaa"
                        className="form-input datepicker-input"
                        calendarClassName="panet-datepicker panet-datepicker--datetime"
                        popperClassName="panet-datepicker-popper"
                      />
                    </div>
                    <div className="admin-ausencia-inline-field is-time">
                      <label className="form-label admin-ausencia-inline-label">Hora</label>
                      <select
                        className="form-input"
                        value={ausenciaInicioTimePart || "00:00"}
                        onChange={(event) =>
                          setAusenciaForm((prev) => ({
                            ...prev,
                            inicio: combineLocalDateAndTime(getLocalDatePart(prev.inicio), event.target.value),
                          }))
                        }
                        disabled={!ausenciaInicioDatePart}
                      >
                        {AUSENCIA_TIME_OPTIONS.map((timeOption) => (
                          <option key={`inicio-${timeOption}`} value={timeOption}>
                            {timeOption}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                {ausenciaForm.diaTodo ? <div className="admin-ausencia-field-note">Sem horário.</div> : null}
              </div>

              <div className="form-group admin-ausencia-panel">
                <label className="form-label" style={{ marginBottom: 0 }}>
                  RETORNO
                </label>
                <div className="admin-ausencia-return-options">
                  <label
                    className={`admin-ausencia-return-option ${ausenciaForm.tipoTempo === "especifico" ? "is-active" : ""}`}
                  >
                    <input
                      type="radio"
                      name="tipoTempo"
                      checked={ausenciaForm.tipoTempo === "especifico"}
                      onChange={() => setAusenciaForm((prev) => ({ ...prev, tipoTempo: "especifico" }))}
                    />
                    <span className="admin-ausencia-return-option-title">Definido</span>
                    <span className="admin-ausencia-return-option-text">
                      {ausenciaForm.diaTodo ? "Escolher data." : "Escolher data e hora."}
                    </span>
                  </label>
                  <label
                    className={`admin-ausencia-return-option ${ausenciaForm.tipoTempo === "indefinido" ? "is-active" : ""}`}
                  >
                    <input
                      type="radio"
                      name="tipoTempo"
                      checked={ausenciaForm.tipoTempo === "indefinido"}
                      onChange={() => setAusenciaForm((prev) => ({ ...prev, tipoTempo: "indefinido", fim: "" }))}
                    />
                    <span className="admin-ausencia-return-option-title">Sem previsão</span>
                    <span className="admin-ausencia-return-option-text">Atualizar depois.</span>
                  </label>
                </div>

                {ausenciaForm.tipoTempo === "especifico" && (
                  <>
                    {ausenciaForm.diaTodo ? (
                      <>
                        <label className="form-label" style={{ marginBottom: 6 }}>
                          DATA DE RETORNO
                        </label>
                        <DatePicker
                          selected={ausenciaRetornoDate}
                          onChange={(date) =>
                            setAusenciaForm((prev) => ({
                              ...prev,
                              fim: formatDateForStore(date),
                            }))
                          }
                          locale={ptBR}
                          dateFormat="dd/MM/yyyy"
                          placeholderText="dd/mm/aaaa"
                          className="form-input datepicker-input"
                          calendarClassName="panet-datepicker panet-datepicker--datetime"
                          popperClassName="panet-datepicker-popper"
                          minDate={ausenciaInicioDate}
                        />
                      </>
                    ) : (
                      <>
                        <div className="admin-ausencia-date-time-row admin-ausencia-date-time-head">
                          <label className="form-label admin-ausencia-inline-label">DATA DE RETORNO</label>
                          <label className="form-label admin-ausencia-inline-label">Hora</label>
                        </div>
                        <div className="admin-ausencia-date-time-row">
                          <div className="admin-ausencia-inline-field">
                            <DatePicker
                              selected={ausenciaRetornoDate}
                              onChange={(date) =>
                                setAusenciaForm((prev) => ({
                                  ...prev,
                                  fim: combineLocalDateAndTime(
                                    formatDateForStore(date),
                                    getLocalTimePart(prev.fim) || getLocalTimePart(prev.inicio) || "00:00"
                                  ),
                                }))
                              }
                              locale={ptBR}
                              dateFormat="dd/MM/yyyy"
                              placeholderText="dd/mm/aaaa"
                              className="form-input datepicker-input"
                              calendarClassName="panet-datepicker panet-datepicker--datetime"
                              popperClassName="panet-datepicker-popper"
                              minDate={ausenciaInicioDate}
                            />
                          </div>
                          <div className="admin-ausencia-inline-field is-time">
                            <select
                              className="form-input"
                              value={ausenciaRetornoTimePart || ""}
                              aria-label="Hora de retorno"
                              onChange={(event) =>
                                setAusenciaForm((prev) => ({
                                  ...prev,
                                  fim: combineLocalDateAndTime(getLocalDatePart(prev.fim), event.target.value),
                                }))
                              }
                              disabled={!ausenciaRetornoDatePart}
                            >
                              <option value="">Selecione</option>
                              {AUSENCIA_TIME_OPTIONS.filter(
                                (timeOption) =>
                                  !ausenciaRetornoDatePart ||
                                  ausenciaRetornoDatePart !== ausenciaInicioDatePart ||
                                  !ausenciaInicioTimePart ||
                                  timeOption >= ausenciaInicioTimePart
                              ).map((timeOption) => (
                                <option key={`retorno-${timeOption}`} value={timeOption}>
                                  {timeOption}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </>
                    )}
                    {(ausenciaRetornoObrigatorio || ausenciaRetornoInvalido) && (
                      <div className="admin-presencial-form-error">
                        {ausenciaRetornoObrigatorio
                          ? ausenciaForm.diaTodo
                            ? "Escolha a data de retorno."
                            : "Escolha a data e hora de retorno."
                          : ausenciaForm.diaTodo
                          ? "A data de retorno não pode ser antes do início."
                          : "O retorno precisa ser depois do início."}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="admin-modal-actions" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn-ghost" onClick={() => setAusenciaModal(null)}>
                  Cancelar
                </button>
                <button
                  className="btn-primary"
                  onClick={salvarAusencia}
                  disabled={ausenciaSaving || ausenciaRetornoObrigatorio || ausenciaRetornoInvalido}
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      */}

      {confirmarExcluir !== null && (
        <div
          className="modal-overlay"
          style={{ alignItems: "center", justifyItems: "center" }}
          onClick={() => setConfirmarExcluir(null)}
        >
          <div className="modal" style={{ maxWidth: 360 }} onClick={(event) => event.stopPropagation()}>
            <div className="modal-body" style={{ textAlign: "center", padding: 32 }}>
              <div style={{ fontSize: 40, marginBottom: 12, display: "inline-flex", color: "var(--danger)" }}>
                <AlertTriangle size={36} />
              </div>
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
                Remover registro?
              </div>
              <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>Essa ação não pode ser desfeita.</div>
              <div className="admin-modal-actions" style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button className="btn-ghost" onClick={() => setConfirmarExcluir(null)}>
                  Cancelar
                </button>
                <button
                  onClick={removerRegistro}
                  style={{
                    background: "var(--danger)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 20px",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                  disabled={pendingDeleteIds.has(confirmarExcluir.id)}
                >
                  Remover
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {ausenciaConfirmarExcluir !== null && (
        <div
          className="modal-overlay"
          style={{ alignItems: "center", justifyItems: "center" }}
          onClick={() => setAusenciaConfirmarExcluir(null)}
        >
          <div className="modal" style={{ maxWidth: 360 }} onClick={(event) => event.stopPropagation()}>
            <div className="modal-body" style={{ textAlign: "center", padding: 32 }}>
              <div style={{ fontSize: 40, marginBottom: 12, display: "inline-flex", color: "var(--danger)" }}>
                <AlertTriangle size={36} />
              </div>
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
                Remover ausência?
              </div>
              <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>Essa ação não pode ser desfeita.</div>
              <div className="admin-modal-actions" style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button className="btn-ghost" onClick={() => setAusenciaConfirmarExcluir(null)}>
                  Cancelar
                </button>
                <button
                  onClick={removerAusencia}
                  style={{
                    background: "var(--danger)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 20px",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                  disabled={ausenciaPendingDelete.has(ausenciaConfirmarExcluir.id)}
                >
                  Remover
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
