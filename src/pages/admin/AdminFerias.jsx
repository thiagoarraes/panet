import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { CalendarDays, Plane, UserMinus } from "lucide-react";
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

  useEffect(() => { setCurrentPage(1); }, [sub]);

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
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <button className="btn-primary" onClick={abrirNovo}>+ Adicionar</button>
            </>
          ) : (
            <>
              <input
                className="form-input"
                style={{ maxWidth: 320 }}
                placeholder="Buscar por colaborador ou motivo"
                value={ausenciaSearchInput}
                onChange={(e) => setAusenciaSearchInput(e.target.value)}
              />
              <button className="btn-primary" onClick={abrirAusenciaNova}>+ Registrar ausência</button>
            </>
          )}
        </div>
      </div>

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
