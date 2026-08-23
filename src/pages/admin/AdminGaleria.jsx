import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useAdminGaleria } from "../../hooks/queries/admin/useAdminGaleria.js";
import {
  useCreateGaleriaEvento,
  useUpdateGaleriaEvento,
  useDeleteGaleriaEvento,
  useDeleteGaleriaFoto,
  useUploadGaleriaFotos,
  useSetGaleriaCapa,
} from "../../hooks/mutations/useGaleriaMutations.js";
import { EventoModal, MESES } from "./AdminGaleria/EventoModal.jsx";
import { FotosModal } from "./AdminGaleria/FotosModal.jsx";

const PAGE_SIZE = 20;

export function AdminGaleria() {
  const [modalEvento, setModalEvento] = useState(null);
  const [modalFotos, setModalFotos] = useState(null);
  const [eventoForm, setEventoForm] = useState({ titulo: "", mes: "", ano: "" });
  const [filesLote, setFilesLote] = useState([]);
  const [saving, setSaving] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingDeleteIds, setPendingDeleteIds] = useState(new Set());
  const inputFotosMaisRef = useRef(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchTerm(searchInput.trim().toLowerCase());
      setCurrentPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading } = useAdminGaleria({ page: currentPage, pageSize: PAGE_SIZE, search: searchTerm });
  const rows = useMemo(() => data?.rows || [], [data?.rows]);
  const totalItems = data?.count || 0;
  const uiTotalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const uiPage = Math.min(currentPage, uiTotalPages);

  const createEvento = useCreateGaleriaEvento();
  const updateEvento = useUpdateGaleriaEvento();
  const deleteEvento = useDeleteGaleriaEvento();
  const deleteFoto = useDeleteGaleriaFoto();
  const uploadFotos = useUploadGaleriaFotos();
  const setCapa = useSetGaleriaCapa();

  const eventoAtual = useMemo(() => rows.find((e) => e.id === modalFotos) || null, [modalFotos, rows]);

  const abrirNovoEvento = () => {
    setEventoForm({ titulo: "", mes: "", ano: "" });
    setFilesLote([]);
    setModalEvento("novo");
  };

  const abrirEditarEvento = (evento) => {
    const [mesAtual = "", anoAtual = ""] = String(evento.mes || "").split(" ");
    setEventoForm({ titulo: evento.evento || "", mes: mesAtual, ano: anoAtual });
    setFilesLote([]);
    setModalEvento(evento.id);
  };

  const excluirEvento = async (id) => {
    try {
      setPendingDeleteIds((prev) => new Set(prev).add(id));
      await deleteEvento.mutateAsync(id);
    } catch (error) {
      console.error(error);
    } finally {
      setPendingDeleteIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  const salvarEvento = async () => {
    if (!eventoForm.titulo.trim() || !eventoForm.mes || !eventoForm.ano) return;
    try {
      setSaving(true);
      const mesAno = [eventoForm.mes.trim(), eventoForm.ano.trim()].filter(Boolean).join(" ").trim();
      const payload = { titulo: eventoForm.titulo.trim(), mes_ano: mesAno || null };
      if (modalEvento === "novo") {
        const created = await createEvento.mutateAsync(payload);
        const monthNum = MESES.findIndex((m) => m === eventoForm.mes) + 1;
        if (created?.id && filesLote.length > 0) {
          await uploadFotos.mutateAsync({
            eventoId: created.id,
            files: filesLote,
            opts: { year: eventoForm.ano, month: monthNum, setCapaIfEmpty: true },
            currentEventoFotosLength: 0,
          });
        }
      } else {
        await updateEvento.mutateAsync({ id: modalEvento, payload });
      }
      setFilesLote([]);
      setModalEvento(null);
    } finally {
      setSaving(false);
    }
  };

  const handleUploadMaisFotos = async (filesList) => {
    if (!eventoAtual?.id) return;
    const files = Array.from(filesList || []).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    const [mesLabel = "", anoLabel = ""] = String(eventoAtual.mes || "").split(" ");
    const monthNum = MESES.findIndex((m) => m.toLowerCase() === mesLabel.toLowerCase()) + 1 || new Date().getMonth() + 1;
    const year = String(anoLabel || new Date().getFullYear());
    try {
      setSaving(true);
      await uploadFotos.mutateAsync({
        eventoId: eventoAtual.id,
        files,
        opts: { year, month: monthNum },
        currentEventoFotosLength: eventoAtual.fotos?.length || 0,
      });
    } finally {
      setSaving(false);
      if (inputFotosMaisRef.current) inputFotosMaisRef.current.value = "";
    }
  };

  return (
    <div>
      <div className="admin-toolbar admin-toolbar-end" style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 16 }}>
        <input
          className="form-input"
          style={{ maxWidth: 320 }}
          placeholder="Buscar por evento ou mês"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button className="btn-primary" onClick={abrirNovoEvento}>
          + Novo evento
        </button>
      </div>

      <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((evento) => (
          <div key={evento.id} className="pan-card" style={{ padding: 14 }}>
            <div className="admin-galeria-row" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img
                src={evento.capa || evento.fotos?.[0]?.src || "https://picsum.photos/seed/galeria-empty/120/80"}
                alt={evento.evento}
                style={{ width: 84, height: 56, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }}
              />
              <div className="admin-galeria-main" style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 14 }}>{evento.evento}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  {evento.mes || "Sem mês"} · {evento.fotos?.length || 0} foto(s)
                </div>
              </div>
              <div className="admin-galeria-actions" style={{ display: "flex", gap: 6 }}>
                <button className="btn-ghost" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => setModalFotos(evento.id)}>
                  Fotos
                </button>
                <button
                  className="admin-action-icon"
                  type="button"
                  onClick={() => abrirEditarEvento(evento)}
                  aria-label={`Editar ${evento.evento}`}
                  title="Editar"
                >
                  <Pencil />
                </button>
                <button
                  className="admin-action-icon is-danger"
                  type="button"
                  onClick={() => excluirEvento(evento.id)}
                  disabled={pendingDeleteIds.has(evento.id)}
                  aria-label={pendingDeleteIds.has(evento.id) ? "Excluindo evento" : `Excluir ${evento.evento}`}
                  title={pendingDeleteIds.has(evento.id) ? "Excluindo..." : "Excluir"}
                >
                  <Trash2 />
                </button>
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="empty-state">
            {isLoading ? "Carregando..." : searchTerm ? "Nenhum evento encontrado para este filtro." : "Sem eventos de galeria."}
          </div>
        )}
      </div>

      {totalItems > PAGE_SIZE && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            Página {uiPage} de {uiTotalPages} · {totalItems} item(ns)
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-ghost" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={uiPage <= 1}>
              Anterior
            </button>
            <button className="btn-ghost" onClick={() => setCurrentPage((p) => Math.min(uiTotalPages, p + 1))} disabled={uiPage >= uiTotalPages}>
              Próxima
            </button>
          </div>
        </div>
      )}

      {modalEvento !== null && (
        <EventoModal
          modal={modalEvento}
          eventoForm={eventoForm}
          setEventoForm={setEventoForm}
          filesLote={filesLote}
          setFilesLote={setFilesLote}
          saving={saving}
          onClose={() => setModalEvento(null)}
          onSalvar={salvarEvento}
        />
      )}

      {modalFotos !== null && eventoAtual && (
        <FotosModal
          eventoAtual={eventoAtual}
          saving={saving}
          inputFotosMaisRef={inputFotosMaisRef}
          onClose={() => setModalFotos(null)}
          onUploadMais={handleUploadMaisFotos}
          onSetCapa={setCapa.mutate}
          onDeleteFoto={deleteFoto.mutate}
        />
      )}
    </div>
  );
}
