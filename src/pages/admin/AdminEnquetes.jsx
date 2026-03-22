import { useMemo, useState } from "react";
import { AlertTriangle, BarChart3, CircleStop, Pencil, Plus, Trash2, X } from "lucide-react";
import DatePicker from "react-datepicker";
import { ptBR } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { useAdminEnquetes } from "../../hooks/queries/admin/useAdminEnquetes.js";
import {
  useCreateEnquete,
  useDeleteEnquete,
  useEncerrarEnqueteAgora,
  useUpdateEnquete,
} from "../../hooks/mutations/useEnquetesMutations.js";
import { formatEnqueteDateTime } from "../../lib/enquetes.js";

const buildEmptyOptions = () => [{ id: "", text: "" }, { id: "", text: "" }];

const normalizeFormOptions = (options) =>
  (Array.isArray(options) ? options : [])
    .map((option) => ({
      id: option?.id ? String(option.id) : "",
      text: String(option?.text || "").trim(),
    }))
    .filter((option) => option.text.length > 0);

const toTotalVotesLabel = (totalVotes) => {
  const safeValue = Number(totalVotes || 0);
  if (safeValue === 1) return "1 voto";
  return `${safeValue} votos`;
};

export function AdminEnquetes({ currentUserId }) {
  const [status, setStatus] = useState("ativa");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({
    question: "",
    showPartial: true,
    endsAtDate: null,
    options: buildEmptyOptions(),
    optionsLocked: false,
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [confirmEnd, setConfirmEnd] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [pendingEndIds, setPendingEndIds] = useState(new Set());
  const [pendingDeleteIds, setPendingDeleteIds] = useState(new Set());

  const { data: rows = [], isLoading } = useAdminEnquetes({ status });
  const createEnquete = useCreateEnquete();
  const updateEnquete = useUpdateEnquete();
  const encerrarAgora = useEncerrarEnqueteAgora();
  const deleteEnquete = useDeleteEnquete();

  const subtitle = useMemo(() => {
    if (status === "encerrada") return "Enquetes finalizadas manualmente ou por data/hora.";
    return "Enquetes que ainda aceitam votos da equipe.";
  }, [status]);

  const openNewModal = () => {
    setErrorMsg("");
    setForm({
      question: "",
      showPartial: true,
      endsAtDate: null,
      options: buildEmptyOptions(),
      optionsLocked: false,
    });
    setModal("novo");
  };

  const openEditModal = (row) => {
    setErrorMsg("");
    setForm({
      id: row.id,
      question: row.question || "",
      showPartial: Boolean(row.showPartial),
      endsAtDate: row.endsAt ? new Date(row.endsAt) : null,
      options:
        row.options?.map((option) => ({
          id: option.id,
          text: option.text,
        })) || buildEmptyOptions(),
      optionsLocked: Number(row.totalVotes || 0) > 0,
    });
    setModal(row.id);
  };

  const setOptionText = (index, value) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((option, optionIndex) =>
        optionIndex === index ? { ...option, text: value } : option
      ),
    }));
  };

  const addOption = () => {
    setForm((prev) => {
      if (prev.optionsLocked) return prev;
      if ((prev.options || []).length >= 6) return prev;
      return {
        ...prev,
        options: [...(prev.options || []), { id: "", text: "" }],
      };
    });
  };

  const removeOption = (index) => {
    setForm((prev) => {
      if (prev.optionsLocked) return prev;
      if ((prev.options || []).length <= 2) return prev;
      return {
        ...prev,
        options: prev.options.filter((_, optionIndex) => optionIndex !== index),
      };
    });
  };

  const savePoll = async () => {
    const question = String(form.question || "").trim();
    const options = normalizeFormOptions(form.options);
    const endsAt = form.endsAtDate instanceof Date && !Number.isNaN(form.endsAtDate.getTime())
      ? form.endsAtDate.toISOString()
      : null;

    if (!question) {
      setErrorMsg("Informe a pergunta da enquete.");
      return;
    }
    if (options.length < 2) {
      setErrorMsg("A enquete precisa de pelo menos 2 opções preenchidas.");
      return;
    }
    if (options.length > 6) {
      setErrorMsg("A enquete pode ter no máximo 6 opções.");
      return;
    }

    try {
      setSaving(true);
      setErrorMsg("");
      if (modal === "novo") {
        await createEnquete.mutateAsync({
          question,
          options,
          endsAt,
          showPartial: form.showPartial,
          createdBy: currentUserId,
        });
      } else {
        await updateEnquete.mutateAsync({
          id: form.id,
          question,
          options,
          endsAt,
          showPartial: form.showPartial,
          optionsLocked: Boolean(form.optionsLocked),
        });
      }
      setModal(null);
    } catch (error) {
      setErrorMsg(error?.message || "Não foi possível salvar a enquete.");
    } finally {
      setSaving(false);
    }
  };

  const handleEncerrarAgora = async (pollId) => {
    if (!pollId) return;
    try {
      setPendingEndIds((prev) => new Set(prev).add(pollId));
      await encerrarAgora.mutateAsync(pollId);
      setConfirmEnd(null);
    } catch (error) {
      console.error(error);
    } finally {
      setPendingEndIds((prev) => {
        const next = new Set(prev);
        next.delete(pollId);
        return next;
      });
    }
  };

  const handleDelete = async (pollId) => {
    if (!pollId) return;
    try {
      setPendingDeleteIds((prev) => new Set(prev).add(pollId));
      await deleteEnquete.mutateAsync(pollId);
      setConfirmDelete(null);
    } catch (error) {
      console.error(error);
    } finally {
      setPendingDeleteIds((prev) => {
        const next = new Set(prev);
        next.delete(pollId);
        return next;
      });
    }
  };

  return (
    <div>
      <div className="admin-toolbar" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div className="filter-tabs">
            <button className={`filter-tab ${status === "ativa" ? "active" : ""}`} onClick={() => setStatus("ativa")}>
              Ativa
            </button>
            <button
              className={`filter-tab ${status === "encerrada" ? "active" : ""}`}
              onClick={() => setStatus("encerrada")}
            >
              Encerrada
            </button>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{subtitle}</div>
        </div>
        <button className="btn-primary" onClick={openNewModal}>
          <Plus size={14} style={{ marginRight: 6, verticalAlign: "text-bottom" }} />
          Nova enquete
        </button>
      </div>

      <div className="stagger admin-enquetes-list">
        {rows.map((row) => (
          <div key={row.id} className="card admin-enquete-card" style={{ padding: 16 }}>
            <div className="admin-enquete-head">
              <div className="admin-enquete-main">
                <div className="admin-enquete-title-row">
                  <div className="admin-enquete-title">{row.question}</div>
                  <span className={`status-chip ${row.status === "ativa" ? "status-andamento" : "status-marcado"}`}>
                    {row.status === "ativa" ? "Ativa" : "Encerrada"}
                  </span>
                </div>
                <div className="admin-enquete-meta">
                  <span>{row.options.length} opcoes</span>
                  <span>{toTotalVotesLabel(row.totalVotes)}</span>
                  <span>
                    Resultado parcial: {row.showPartial ? "sim" : "nao"}
                  </span>
                  {row.endsAt ? <span>Encerra em {formatEnqueteDateTime(row.endsAt)}</span> : null}
                </div>
              </div>
              <div className="admin-enquete-actions">
                <button
                  className="admin-action-icon"
                  type="button"
                  onClick={() => openEditModal(row)}
                  aria-label="Editar enquete"
                  title="Editar"
                >
                  <Pencil />
                </button>
                {row.status === "ativa" ? (
                  <button
                    className="admin-action-icon"
                    type="button"
                    onClick={() => setConfirmEnd(row)}
                    disabled={pendingEndIds.has(row.id)}
                    aria-label="Encerrar agora"
                    title={pendingEndIds.has(row.id) ? "Encerrando..." : "Encerrar agora"}
                  >
                    <CircleStop />
                  </button>
                ) : null}
                <button
                  className="admin-action-icon is-danger"
                  type="button"
                  onClick={() => setConfirmDelete(row)}
                  disabled={pendingDeleteIds.has(row.id)}
                  aria-label="Excluir enquete"
                  title={pendingDeleteIds.has(row.id) ? "Excluindo..." : "Excluir"}
                >
                  <Trash2 />
                </button>
              </div>
            </div>

            <div className="admin-enquete-options">
              {row.options.map((option) => (
                <div key={option.id} className="admin-enquete-option-row">
                  <div className="admin-enquete-option-info">
                    <span className="admin-enquete-option-text">{option.text}</span>
                    <span className="admin-enquete-option-votes">{option.percent}%</span>
                  </div>
                  <div className="admin-enquete-option-track">
                    <span className="admin-enquete-option-fill" style={{ width: `${option.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {rows.length === 0 && (
        <div className="empty-state">{isLoading ? "Carregando enquetes..." : "Nenhuma enquete neste status."}</div>
      )}

      {modal !== null && (
        <div className="modal-overlay" style={{ alignItems: "center", justifyItems: "center" }} onClick={() => setModal(null)}>
          <div className="modal admin-enquete-modal" style={{ maxWidth: 620 }} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17 }}>
                {modal === "novo" ? "Criar enquete" : "Editar enquete"}
              </div>
              <button className="modal-close" onClick={() => setModal(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">PERGUNTA *</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: 84, resize: "vertical" }}
                  value={form.question || ""}
                  onChange={(event) => setForm((prev) => ({ ...prev, question: event.target.value }))}
                  placeholder="Ex: Qual horário você prefere para o alinhamento semanal?"
                />
              </div>

              <div className="form-group">
                <div className="admin-enquete-options-head">
                  <label className="form-label" style={{ marginBottom: 0 }}>
                    OPÇÕES (2 A 6) *
                  </label>
                  <button
                    className="btn-ghost"
                    type="button"
                    style={{ padding: "6px 10px", fontSize: 12 }}
                    onClick={addOption}
                    disabled={form.optionsLocked || (form.options || []).length >= 6}
                  >
                    + Adicionar opção
                  </button>
                </div>
                <div className="admin-enquete-options-editor">
                  {(form.options || []).map((option, index) => (
                    <div key={`${option.id || "new"}-${index}`} className="admin-enquete-option-editor-row">
                      <input
                        className="form-input"
                        value={option.text || ""}
                        onChange={(event) => setOptionText(index, event.target.value)}
                        placeholder={`Opção ${index + 1}`}
                        disabled={form.optionsLocked}
                      />
                      <button
                        className="admin-action-icon is-danger"
                        type="button"
                        onClick={() => removeOption(index)}
                        disabled={form.optionsLocked || (form.options || []).length <= 2}
                        aria-label="Remover opção"
                        title="Remover opção"
                      >
                        <Trash2 />
                      </button>
                    </div>
                  ))}
                </div>
                {form.optionsLocked ? (
                  <div className="admin-enquete-form-note">
                    Esta enquete já possui votos. As opções ficam bloqueadas para preservar os votos registrados.
                  </div>
                ) : null}
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">ENCERRAR AUTOMATICAMENTE</label>
                  <DatePicker
                    selected={form.endsAtDate}
                    onChange={(date) => setForm((prev) => ({ ...prev, endsAtDate: date || null }))}
                    locale={ptBR}
                    showTimeSelect
                    timeFormat="HH:mm"
                    timeCaption="Hora"
                    dateFormat="dd/MM/yyyy HH:mm"
                    placeholderText="dd/mm/aaaa --:--"
                    className="form-input datepicker-input"
                    calendarClassName="panet-datepicker panet-datepicker--datetime"
                    popperClassName="panet-datepicker-popper"
                    isClearable
                  />
                  <div className="admin-enquete-form-note">Deixe vazio para encerrar manualmente.</div>
                </div>
                <div className="form-group">
                  <label className="form-label">MOSTRAR RESULTADO PARCIAL</label>
                  <div className="filter-tabs">
                    <button
                      type="button"
                      className={`filter-tab ${form.showPartial ? "active" : ""}`}
                      onClick={() => setForm((prev) => ({ ...prev, showPartial: true }))}
                    >
                      Sim
                    </button>
                    <button
                      type="button"
                      className={`filter-tab ${form.showPartial ? "" : "active"}`}
                      onClick={() => setForm((prev) => ({ ...prev, showPartial: false }))}
                    >
                      Não
                    </button>
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div className="admin-presencial-form-error" style={{ marginBottom: 4 }}>
                  {errorMsg}
                </div>
              )}

              <div className="admin-modal-actions" style={{ justifyContent: "flex-end" }}>
                <button className="btn-ghost" onClick={() => setModal(null)}>
                  Cancelar
                </button>
                <button className="btn-primary" onClick={savePoll} disabled={saving}>
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmEnd !== null && (
        <div className="modal-overlay" style={{ alignItems: "center", justifyItems: "center" }} onClick={() => setConfirmEnd(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={(event) => event.stopPropagation()}>
            <div className="modal-body" style={{ textAlign: "center", padding: 28 }}>
              <div style={{ fontSize: 40, marginBottom: 12, display: "inline-flex", color: "var(--accent)" }}>
                <BarChart3 size={36} />
              </div>
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
                Encerrar enquete agora?
              </div>
              <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>
                Os votos param imediatamente e o resultado final continua visível.
              </div>
              <div className="admin-modal-actions" style={{ justifyContent: "center" }}>
                <button className="btn-ghost" onClick={() => setConfirmEnd(null)}>
                  Cancelar
                </button>
                <button className="btn-primary" onClick={() => handleEncerrarAgora(confirmEnd.id)} disabled={pendingEndIds.has(confirmEnd.id)}>
                  Encerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDelete !== null && (
        <div
          className="modal-overlay"
          style={{ alignItems: "center", justifyItems: "center" }}
          onClick={() => setConfirmDelete(null)}
        >
          <div className="modal" style={{ maxWidth: 360 }} onClick={(event) => event.stopPropagation()}>
            <div className="modal-body" style={{ textAlign: "center", padding: 28 }}>
              <div style={{ fontSize: 40, marginBottom: 12, display: "inline-flex", color: "var(--danger)" }}>
                <AlertTriangle size={36} />
              </div>
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
                Excluir enquete?
              </div>
              <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>
                Esta acao remove pergunta, opcoes e votos.
              </div>
              <div className="admin-modal-actions" style={{ justifyContent: "center" }}>
                <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>
                  Cancelar
                </button>
                <button
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
                  onClick={() => handleDelete(confirmDelete.id)}
                  disabled={pendingDeleteIds.has(confirmDelete.id)}
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
