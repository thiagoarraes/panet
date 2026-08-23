import { useEffect, useRef, useState } from "react";
import { Car, Upload, Loader2, CheckCircle2, AlertTriangle, FileText } from "lucide-react";
import { useCorridas } from "../../hooks/queries/useCorridas";
import { useEnviarCorrida } from "../../hooks/mutations/useCorridasMutations";

const ACCEPT = "application/pdf";

const STATUS_META = {
  pendente: { label: "Processando...", Icon: Loader2, color: "var(--muted)", spin: true },
  erro: { label: "Falha na leitura", Icon: AlertTriangle, color: "var(--danger)", spin: false },
};

export function CorridasAside({ currentUserId }) {
  const corridasQuery = useCorridas(currentUserId, { limit: 5 });
  const enviarCorrida = useEnviarCorrida(currentUserId);
  const fileInputRef = useRef(null);
  const sucessoTimer = useRef(null);
  const [file, setFile] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);

  const corridas = corridasQuery.data || [];

  useEffect(() => () => clearTimeout(sucessoTimer.current), []);

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
      setSucesso(true);
      clearTimeout(sucessoTimer.current);
      sucessoTimer.current = setTimeout(() => setSucesso(false), 5000);
    } catch (err) {
      setErro(err?.message || "Não foi possível enviar a corrida.");
    }
  };

  return (
    <div className="pan-card">
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
          {file ? file.name : "Anexar recibo (PDF)"}
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
          <div className="corrida-feedback is-erro">
            <span className="corrida-feedback-icone"><AlertTriangle size={15} /></span>
            <div className="corrida-feedback-textos">
              <span className="corrida-feedback-titulo">Não foi possível enviar</span>
              <span className="corrida-feedback-msg">{erro}</span>
            </div>
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

        {sucesso && (
          <div className="corrida-feedback is-ok">
            <span className="corrida-feedback-icone"><CheckCircle2 size={15} /></span>
            <div className="corrida-feedback-textos">
              <span className="corrida-feedback-titulo">Recibo enviado</span>
              <span className="corrida-feedback-msg">Corrida registrada com sucesso.</span>
            </div>
          </div>
        )}

        {corridas.some((c) => c.status_extracao !== "ok") && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 2 }}>
            {corridas.filter((c) => c.status_extracao !== "ok").map((c) => {
              const meta = STATUS_META[c.status_extracao] || STATUS_META.pendente;
              const { Icon } = meta;
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
