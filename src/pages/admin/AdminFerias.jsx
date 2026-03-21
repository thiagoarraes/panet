import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Clock, Plane, UserMinus } from "lucide-react";
import DatePicker from "react-datepicker";
import { ptBR } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { Avatar } from "../../components/Avatar";
import { useAdminFerias } from "../../hooks/queries/admin/useAdminFerias.js";
import { useAdminAusencias } from "../../hooks/queries/admin/useAdminAusencias.js";
import { useCreateFerias, useDeleteFerias, useUpdateFerias } from "../../hooks/mutations/useFeriasMutations.js";
import { useCreateAusencia, useDeleteAusencia, useUpdateAusencia } from "../../hooks/mutations/useAusenciasMutations.js";
import { useColaboradores } from "../../hooks/queries/useColaboradores.js";

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

const formatDateForStore = (date) => {
  if (!date || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseLocalDateTime = (value) => {
  if (!value) return null;
  const [datePart, timePart = "00:00"] = String(value).split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);
  if (!year || !month || !day || Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
};

const formatDateTimeForStore = (date) => {
  if (!date || Number.isNaN(date.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
};

const formatDateTimeLocal = (isoString) => {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  return formatDateTimeForStore(date);
};

const formatDisplayDateTime = (isoString) => {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const isSameLocalDateTime = (leftValue, rightValue) => {
  const left = parseLocalDateTime(leftValue);
  const right = parseLocalDateTime(rightValue);
  if (!left || !right) return false;
  return left.getTime() === right.getTime();
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
      estimativa: "",
      tipoTempo: "especifico",
    });
    setAusenciaModal("novo");
  };

  const localToIso = (localStr) => {
    if (!localStr) return null;
    const date = parseLocalDateTime(localStr);
    return !date || Number.isNaN(date.getTime()) ? null : date.toISOString();
  };

  const salvarAusencia = async () => {
    if (!ausenciaForm.colaboradorId || !ausenciaForm.motivo || !ausenciaForm.inicio) return;
    if (ausenciaForm.tipoTempo === "especifico" && isSameLocalDateTime(ausenciaForm.inicio, ausenciaForm.fim)) return;

    try {
      setAusenciaSaving(true);
      const payload = {
        colaborador_id: ausenciaForm.colaboradorId,
        motivo: ausenciaForm.motivo,
        inicio: localToIso(ausenciaForm.inicio),
        fim: ausenciaForm.tipoTempo === "especifico" && ausenciaForm.fim ? localToIso(ausenciaForm.fim) : null,
        estimativa: ausenciaForm.tipoTempo === "estimativa" && ausenciaForm.estimativa ? ausenciaForm.estimativa : null,
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

  const ausenciaRetornoIgualAoInicio =
    ausenciaForm.tipoTempo === "especifico" && isSameLocalDateTime(ausenciaForm.inicio, ausenciaForm.fim);

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
          <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rows.map((item) => (
              <div key={item.id} className="card" style={{ padding: 16 }}>
                <div className="admin-ferias-row" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar col={item.colaborador} size={40} />

                  <div className="admin-ferias-main" style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{item.colaborador.nome}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{item.colaborador.cargo}</div>
                    <div
                      className="admin-ferias-dates"
                      style={{ fontSize: 12, marginTop: 4, display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      <CalendarDays size={12} /> {sub === "dayoff" ? item.inicio : `${item.inicio} - ${item.fim}`}
                    </div>

                    {sub === "dayoff" && item.motivoReal ? (
                      <div
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
                          style={{
                            color: "var(--muted)",
                            fontSize: 10,
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          Motivo real:{" "}
                        </span>
                        {item.motivoReal}
                      </div>
                    ) : null}
                  </div>

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
                      className="btn-ghost"
                      style={{ padding: "4px 10px", fontSize: 12 }}
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
                    >
                      Editar
                    </button>

                    <button
                      onClick={() => setConfirmarExcluir(item)}
                      style={{
                        background: "rgba(255,107,107,0.1)",
                        border: "1px solid rgba(255,107,107,0.3)",
                        color: "var(--danger)",
                        borderRadius: 6,
                        padding: "4px 10px",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                      disabled={pendingDeleteIds.has(item.id)}
                    >
                      {pendingDeleteIds.has(item.id) ? "Removendo..." : "Remover"}
                    </button>
                  </div>
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
          <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ausenciaRows.map((item) => (
              <div key={item.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar col={item.colaborador} size={40} />

                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{item.colaborador.nome}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{item.colaborador.cargo}</div>
                    <div style={{ fontSize: 12, marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Clock size={12} />
                      {formatDisplayDateTime(item.inicio)}
                      {item.fim
                        ? ` -> ${formatDisplayDateTime(item.fim)}`
                        : item.estimativa
                          ? ` · ${item.estimativa}`
                          : " · sem previsão"}
                    </div>
                    <div
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

                  <span
                    className="status-chip"
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

                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      className="btn-ghost"
                      style={{ padding: "4px 10px", fontSize: 12 }}
                      onClick={() => {
                        setAusenciaForm({
                          colaboradorId: String(item.colaborador.id),
                          motivo: item.motivo,
                          inicio: formatDateTimeLocal(item.inicio),
                          fim: formatDateTimeLocal(item.fim),
                          estimativa: item.estimativa || "",
                          tipoTempo: item.fim ? "especifico" : item.estimativa ? "estimativa" : "indefinido",
                        });
                        setAusenciaModal(item.id);
                      }}
                    >
                      Editar
                    </button>

                    <button
                      onClick={() => setAusenciaConfirmarExcluir(item)}
                      style={{
                        background: "rgba(255,107,107,0.1)",
                        border: "1px solid rgba(255,107,107,0.3)",
                        color: "var(--danger)",
                        borderRadius: 6,
                        padding: "4px 10px",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                      disabled={ausenciaPendingDelete.has(item.id)}
                    >
                      {ausenciaPendingDelete.has(item.id) ? "Removendo..." : "Remover"}
                    </button>
                  </div>
                </div>
              </div>
            ))}

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
                  <label className="form-label">MOTIVO REAL</label>
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
        <div
          className="modal-overlay"
          style={{ alignItems: "center", justifyItems: "center" }}
          onClick={() => setAusenciaModal(null)}
        >
          <div className="modal" style={{ maxWidth: 500 }} onClick={(event) => event.stopPropagation()}>
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
                <label className="form-label">MOTIVO REAL *</label>
                <input
                  className="form-input"
                  placeholder="Ex: Médico, problema no carro, buscar filho..."
                  value={ausenciaForm.motivo || ""}
                  onChange={(event) => setAusenciaForm((prev) => ({ ...prev, motivo: event.target.value }))}
                />
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Visível apenas para administradores.</div>
              </div>

              <div className="form-group">
                <label className="form-label">INÍCIO *</label>
                <DatePicker
                  selected={parseLocalDateTime(ausenciaForm.inicio)}
                  onChange={(date) =>
                    setAusenciaForm((prev) => {
                      const nextInicio = formatDateTimeForStore(date);
                      const prevFimDate = parseLocalDateTime(prev.fim);
                      const nextInicioDate = parseLocalDateTime(nextInicio);

                      return {
                        ...prev,
                        inicio: nextInicio,
                        fim:
                          prev.tipoTempo === "especifico" && prevFimDate && nextInicioDate && prevFimDate < nextInicioDate
                            ? nextInicio
                            : prev.fim,
                      };
                    })
                  }
                  locale={ptBR}
                  dateFormat="dd/MM/yyyy HH:mm"
                  timeFormat="HH:mm"
                  timeCaption="Hora"
                  showTimeSelect
                  timeIntervals={15}
                  placeholderText="dd/mm/aaaa --:--"
                  className="form-input datepicker-input"
                  calendarClassName="panet-datepicker panet-datepicker--datetime"
                  popperClassName="panet-datepicker-popper"
                />
              </div>

              <div className="form-group">
                <label className="form-label">TEMPO DE RETORNO</label>
                <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                    <input
                      type="radio"
                      name="tipoTempo"
                      checked={ausenciaForm.tipoTempo === "especifico"}
                      onChange={() => setAusenciaForm((prev) => ({ ...prev, tipoTempo: "especifico", estimativa: "" }))}
                    />
                    Horário específico
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                    <input
                      type="radio"
                      name="tipoTempo"
                      checked={ausenciaForm.tipoTempo === "estimativa"}
                      onChange={() => setAusenciaForm((prev) => ({ ...prev, tipoTempo: "estimativa", fim: "" }))}
                    />
                    Estimativa
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                    <input
                      type="radio"
                      name="tipoTempo"
                      checked={ausenciaForm.tipoTempo === "indefinido"}
                      onChange={() =>
                        setAusenciaForm((prev) => ({ ...prev, tipoTempo: "indefinido", fim: "", estimativa: "" }))
                      }
                    />
                    Indefinido
                  </label>
                </div>

                {ausenciaForm.tipoTempo === "especifico" && (
                  <>
                    <DatePicker
                      selected={parseLocalDateTime(ausenciaForm.fim)}
                      onChange={(date) =>
                        setAusenciaForm((prev) => {
                          const inicioDate = parseLocalDateTime(prev.inicio);
                          const nextFimDate = date && inicioDate && date < inicioDate ? inicioDate : date;
                          return { ...prev, fim: formatDateTimeForStore(nextFimDate) };
                        })
                      }
                      locale={ptBR}
                      dateFormat="dd/MM/yyyy HH:mm"
                      timeFormat="HH:mm"
                      timeCaption="Hora"
                      showTimeSelect
                      timeIntervals={15}
                      placeholderText="dd/mm/aaaa --:--"
                      className="form-input datepicker-input"
                      calendarClassName="panet-datepicker panet-datepicker--datetime"
                      popperClassName="panet-datepicker-popper"
                      minDate={parseLocalDateTime(ausenciaForm.inicio)}
                    />
                    {ausenciaRetornoIgualAoInicio && (
                      <div className="admin-presencial-form-error">O tempo de retorno precisa ser diferente do início.</div>
                    )}
                  </>
                )}

                {ausenciaForm.tipoTempo === "estimativa" && (
                  <input
                    className="form-input"
                    placeholder='Ex: "2h", "tarde toda", "1h30"'
                    value={ausenciaForm.estimativa || ""}
                    onChange={(event) => setAusenciaForm((prev) => ({ ...prev, estimativa: event.target.value }))}
                  />
                )}
              </div>

              <div className="admin-modal-actions" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn-ghost" onClick={() => setAusenciaModal(null)}>
                  Cancelar
                </button>
                <button className="btn-primary" onClick={salvarAusencia} disabled={ausenciaSaving || ausenciaRetornoIgualAoInicio}>
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
