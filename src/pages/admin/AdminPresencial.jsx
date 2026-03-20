import { useEffect, useState } from "react";
import { AlertTriangle, CalendarDays, Clock3, Gift, MapPin, Users } from "lucide-react";
import DatePicker from "react-datepicker";
import { ptBR } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { useAdminPresencial } from "../../hooks/queries/admin/useAdminPresencial.js";
import {
  useCreatePresencialAgenda,
  useUpdatePresencialAgenda,
  useDeletePresencialAgenda,
  useRunSecretSanta,
} from "../../hooks/mutations/usePresencialMutations.js";

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

const formatDateLabel = (isoDate) =>
  new Date(`${isoDate}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const formatTimeLabel = (timeValue) => String(timeValue || "").slice(0, 5);
const normalizeTimeInput = (rawValue) => {
  const digits = String(rawValue || "")
    .replace(/\D/g, "")
    .slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
};
const isValidTime24h = (value) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || ""));

export function AdminPresencial() {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmarExcluir, setConfirmarExcluir] = useState(null);
  const [removingId, setRemovingId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchTerm(searchInput.trim().toLowerCase());
      setCurrentPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading } = useAdminPresencial({ page: currentPage, pageSize: PAGE_SIZE, search: searchTerm });
  const rows = data?.rows || [];
  const totalItems = data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const uiPage = Math.min(currentPage, totalPages);

  const createAgenda = useCreatePresencialAgenda();
  const updateAgenda = useUpdatePresencialAgenda();
  const deleteAgenda = useDeletePresencialAgenda();
  const runSecretSanta = useRunSecretSanta();

  const openNew = () => {
    setForm({
      titulo: "",
      dataIso: "",
      horaIso: "",
      amigoSecretoAtivo: false,
      amigoSecretoRegras: "",
      amigoSecretoSorteadoAt: null,
      local: "Agência Pan",
      mapsUrl: "https://maps.app.goo.gl/QzdePpy5Zf2JLvNp7",
      vagas: 12,
      observacao: "",
      status: "aberto",
    });
    setModal("novo");
  };

  const openEdit = (agenda) => {
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
    });
    setModal(agenda.id);
  };

  const saveAgenda = async () => {
    if (!form.titulo || !form.dataIso) return;
    if (form.horaIso && !isValidTime24h(form.horaIso)) return;
    try {
      setSaving(true);
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
      };
      if (modal === "novo") {
        await createAgenda.mutateAsync(payload);
      } else {
        await updateAgenda.mutateAsync({ id: form.id, payload });
      }
      setModal(null);
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
    } finally {
      setRemovingId("");
    }
  };

  return (
    <div>
      <div className="admin-toolbar" style={{ marginBottom: 16 }}>
        <div>
          <div className="section-title" style={{ fontSize: 17 }}>
            Confirmar presença
          </div>
          <div className="section-sub">Crie eventos, organize a participação do time e acompanhe as confirmações em um só lugar.</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            className="form-input"
            style={{ maxWidth: 320 }}
            placeholder="Buscar por titulo, local ou observacao"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button className="btn-primary" onClick={openNew}>
            + Novo evento
          </button>
        </div>
      </div>

      <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((agenda) => {
          const confirmados = (agenda.confirmacoes || []).filter((item) => item.status === "confirmado" || item.status === "talvez").length;
          const participantesSorteio = (agenda.confirmacoes || []).filter((item) => item.status === "talvez").length;
          const vagas = Number(agenda.vagas || 0);
          return (
            <div key={agenda.id} className="card" style={{ padding: 16 }}>
              <div className="admin-presencial-row">
                <div className="admin-presencial-main">
                  <div className="admin-presencial-title">{agenda.titulo}</div>
                  <div className="admin-presencial-meta">
                    <span>
                      <CalendarDays size={13} /> {formatDateLabel(agenda.dataIso)}
                    </span>
                    {agenda.horaIso && (
                      <span>
                        <Clock3 size={13} /> {formatTimeLabel(agenda.horaIso)}
                      </span>
                    )}
                    <span>
                      <MapPin size={13} /> {agenda.local || "Escritorio Pan"}
                    </span>
                    <span>
                      <Users size={13} /> {confirmados} confirmado(s)
                      {vagas > 0 ? ` / ${vagas} vaga(s)` : ""}
                    </span>
                    {agenda.amigoSecretoAtivo && (
                      <span>
                        <Gift size={13} /> {participantesSorteio} no sorteio
                      </span>
                    )}
                  </div>
                  {agenda.observacao && <div className="admin-presencial-note">{agenda.observacao}</div>}
                  {agenda.amigoSecretoAtivo && agenda.amigoSecretoRegras && (
                    <div className="admin-presencial-note" style={{ marginTop: 8 }}>
                      <strong>Regras do amigo secreto:</strong> {agenda.amigoSecretoRegras}
                    </div>
                  )}
                </div>

                <div className="admin-presencial-side">
                  <span className={`status-chip ${agenda.status === "encerrado" ? "status-andamento" : "status-marcado"}`}>
                    {agenda.status === "encerrado" ? "Encerrado" : agenda.status === "cancelado" ? "Cancelado" : "Aberto"}
                  </span>
                  <div className="admin-presencial-actions">
                    {agenda.amigoSecretoAtivo && (
                      <button
                        className="btn-ghost"
                        onClick={() => runSecretSanta.mutate(agenda.id)}
                        disabled={runSecretSanta.isPending || Boolean(agenda.amigoSecretoSorteadoAt) || participantesSorteio < 2}
                      >
                        {agenda.amigoSecretoSorteadoAt ? "Sorteio iniciado" : "Iniciar sorteio"}
                      </button>
                    )}
                    <button className="btn-ghost" onClick={() => openEdit(agenda)}>
                      Editar
                    </button>
                    <button
                      className="btn-ghost"
                      style={{ color: "var(--danger)", borderColor: "color-mix(in srgb, var(--danger) 35%, var(--border))" }}
                      onClick={() => setConfirmarExcluir(agenda)}
                      disabled={removingId === agenda.id}
                    >
                      {removingId === agenda.id ? "Removendo..." : "Remover"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <div className="empty-state">{isLoading ? "Carregando..." : "Nenhum dia presencial encontrado."}</div>}
      </div>

      {totalItems > PAGE_SIZE && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            Página {uiPage} de {totalPages} · {totalItems} item(ns)
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-ghost" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={uiPage <= 1}>
              Anterior
            </button>
            <button className="btn-ghost" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={uiPage >= totalPages}>
              Próxima
            </button>
          </div>
        </div>
      )}

      {modal !== null && (
        <div className="modal-overlay" style={{ alignItems: "center", justifyItems: "center" }} onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17 }}>
                {modal === "novo" ? "Novo evento" : "Editar evento"}
              </div>
              <button className="modal-close" onClick={() => setModal(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">TÍTULO *</label>
                <input className="form-input" value={form.titulo || ""} onChange={(e) => setForm((prev) => ({ ...prev, titulo: e.target.value }))} />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">DATA *</label>
                  <DatePicker
                    selected={parseIsoToDate(form.dataIso)}
                    onChange={(date) => setForm((prev) => ({ ...prev, dataIso: formatDateForStore(date) }))}
                    locale={ptBR}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="dd/mm/aaaa"
                    className="form-input datepicker-input"
                    calendarClassName="panet-datepicker"
                    popperClassName="panet-datepicker-popper"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">HORA</label>
                  <input
                    className="form-input"
                    type="text"
                    inputMode="numeric"
                    placeholder="HH:MM"
                    maxLength={5}
                    title="Use o formato 24h (HH:MM)"
                    value={form.horaIso || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, horaIso: normalizeTimeInput(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">VAGAS</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  value={form.vagas ?? 0}
                  onChange={(e) => setForm((prev) => ({ ...prev, vagas: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">LOCAL</label>
                <input className="form-input" value={form.local || ""} onChange={(e) => setForm((prev) => ({ ...prev, local: e.target.value }))} />
              </div>

              <div className="form-group">
                <label className="form-label">LINK DO GOOGLE MAPS</label>
                <input
                  className="form-input"
                  type="url"
                  placeholder="https://maps.google.com/..."
                  value={form.mapsUrl || ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, mapsUrl: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">STATUS</label>
                <select className="form-input" value={form.status || "aberto"} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
                  <option value="aberto">Aberto</option>
                  <option value="encerrado">Encerrado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(form.amigoSecretoAtivo)}
                    disabled={Boolean(form.amigoSecretoSorteadoAt)}
                    onChange={(e) => setForm((prev) => ({ ...prev, amigoSecretoAtivo: e.target.checked }))}
                  />
                  Ativar amigo secreto neste evento
                </label>
              </div>

              {form.amigoSecretoAtivo && (
                <div className="form-group">
                  <label className="form-label">REGRAS DO SORTEIO</label>
                  <textarea
                    className="form-input"
                    rows="4"
                    value={form.amigoSecretoRegras || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, amigoSecretoRegras: e.target.value }))}
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">OBSERVAÇÃO</label>
                <textarea
                  className="form-input"
                  rows="4"
                  value={form.observacao || ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, observacao: e.target.value }))}
                />
              </div>

              <div className="admin-modal-actions" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn-ghost" onClick={() => setModal(null)}>
                  Cancelar
                </button>
                <button className="btn-primary" onClick={saveAgenda} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmarExcluir !== null && (
        <div className="modal-overlay" style={{ alignItems: "center", justifyItems: "center" }} onClick={() => setConfirmarExcluir(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-body" style={{ textAlign: "center", padding: 32 }}>
              <div style={{ fontSize: 40, marginBottom: 12, display: "inline-flex", color: "var(--danger)" }}>
                <AlertTriangle size={36} />
              </div>
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Remover dia presencial?</div>
              <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 22 }}>
                Esta acao remove a data e todas as confirmacoes vinculadas.
              </div>
              <div className="admin-modal-actions" style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button className="btn-ghost" onClick={() => setConfirmarExcluir(null)}>
                  Cancelar
                </button>
                <button
                  onClick={removeAgenda}
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
                  disabled={removingId === confirmarExcluir.id}
                >
                  {removingId === confirmarExcluir.id ? "Removendo..." : "Remover"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
