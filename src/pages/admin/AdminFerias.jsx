import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { CalendarDays, Plane, UserMinus } from "lucide-react";
import { useAdminFerias } from "../../hooks/queries/admin/useAdminFerias.js";
import { useAdminAusencias } from "../../hooks/queries/admin/useAdminAusencias.js";
import { useCreateFerias, useDeleteFerias, useUpdateFerias } from "../../hooks/mutations/useFeriasMutations.js";
import { useCreateAusencia, useDeleteAusencia, useUpdateAusencia } from "../../hooks/mutations/useAusenciasMutations.js";
import { useColaboradores } from "../../hooks/queries/useColaboradores.js";
import {
  formatAusenciaValueForForm,
  getAusenciaFormComputed,
  localDateToIsoBoundary,
  localToIso,
} from "../../lib/adminAusenciaForm.js";
import { FeriasDayoffList } from "./AdminFerias/FeriasDayoffList.jsx";
import { AusenciaList } from "./AdminFerias/AusenciaList.jsx";
import { FeriasModal } from "./AdminFerias/FeriasModal.jsx";
import { ConfirmarExcluirModal } from "./AdminFerias/ConfirmarExcluirModal.jsx";

const AdminAusenciaModal = lazy(() =>
  import("./AdminAusenciaModal").then((m) => ({ default: m.AdminAusenciaModal }))
);

