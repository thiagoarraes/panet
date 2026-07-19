import { useEffect, useState } from "react";
import { AlertTriangle, FileText } from "lucide-react";
import { supabase, isSupabaseEnabled } from "../../../lib/supabase.js";
import { useAtualizarCorrida } from "../../../hooks/mutations/useCorridasMutations";

const CAMPOS = [
  { key: "origem", label: "Origem", type: "text" },
  { key: "destino", label: "Destino", type: "text" },
  { key: "horario", label: "Horário", type: "datetime-local" },
  { key: "duracao_min", label: "Duração (min)", type: "number" },
  { key: "km", label: "Km", type: "number" },
  { key: "veiculo", label: "Veículo", type: "text" },
  { key: "motorista", label: "Motorista", type: "text" },
  { key: "valor_total", label: "Valor total (R$)", type: "number" },
];

// Converte ISO -> valor aceito por <input type="datetime-local"> (sem timezone).
const isoToLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const buildForm = (corrida) => ({
  origem: corrida.origem || "",
  destino: corrida.destino || "",
  horario: isoToLocalInput(corrida.horario),
  duracao_min: corrida.duracao_min ?? "",
  km: corrida.km ?? "",
  veiculo: corrida.veiculo || "",
  motorista: corrida.motorista || "",
  valor_total: corrida.valor_total ?? "",
});

export function CorridaModal({ corrida, onClose }) {
  const [reciboUrl, setReciboUrl] = useState("");
  const [form, setForm] = useState(() => buildForm(corrida));
  const [erro, setErro] = useState("");
  const atualizar = useAtualizarCorrida();

  const isPdf = corrida.recibo_mime === "application/pdf";

  useEffect(() => {
    let active = true;
    (async () => {
      if (!isSupabaseEnabled || !supabase || !corrida.recibo_path) return;
      const { data, error } = await supabase.storage.from("recibos").createSignedUrl(corrida.recibo_path, 60 * 30);
      if (active && !error) setReciboUrl(data?.signedUrl || "");
    })();
    return () => {
      active = false;
    };
  }, [corrida.recibo_path]);

  const handleSalvar = async () => {
    setErro("");
    const campos = {
      origem: form.origem.trim() || null,
      destino: form.destino.trim() || null,
      horario: form.horario ? new Date(form.horario).toISOString() : null,
      duracao_min: form.duracao_min === "" ? null : Math.round(Number(form.duracao_min)),
      km: form.km === "" ? null : Number(form.km),
      veiculo: form.veiculo.trim() || null,
      motorista: form.motorista.trim() || null,
      valor_total: form.valor_total === "" ? null : Number(form.valor_total),
      status_extracao: "ok",
      erro_extracao: null,
    };
    try {
      await atualizar.mutateAsync({ id: corrida.id, campos });
      onClose();
    } catch (err) {
      setErro(err?.message || "Não foi possível salvar.");
    }
  };

  return (
    <div className="modal-overlay" style={{ alignItems: "center", justifyItems: "center" }} onClick={onClose}>
      <div className="modal collab-modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17 }}>Detalhes da corrida</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Recibo enviado</div>
            {corrida.status_extracao === "erro" && corrida.erro_extracao && (
              <div style={{ fontSize: 11, color: "var(--danger)", background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.28)", borderRadius: 8, padding: "6px 8px", marginBottom: 8, display: "flex", gap: 6 }}>
                <AlertTriangle size={13} /> {corrida.erro_extracao}
              </div>
            )}
            {reciboUrl ? (
              isPdf ? (
                <a href={reciboUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <FileText size={14} /> Abrir PDF do recibo
                </a>
              ) : (
                <img src={reciboUrl} alt="Recibo" style={{ width: "100%", borderRadius: 10, border: "1px solid var(--border)" }} />
              )
            ) : (
              <div className="section-sub">Carregando recibo...</div>
            )}
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>Motivo</div>
            <div style={{ fontSize: 13 }}>{corrida.motivo}</div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Dados extraídos (editável)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {CAMPOS.map((campo) => (
                <div key={campo.key} className="form-group">
                  <label className="form-label" style={{ fontSize: 11 }}>{campo.label}</label>
                  <input
                    className="form-input"
                    type={campo.type}
                    step={campo.type === "number" ? "any" : undefined}
                    value={form[campo.key]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [campo.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            {erro && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 8 }}>{erro}</div>}
            <div className="admin-modal-actions" style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button className="btn-ghost" onClick={onClose}>Cancelar</button>
              <button className="btn-primary" onClick={handleSalvar} disabled={atualizar.isPending}>
                {atualizar.isPending ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
