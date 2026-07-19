import { useRef, useState } from "react";
import { Car, Upload, Loader2, CheckCircle2, AlertTriangle, FileText } from "lucide-react";
import { useCorridas } from "../../hooks/queries/useCorridas";
import { useEnviarCorrida } from "../../hooks/mutations/useCorridasMutations";

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

const formatBrl = (v) =>
  typeof v === "number" ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "";

const STATUS_META = {
  pendente: { label: "Processando...", Icon: Loader2, color: "var(--muted)", spin: true },
  ok: { label: "Extraído", Icon: CheckCircle2, color: "var(--accent)", spin: false },
  erro: { label: "Falha na leitura", Icon: AlertTriangle, color: "var(--danger)", spin: false },
};

export function CorridasAside({ currentUserId }) {
  const corridasQuery = useCorridas(currentUserId, { limit: 5 });
  const enviarCorrida = useEnviarCorrida(currentUserId);
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");

  const corridas = corridasQuery.data || [];

  const handlePickFile = (e) => {
    const picked = e.target.files?.[0] || null;
    setErro("");
    setFile(picked);
  };

  const handleEnviar = async () => {
    setErro("");
    try {
      await enviarCorrida.mutateAsync({ file, motivo });
      setFile(null);
      setMotivo("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setErro(err?.message || "Não foi possível enviar a corrida.");
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Car size={14} /> PanUber
        </span>
      </div>
      <div className="card-body" style={{ padding: "12px 12px 10px", display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => fileInputRef.current?.click()}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12 }}
        >
          {file ? <FileText size={14} /> : <Upload size={14} />}
          {file ? file.name : "Anexar recibo (imagem ou PDF)"}
        </button>
        <input ref={fileInputRef} type="file" accept={ACCEPT} onChange={handlePickFile} style={{ display: "none" }} />

        <textarea
          className="form-input"
          placeholder="Motivo da corrida (ex: reunião com cliente X)"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={2}
          style={{ fontSize: 12, resize: "vertical" }}
        />

        {erro && (
          <div style={{ fontSize: 11, color: "var(--danger)", background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.28)", borderRadius: 8, padding: "6px 8px" }}>
            {erro}
          </div>
        )}

        <button
          className="btn-primary"
          onClick={handleEnviar}
          disabled={enviarCorrida.isPending || !file || !motivo.trim()}
          style={{ fontSize: 12, padding: "9px 11px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          {enviarCorrida.isPending ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
          {enviarCorrida.isPending ? "Enviando..." : "Registrar corrida"}
        </button>

        {corridas.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 2 }}>
            {corridas.map((c) => {
              const meta = STATUS_META[c.status_extracao] || STATUS_META.pendente;
              const { Icon } = meta;
              if (c.status_extracao === "ok") {
                return (
                  <div key={c.id} className="corrida-aside-ok">
                    <CheckCircle2 size={14} />
                    Recibo enviado com sucesso
                  </div>
                );
              }
              return (
                <div
                  key={c.id}
                  style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "8px 10px", background: "var(--surface2)" }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 11, color: meta.color, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Icon size={12} className={meta.spin ? "spin" : ""} /> {meta.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, marginTop: 3, color: "var(--text)" }}>{c.motivo}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