const toIso = (brDate) => {
  const [day, month, year] = String(brDate || "").split("/");
  return `${year}-${month}-${day}`;
};

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Gera opções de mês: 12 meses atrás + 6 meses à frente
// ---------------------------------------------------------------------------
const gerarOpcoesMes = () => {
  const hoje = new Date();
  const opcoes = [];
  for (let i = -12; i <= 6; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    opcoes.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return opcoes;
};

const OPCOES_MES = gerarOpcoesMes();

// ---------------------------------------------------------------------------
// Componente de filtros reutilizável
// ---------------------------------------------------------------------------
function FilterBar({
  statusFilter, onStatusFilter,
  mesFiltro, onMesFiltro,
  colaboradorFiltro, onColaboradorFiltro,
  colaboradoresOpts,
  count, loading,
}) {
  const STATUS_OPTS = [
    { value: "ativo",   label: "Ativos" },
    { value: "passado", label: "Passados" },
    { value: "todos",   label: "Todos" },
  ];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        padding: "10px 0 12px",
        borderBottom: "1px solid var(--border)",
        marginBottom: 16,
      }}
    >
      {/* Pills de status */}
      <div style={{ display: "flex", gap: 4 }}>
        {STATUS_OPTS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onStatusFilter(opt.value)}
            style={{
              padding: "5px 13px",
              fontSize: 12,
              fontWeight: statusFilter === opt.value ? 600 : 400,
              borderRadius: 20,
              border: statusFilter === opt.value
                ? "1px solid color-mix(in srgb, var(--accent) 55%, var(--border))"
                : "1px solid var(--border)",
              background: statusFilter === opt.value
                ? "color-mix(in srgb, var(--accent) 14%, var(--surface2))"
                : "var(--surface2)",
              color: statusFilter === opt.value ? "var(--accent)" : "var(--muted)",
              cursor: "pointer",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Divisor */}
      <div style={{ width: 1, height: 20, background: "var(--border)" }} />

      {/* Mês */}
      <select
        className="form-input"
        style={{ maxWidth: 170, fontSize: 12, padding: "5px 10px", height: 32 }}
        value={mesFiltro}
        onChange={(e) => onMesFiltro(e.target.value)}
      >
        <option value="">Todos os meses</option>
        {OPCOES_MES.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* Colaborador */}
      <select
        className="form-input"
        style={{ maxWidth: 210, fontSize: 12, padding: "5px 10px", height: 32 }}
        value={colaboradorFiltro}
        onChange={(e) => onColaboradorFiltro(e.target.value)}
      >
        <option value="">Todos os colaboradores</option>
        {colaboradoresOpts.map((col) => (
          <option key={col.id} value={col.id}>{col.nome}</option>
        ))}
      </select>

      {/* Contagem */}
      {!loading && (
        <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>
          {count} {count === 1 ? "registro" : "registros"}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AdminFerias
// ---------------------------------------------------------------------------
export function AdminFerias({ currentUserId }) {
  const [sub, setSub] = useState("ferias");

  // ── Férias / Day Off ────────────────────────────────────────────────────
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [confirmarExcluir, setConfirmarExcluir] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingDeleteIds, setPendingDeleteIds] = useState(new Set());

  // Filtros Férias/Day Off
  const [feriasStatus, setFeriasStatus] = useState("ativo");
  const [feriasMes, setFeriasMes] = useState("");
  const [feriasColab, setFeriasColab] = useState("");

  // ── Ausências ───────────────────────────────────────────────────────────
  const [ausenciaModal, setAusenciaModal] = useState(null);
  const [ausenciaForm, setAusenciaForm] = useState({});
  const [ausenciaConfirmarExcluir, setAusenciaConfirmarExcluir] = useState(null);
  const [ausenciaSaving, setAusenciaSaving] = useState(false);
  const [ausenciaSearchInput, setAusenciaSearchInput] = useState("");
  const [ausenciaSearchTerm, setAusenciaSearchTerm] = useState("");
  const [ausenciaPage, setAusenciaPage] = useState(1);
  const [ausenciaPendingDelete, setAusenciaPendingDelete] = useState(new Set());

  // Filtros Ausências
  const [ausenciaStatus, setAusenciaStatus] = useState("ativo");
  const [ausenciaMes, setAusenciaMes] = useState("");
  const [ausenciaColab, setAusenciaColab] = useState("");

  // ── Debounce search ─────────────────────────────────────────────────────
  useEffect(() => {
    const t = window.setTimeout(() => { setSearchTerm(searchInput.trim().toLowerCase()); setCurrentPage(1); }, 250);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const t = window.setTimeout(() => { setAusenciaSearchTerm(ausenciaSearchInput.trim().toLowerCase()); setAusenciaPage(1); }, 250);
    return () => window.clearTimeout(t);
  }, [ausenciaSearchInput]);

  // Reset page ao mudar filtros
  useEffect(() => {
    const id = setTimeout(() => setCurrentPage(1), 0);
    return () => clearTimeout(id);
  }, [sub, feriasStatus, feriasMes, feriasColab]);
  useEffect(() => {
    const id = setTimeout(() => setAusenciaPage(1), 0);
    return () => clearTimeout(id);
  }, [ausenciaStatus, ausenciaMes, ausenciaColab]);

  // ── Queries ─────────────────────────────────────────────────────────────
  const { data: feriasData, isLoading: feriasLoading } = useAdminFerias({
    page: currentPage,
    pageSize: PAGE_SIZE,
    search: searchTerm,
    tipo: sub === "ferias" ? "ferias" : "dayoff",
    statusFilter: feriasStatus,
    mes: feriasMes,
    colaboradorId: feriasColab,
  });

  const rows       = sub !== "ausencia" ? feriasData?.rows  || [] : [];
  const totalItems = sub !== "ausencia" ? feriasData?.count || 0  : 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage   = Math.min(currentPage, totalPages);

  const { data: ausenciaData, isLoading: ausenciaLoading } = useAdminAusencias({
    page: ausenciaPage,
    pageSize: PAGE_SIZE,
    search: ausenciaSearchTerm,
    statusFilter: ausenciaStatus,
    mes: ausenciaMes,
    colaboradorId: ausenciaColab,
  });

  const ausenciaRows        = ausenciaData?.rows  || [];
  const ausenciaTotalItems  = ausenciaData?.count || 0;
  const ausenciaTotalPages  = Math.max(1, Math.ceil(ausenciaTotalItems / PAGE_SIZE));

  const { data: colaboradoresData } = useColaboradores(currentUserId);
  const colaboradoresOpts = useMemo(
    () => [...(colaboradoresData || [])].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [colaboradoresData]
  );

  // ── Mutations ────────────────────────────────────────────────────────────
  const createFerias  = useCreateFerias();
  const updateFerias  = useUpdateFerias();
  const deleteFerias  = useDeleteFerias();
  const createAusencia = useCreateAusencia();
  const updateAusencia = useUpdateAusencia();
  const deleteAusencia = useDeleteAusencia();

  // ── Handlers Férias/Day Off ──────────────────────────────────────────────
  const abrirNovo = () => {
    setForm({ colaboradorId: "", inicio: "", fim: "", status: "marcado", motivoReal: "" });
    setModal("novo");
  };

  const abrirEditar = (item) => {
    setForm({
      id: item.id,
      colaboradorId: String(item.colaborador.id),
      inicio: toIso(item.inicio),
      fim: toIso(item.fim),
      status: item.status || "marcado",
      motivoReal: item.motivoReal || "",
    });
    setModal(item.id);
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
      if (modal === "novo") await createFerias.mutateAsync(payload);
      else await updateFerias.mutateAsync({ id: form.id, payload });
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
      setPendingDeleteIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  // ── Handlers Ausências ───────────────────────────────────────────────────
  const abrirAusenciaNova = () => {
    setAusenciaForm({ colaboradorId: "", motivo: "", inicio: "", fim: "", tipoTempo: "especifico", diaTodo: false });
    setAusenciaModal("novo");
  };

  const abrirEditarAusencia = (item) => {
    setAusenciaForm({
      colaboradorId: String(item.colaborador.id),
      motivo: item.motivo,
      inicio: formatAusenciaValueForForm(item.inicio, item.diaTodo),
      fim: formatAusenciaValueForForm(item.fim, item.diaTodo),
      tipoTempo: item.fim ? "especifico" : "indefinido",
      diaTodo: Boolean(item.diaTodo),
    });
    setAusenciaModal(item.id);
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
        inicio: ausenciaForm.diaTodo
          ? localDateToIsoBoundary(ausenciaForm.inicio, "start")
          : localToIso(ausenciaForm.inicio),
        fim:
          ausenciaForm.tipoTempo === "especifico" && ausenciaForm.fim
            ? ausenciaForm.diaTodo
              ? localDateToIsoBoundary(ausenciaForm.fim, "end")
              : localToIso(ausenciaForm.fim)
            : null,
        estimativa: null,
        dia_todo: Boolean(ausenciaForm.diaTodo),
      };
      if (ausenciaModal === "novo") await createAusencia.mutateAsync(payload);
      else await updateAusencia.mutateAsync({ id: ausenciaModal, payload });
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
      setAusenciaPendingDelete((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  const placeholderBusca = sub === "dayoff"
    ? "Buscar por colaborador, cargo ou motivo"
    : sub === "ferias"
    ? "Buscar por colaborador ou cargo"
    : "Buscar por colaborador ou motivo";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Toolbar principal ─────────────────────────────────────────────── */}
      <div
        className="admin-toolbar"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 0 }}
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
                style={{ maxWidth: 300 }}
                placeholder={placeholderBusca}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <button className="btn-primary" onClick={abrirNovo}>+ Adicionar</button>
            </>
          ) : (
            <>
              <input
                className="form-input"
                style={{ maxWidth: 300 }}
                placeholder="Buscar por colaborador ou motivo"
                value={ausenciaSearchInput}
                onChange={(e) => setAusenciaSearchInput(e.target.value)}
              />
              <button className="btn-primary" onClick={abrirAusenciaNova}>+ Registrar ausência</button>
            </>
          )}
        </div>
      </div>

      {/* ── Barra de filtros ──────────────────────────────────────────────── */}
      {sub !== "ausencia" ? (
        <FilterBar
          statusFilter={feriasStatus}
          onStatusFilter={setFeriasStatus}
          mesFiltro={feriasMes}
          onMesFiltro={setFeriasMes}
          colaboradorFiltro={feriasColab}
          onColaboradorFiltro={setFeriasColab}
          colaboradoresOpts={colaboradoresOpts}
          count={totalItems}
          loading={feriasLoading}
        />
      ) : (
        <FilterBar
          statusFilter={ausenciaStatus}
          onStatusFilter={setAusenciaStatus}
          mesFiltro={ausenciaMes}
          onMesFiltro={setAusenciaMes}
          colaboradorFiltro={ausenciaColab}
          onColaboradorFiltro={setAusenciaColab}
          colaboradoresOpts={colaboradoresOpts}
          count={ausenciaTotalItems}
          loading={ausenciaLoading}
        />
      )}

      {/* ── Listas ───────────────────────────────────────────────────────── */}
      {sub !== "ausencia" && (
        <FeriasDayoffList
          rows={rows}
          feriasLoading={feriasLoading}
          sub={sub}
          totalItems={totalItems}
          safePage={safePage}
          totalPages={totalPages}
          pendingDeleteIds={pendingDeleteIds}
          onEditar={abrirEditar}
          onConfirmarExcluir={setConfirmarExcluir}
          setCurrentPage={setCurrentPage}
        />
      )}

      {sub === "ausencia" && (
        <AusenciaList
          ausenciaRows={ausenciaRows}
          ausenciaLoading={ausenciaLoading}
          ausenciaTotalItems={ausenciaTotalItems}
          ausenciaPage={ausenciaPage}
          ausenciaTotalPages={ausenciaTotalPages}
          ausenciaPendingDelete={ausenciaPendingDelete}
          onEditarAusencia={abrirEditarAusencia}
          onConfirmarExcluirAusencia={setAusenciaConfirmarExcluir}
          setAusenciaPage={setAusenciaPage}
        />
      )}

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {modal !== null && sub !== "ausencia" && (
        <FeriasModal
          modal={modal}
          sub={sub}
          form={form}
          setForm={setForm}
          saving={saving}
          colaboradoresOpts={colaboradoresOpts}
          onClose={() => setModal(null)}
          onSalvar={salvar}
        />
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

      {confirmarExcluir !== null && (
        <ConfirmarExcluirModal
          title="Remover registro?"
          disabled={pendingDeleteIds.has(confirmarExcluir.id)}
          onClose={() => setConfirmarExcluir(null)}
          onConfirm={removerRegistro}
        />
      )}

      {ausenciaConfirmarExcluir !== null && (
        <ConfirmarExcluirModal
          title="Remover ausência?"
          disabled={ausenciaPendingDelete.has(ausenciaConfirmarExcluir.id)}
          onClose={() => setAusenciaConfirmarExcluir(null)}
          onConfirm={removerAusencia}
        />
      )}
    </div>
  );
}
