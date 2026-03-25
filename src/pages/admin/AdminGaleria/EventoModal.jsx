import { X } from "lucide-react";

export const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function EventoModal({ modal, eventoForm, setEventoForm, filesLote, setFilesLote, saving, onClose, onSalvar }) {
  return (
    <div className="modal-overlay" style={{ alignItems: "center", justifyItems: "center" }} onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17 }}>
            {modal === "novo" ? "Novo evento da galeria" : "Editar evento da galeria"}
          </div>
          <button className="modal-close" onClick={onClose}>
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
                {MESES.map((m) => (
                  <option key={m} value={m}>{m}</option>
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
          {modal === "novo" && (
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
            <button className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" onClick={onSalvar} disabled={saving || !eventoForm.mes || !eventoForm.ano}>
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
