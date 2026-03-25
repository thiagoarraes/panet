import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useAdminEnquetes } from "../../hooks/queries/admin/useAdminEnquetes.js";
import {
  useCreateEnquete,
  useDeleteEnquete,
  useEncerrarEnqueteAgora,
  useUpdateEnquete,
} from "../../hooks/mutations/useEnquetesMutations.js";
import { EnqueteCard } from "./AdminEnquetes/EnqueteCard.jsx";
import { EnqueteModal } from "./AdminEnquetes/EnqueteModal.jsx";
import { ConfirmarEncerrarModal, ConfirmarExcluirModal } from "./AdminEnquetes/ConfirmarModais.jsx";

const buildEmptyOptions = () => [{ id: "", text: "" }, { id: "", text: "" }];

const normalizeFormOptions = (options) =>
  (Array.isArray(options) ? options : [])
    .map((opt) => ({ id: opt?.id ? String(opt.id) : "", text: String(opt?.text || "").trim() }))
    .filter((opt) => opt.text.length > 0);

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

  const subtitle = useMemo(
    () =>
      status === "encerrada"
        ? "Enquetes finalizadas manualmente ou por data/hora."
        : "Enquetes que ainda aceitam votos da equipe.",
    [status]
  );

  const openNewModal = () => {
    setErrorMsg("");
    setForm({ question: "", showPartial: true, endsAtDate: null, options: buildEmptyOptions(), optionsLocked: false });
    setModal("novo");
  };

  const openEditModal = (row) => {
    setErrorMsg("");
    setForm({
      id: row.id,
      question: row.question || "",
      showPartial: Boolean(row.showPartial),
      endsAtDate: row.endsAt ? new Date(row.endsAt) : null,
      options: row.options?.map((opt) => ({ id: opt.id, text: opt.text })) || buildEmptyOptions(),
      optionsLocked: Number(row.totalVotes || 0) > 0,
    });
    setModal(row.id);
  };

  const savePoll = async () => {
    const question = String(form.question || "").trim();
    const options = normalizeFormOptions(form.options);
    const endsAt =
      form.endsAtDate instanceof Date && !Number.isNaN(form.endsAtDate.getTime())
        ? form.endsAtDate.toISOString()
        : null;

    if (!question) { setErrorMsg("Informe a pergunta da enquete."); return; }
    if (options.length < 2) { setErrorMsg("A enquete precisa de pelo menos 2 opções preenchidas."); return; }
    if (options.length > 6) { setErrorMsg("A enquete pode ter no máximo 6 opções."); return; }

    try {
      setSaving(true);
      setErrorMsg("");
      if (modal === "novo") {
        await createEnquete.mutateAsync({ question, options, endsAt, showPartial: form.showPartial, createdBy: currentUserId });
      } else {
        await updateEnquete.mutateAsync({ id: form.id, question, options, endsAt, showPartial: form.showPartial, optionsLocked: Boolean(form.optionsLocked) });
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
      setPendingEndIds((prev) => { const next = new Set(prev); next.delete(pollId); return next; });
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
      setPendingDeleteIds((prev) => { const next = new Set(prev); next.delete(pollId); return next; });
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
            <button className={`filter-tab ${status === "encerrada" ? "active" : ""}`} onClick={() => setStatus("encerrada")}>
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
          <EnqueteCard
            key={row.id}
            row={row}
            pendingEndIds={pendingEndIds}
            pendingDeleteIds={pendingDeleteIds}
            onEditar={openEditModal}
            onConfirmEnd={setConfirmEnd}
            onConfirmDelete={setConfirmDelete}
          />
        ))}
      </div>

      {rows.length === 0 && (
        <div className="empty-state">{isLoading ? "Carregando enquetes..." : "Nenhuma enquete neste status."}</div>
      )}

      {modal !== null && (
        <EnqueteModal
          modal={modal}
          form={form}
          setForm={setForm}
          errorMsg={errorMsg}
          saving={saving}
          onClose={() => setModal(null)}
          onSave={savePoll}
        />
      )}

      {confirmEnd !== null && (
        <ConfirmarEncerrarModal
          confirmEnd={confirmEnd}
          pendingEndIds={pendingEndIds}
          onClose={() => setConfirmEnd(null)}
          onConfirm={() => handleEncerrarAgora(confirmEnd.id)}
        />
      )}

      {confirmDelete !== null && (
        <ConfirmarExcluirModal
          confirmDelete={confirmDelete}
          pendingDeleteIds={pendingDeleteIds}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => handleDelete(confirmDelete.id)}
        />
      )}
    </div>
  );
}
