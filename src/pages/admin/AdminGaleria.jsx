import { useEffect, useMemo, useRef, useState } from "react";
import { ImageIcon, Pencil, Trash2, X } from "lucide-react";
import { useAdminGaleria } from "../../hooks/queries/admin/useAdminGaleria.js";
import {
  useCreateGaleriaEvento,
  useUpdateGaleriaEvento,
  useDeleteGaleriaEvento,
  useDeleteGaleriaFoto,
  useUploadGaleriaFotos,
  useSetGaleriaCapa,
} from "../../hooks/mutations/useGaleriaMutations.js";

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
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const PAGE_SIZE = 20;

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

  const eventoAtual = useMemo(() => {
    return rows.find((e) => e.id === modalFotos) || null;
  }, [modalFotos, rows]);

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
      setPendingDeleteIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const salvarEvento = async () => {
    if (!eventoForm.titulo.trim()) return;
    if (!eventoForm.mes || !eventoForm.ano) return;
    try {
      setSaving(true);
      const mesAno = [eventoForm.mes.trim(), eventoForm.ano.trim()].filter(Boolean).join(" ").trim();
      const payload = {
        titulo: eventoForm.titulo.trim(),
        mes_ano: mesAno || null,
      };
      if (modalEvento === "novo") {
        const created = await createEvento.mutateAsync(payload);
        const monthNum = meses.findIndex((m) => m === eventoForm.mes) + 1;
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
    const monthNum = meses.findIndex((m) => m.toLowerCase() === mesLabel.toLowerCase()) + 1 || new Date().getMonth() + 1;
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
          <div key={evento.id} className="card" style={{ padding: 14 }}>
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
        <div className="modal-overlay" style={{ alignItems: "center", justifyItems: "center" }} onClick={() => setModalEvento(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17 }}>
                {modalEvento === "novo" ? "Novo evento da galeria" : "Editar evento da galeria"}
              </div>
              <button className="modal-close" onClick={() => setModalEvento(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">TÍTULO *</label>
                <input
                  className="form-input"
                  value={eventoForm.titulo}
                  onChange={(e) => setEventoForm((p) => ({ ...p, titulo: e.target.value }))}
                  placeholder="Ex: Festa de fim de ano"
                />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">MÊS</label>
                  <select className="form-input" value={eventoForm.mes} onChange={(e) => setEventoForm((p) => ({ ...p, mes: e.target.value }))}>
                    <option value="">Selecione</option>
                    {meses.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">ANO</label>
                  <input
                    className="form-input"
                    value={eventoForm.ano}
                    onChange={(e) => setEventoForm((p) => ({ ...p, ano: String(e.target.value).replace(/\D/g, "").slice(0, 4) }))}
                    placeholder="Ex: 2026"
                  />
                </div>
              </div>
              {modalEvento === "novo" && (
                <div className="form-group">
                  <label className="form-label">FOTOS DO EVENTO (ENVIO MÚLTIPLO)</label>
                  <div className="upload-zone" style={{ padding: 18, textAlign: "left" }}>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        const selected = Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/"));
                        setFilesLote(selected);
                      }}
                    />
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                      As imagens serão otimizadas sem perda perceptível, convertidas para WebP e limitadas a 1080px de largura.
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      Destino no Storage: <strong>galeria/{`{ano}`}/{`{mes}`}/evento-id/</strong>
                    </div>
                    {filesLote.length > 0 && (
                      <div style={{ marginTop: 10, fontSize: 12, color: "var(--text)" }}>
                        {filesLote.length} arquivo(s) selecionado(s)
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
                A capa é definida automaticamente pela primeira foto do evento.
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button className="btn-ghost" onClick={() => setModalEvento(null)}>
                  Cancelar
                </button>
                <button className="btn-primary" onClick={salvarEvento} disabled={saving || !eventoForm.mes || !eventoForm.ano}>
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalFotos !== null && eventoAtual && (
        <div className="modal-overlay" style={{ alignItems: "center", justifyItems: "center" }} onClick={() => setModalFotos(null)}>
          <div className="modal" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17, display: "inline-flex", gap: 8, alignItems: "center" }}>
                <ImageIcon size={16} /> Fotos de {eventoAtual.evento}
              </div>
              <button className="modal-close" onClick={() => setModalFotos(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="admin-galeria-fotos-toolbar" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                <input
                  ref={inputFotosMaisRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => handleUploadMaisFotos(e.target.files)}
                />
                <button className="btn-primary" onClick={() => inputFotosMaisRef.current?.click()} disabled={saving}>
                  {saving ? "Enviando..." : "+ Adicionar mais fotos"}
                </button>
              </div>
              <div className="admin-galeria-fotos-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                {(eventoAtual.fotos || []).map((foto) => (
                  <div key={foto.id} className="card admin-galeria-foto-card" style={{ padding: 8 }}>
                    {eventoAtual.capa === foto.src && (
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "var(--accent)",
                          marginBottom: 6,
                          letterSpacing: 0.4,
                        }}
                      >
                        CAPA ATUAL
                      </div>
                    )}
                    <img src={foto.src} alt={foto.legenda || "foto"} style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 8 }} />
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, minHeight: 18 }}>{foto.legenda || "Sem legenda"}</div>
                    <div className="admin-galeria-foto-actions" style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <button
                        className="btn-ghost"
                        style={{ padding: "4px 8px", fontSize: 12 }}
                        onClick={() => setCapa.mutate({ eventoId: eventoAtual.id, fotoUrl: foto.src })}
                      >
                        Definir capa
                      </button>
                      <button
                        className="admin-action-icon is-danger"
                        type="button"
                        onClick={() => deleteFoto.mutate(foto.id)}
                        aria-label="Excluir foto"
                        title="Excluir"
                      >
                        <Trash2 />
                      </button>
                    </div>
                  </div>
                ))}
                {(eventoAtual.fotos || []).length === 0 && <div className="empty-state">Nenhuma foto neste evento.</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
