import { CircleStop, Pencil, Trash2 } from "lucide-react";
import { formatEnqueteDateTime } from "../../../lib/enquetes.js";
import { PanTooltip } from "../../../components/ui/PanTooltip";

const toTotalVotesLabel = (totalVotes) => {
  const n = Number(totalVotes || 0);
  return n === 1 ? "1 voto" : `${n} votos`;
};

export function EnqueteCard({ row, pendingEndIds, pendingDeleteIds, onEditar, onConfirmEnd, onConfirmDelete }) {
  return (
    <div className="pan-card admin-enquete-card" style={{ padding: 16 }}>
      <div className="admin-enquete-head">
        <div className="admin-enquete-main">
          <div className="admin-enquete-title-row">
            <div className="admin-enquete-title">{row.question}</div>
            <span className={`status-chip ${row.status === "ativa" ? "status-andamento" : "status-marcado"}`}>
              {row.status === "ativa" ? "Ativa" : "Encerrada"}
            </span>
          </div>
          <div className="admin-enquete-meta">
            <span>{row.options.length} opções</span>
            <span>{toTotalVotesLabel(row.totalVotes)}</span>
            <span>Resultado parcial: {row.showPartial ? "sim" : "nao"}</span>
            {row.endsAt ? <span>Encerra em {formatEnqueteDateTime(row.endsAt)}</span> : null}
          </div>
        </div>
        <div className="admin-enquete-actions">
          <PanTooltip texto="Editar">
            <button
              className="admin-action-icon"
              type="button"
              onClick={() => onEditar(row)}
              aria-label="Editar enquete"
            >
              <Pencil />
            </button>
          </PanTooltip>
          {row.status === "ativa" ? (
            <PanTooltip texto={pendingEndIds.has(row.id) ? "Encerrando..." : "Encerrar agora"}>
              <button
                className="admin-action-icon"
                type="button"
                onClick={() => onConfirmEnd(row)}
                disabled={pendingEndIds.has(row.id)}
                aria-label="Encerrar agora"
              >
                <CircleStop />
              </button>
            </PanTooltip>
          ) : null}
          <PanTooltip texto={pendingDeleteIds.has(row.id) ? "Excluindo..." : "Excluir"}>
            <button
              className="admin-action-icon is-danger"
              type="button"
              onClick={() => onConfirmDelete(row)}
              disabled={pendingDeleteIds.has(row.id)}
              aria-label="Excluir enquete"
            >
              <Trash2 />
            </button>
          </PanTooltip>
        </div>
      </div>

      <div className="admin-enquete-options">
        {row.options.map((option) => (
          <div key={option.id} className="admin-enquete-option-row">
            <div className="admin-enquete-option-info">
              <span className="admin-enquete-option-text">{option.text}</span>
              <span className="admin-enquete-option-votes">{option.percent}%</span>
            </div>
            <div className="admin-enquete-option-track">
              <span className="admin-enquete-option-fill" style={{ width: `${option.percent}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
