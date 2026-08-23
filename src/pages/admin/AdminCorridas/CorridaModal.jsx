import { useEffect, useState } from "react";
import { AlertTriangle, CarFront, Clock3, FileText, Gauge, Loader2, MapPin, Route, UserRound, Wallet } from "lucide-react";
import { Avatar } from "../../../components/Avatar";
import { supabase, isSupabaseEnabled } from "../../../lib/supabase.js";

const formatBrl = (v) => (typeof v === "number" ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—");
const formatDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" }) : "—";
const formatCreatedAt = (iso) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

const FATOS = [
  { key: "duracao_min", label: "Duração", Icon: Clock3, render: (v) => (typeof v === "number" ? `${v} min` : "—") },
  { key: "km", label: "Distância", Icon: Gauge, render: (v) => (typeof v === "number" ? `${v} km` : "—") },
  { key: "veiculo", label: "Veículo", Icon: CarFront, render: (v) => v || "—" },
  { key: "motorista", label: "Motorista", Icon: UserRound, render: (v) => v || "—" },
];

export function CorridaModal({ corrida, cliente = null, onDefinirCliente = null, onClose }) {
  const [reciboUrl, setReciboUrl] = useState("");
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

  return (
    <div className="modal-overlay" style={{ alignItems: "center", justifyItems: "center" }} onClick={onClose}>
      <div className="pan-modal collab-modal corrida-modal" onClick={(e) => e.stopPropagation()}>
        {/* ── Cabeçalho: quem + valor ─────────────────────────────────────── */}
        <div className="corrida-modal-hero">
          <button className="modal-close corrida-modal-close" onClick={onClose} aria-label="Fechar">×</button>
          <div className="corrida-modal-quem">
            <Avatar col={corrida.colaborador} size={46} />
            <div>
              <div className="corrida-modal-nome">{corrida.colaborador?.nome}</div>
              <div className="corrida-modal-cargo">{corrida.colaborador?.cargo || "—"}</div>
            </div>
          </div>
          <div className="corrida-modal-valor-bloco">
            <span className="corrida-modal-valor-label"><Wallet size={12} /> Valor da corrida</span>
            <span className="corrida-modal-valor">{formatBrl(corrida.valor_total)}</span>
            {corrida.status_extracao === "pendente" && (
              <span className="corrida-status is-pendente"><Loader2 size={11} className="spin" /> Processando extração</span>
            )}
            {corrida.status_extracao === "erro" && (
              <span className="corrida-status is-erro"><AlertTriangle size={11} /> Erro na leitura do recibo</span>
            )}
          </div>
        </div>

        <div className="modal-body corrida-modal-body">
          {/* ── Trajeto ───────────────────────────────────────────────────── */}
          <div className="corrida-modal-secao">
            <div className="corrida-modal-secao-titulo"><Route size={13} /> Trajeto</div>
            <div className="corrida-rota corrida-modal-rota">
              <span className="corrida-rota-linha" aria-hidden="true">
                <i className="dot-origem" />
                <i className="tracado" />
                <i className="dot-destino" />
              </span>
              <div className="corrida-rota-textos">
                <div>
                  <div className="corrida-modal-rota-label">Origem</div>
                  <div className="corrida-modal-rota-endereco">{corrida.origem || "Não identificada"}</div>
                </div>
                <div>
                  <div className="corrida-modal-rota-label">Destino{cliente ? ` · Cliente` : ""}</div>
                  <div className="corrida-modal-rota-endereco is-destino">{corrida.destino || "Não identificado"}</div>
                  {cliente ? (
                    <span className="corrida-cliente-badge" style={{ marginTop: 4 }}>{cliente}</span>
                  ) : (
                    corrida.destino && onDefinirCliente && (
                      <button type="button" className="corrida-cliente-definir" style={{ marginTop: 4 }} onClick={onDefinirCliente}>
                        <MapPin size={11} /> Definir cliente para este destino
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
            <div className="corrida-modal-horario"><Clock3 size={12} /> {formatDateTime(corrida.horario)}</div>
          </div>

          {/* ── Fatos da viagem ───────────────────────────────────────────── */}
          <div className="corrida-modal-fatos">
            {FATOS.map(({ key, label, Icon, render }) => (
              <div key={key} className="corrida-modal-fato">
                <span className="corrida-modal-fato-icone"><Icon size={14} /></span>
                <div>
                  <div className="corrida-modal-fato-valor">{render(corrida[key])}</div>
                  <div className="corrida-modal-fato-label">{label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Motivo ────────────────────────────────────────────────────── */}
          <div className="corrida-modal-secao">
            <div className="corrida-modal-secao-titulo">Motivo informado</div>
            <div className="corrida-modal-motivo">{corrida.motivo}</div>
            <div className="corrida-modal-enviada">Enviada em {formatCreatedAt(corrida.created_at)}</div>
          </div>

          {/* ── Recibo ────────────────────────────────────────────────────── */}
          <div className="corrida-modal-secao">
            <div className="corrida-modal-secao-titulo"><FileText size={13} /> Recibo</div>
            {reciboUrl ? (
              isPdf ? (
                <a href={reciboUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost corrida-modal-pdf">
                  <FileText size={14} /> Abrir PDF do recibo
                </a>
              ) : (
                <a href={reciboUrl} target="_blank" rel="noopener noreferrer" className="corrida-modal-recibo-link">
                  <img src={reciboUrl} alt="Recibo da corrida" className="corrida-modal-recibo" />
                </a>
              )
            ) : (
              <div className="section-sub">Carregando recibo...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
