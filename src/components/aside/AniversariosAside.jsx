import { Cake } from "lucide-react";
import { Avatar } from "../Avatar";
import { SkeletonAnivItem } from "../Skeleton";

export function AniversariosAside({ proximos, isLoading, onVerTodos, formatDiasRestantes }) {
  return (
    <div className="pan-card">
      <div className="card-header">
        <span className="card-title" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Cake size={14} /> Próximos aniversariantes
        </span>
      </div>
      <div className="card-body" style={{ padding: "8px 16px" }}>
        {proximos.length === 0 && isLoading
          ? Array.from({ length: 4 }, (_, i) => <SkeletonAnivItem key={i} />)
          : proximos.map((a) => (
          <div key={a.colaborador.id} className="aniv-item">
            <div className="aniv-date">
              <div className="aniv-day">{a.data.split("/")[0]}</div>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>/ {a.data.split("/")[1]}</div>
            </div>
            <Avatar col={a.colaborador} size={36} />
            <div className="aniv-info">
              <div className="aniv-name">{a.colaborador.nome.split(" ")[0]}</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>{formatDiasRestantes(a.diasRestantes)}</div>
            </div>
          </div>
        ))}
        <button className="btn-aniversarios-ver-todos" onClick={onVerTodos}>
          Ver todos
        </button>
      </div>
    </div>
  );
}
