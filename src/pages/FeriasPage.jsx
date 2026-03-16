import { CalendarDays, Plane } from "lucide-react";
import { Avatar } from "../components/Avatar";

const parseBrDate = (brDate) => {
  const [day, month, year] = String(brDate || "").split("/").map(Number);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day, 12, 0, 0);
};

const getFeriasStatusByDate = (item) => {
  if (!item) return "marcado";
  if (item.status === "em_andamento") return "em_andamento";
  const inicioDate = parseBrDate(item.inicio);
  const fimDate = parseBrDate(item.fim || item.inicio);
  if (!inicioDate || !fimDate) return item.status || "marcado";
  const now = new Date();
  const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  return todayNoon >= inicioDate && todayNoon <= fimDate ? "em_andamento" : (item.status || "marcado");
};

const getFolgaTotalDias = (item) => {
  const inicioDate = parseBrDate(item?.inicio);
  const fimDate = parseBrDate(item?.fim || item?.inicio);
  if (!inicioDate || !fimDate) return null;
  const diffMs = fimDate.getTime() - inicioDate.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return Number.isFinite(days) && days > 0 ? days : null;
};

const getPeriodoFolgaLabel = (item) => {
  const inicio = item?.inicio || "";
  const fim = item?.fim || item?.inicio || "";
  const toDayMonth = (brDate) => {
    const [day, month] = String(brDate || "").split("/");
    if (!day || !month) return String(brDate || "");
    return `${day}/${month}`;
  };
  if (!inicio) return "";
  if (!fim || inicio === fim) return toDayMonth(inicio);
  return `${toDayMonth(inicio)} a ${toDayMonth(fim)}`;
};

export function FeriasPage({ ferias, dayoff }) {
  return (
    <div className="fade-up">
      <div className="section-title" style={{ marginBottom: 20, display: "inline-flex", alignItems: "center", gap: 8 }}>
        <Plane size={22} /> Férias & Day Off
      </div>
      <div className="grid-2">
        <div>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, marginBottom: 12, fontSize: 15 }}>Férias</div>
          <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ferias.map((f, i) => {
              const totalDias = getFolgaTotalDias(f);
              return (
              <div key={i} className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar col={f.colaborador} size={44} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{f.colaborador.nome}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{f.colaborador.cargo}</div>
                    <div style={{ fontSize: 12, marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <CalendarDays size={12} /> {getPeriodoFolgaLabel(f)}
                      {totalDias ? ` · ${totalDias} ${totalDias === 1 ? "dia" : "dias"}` : ""}
                    </div>
                  </div>
                  <span className={`status-chip ${getFeriasStatusByDate(f) === "em_andamento" ? "status-andamento" : "status-marcado"}`}>
                    {getFeriasStatusByDate(f) === "em_andamento" ? "De férias" : "Agendado"}
                  </span>
                </div>
              </div>
              );
            })}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, marginBottom: 12, fontSize: 15 }}>Day Off</div>
          <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {dayoff.map((d, i) => {
              const totalDias = getFolgaTotalDias(d);
              return (
              <div key={i} className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar col={d.colaborador} size={44} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{d.colaborador.nome}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{d.colaborador.cargo}</div>
                    <div style={{ fontSize: 12, marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <CalendarDays size={12} /> {getPeriodoFolgaLabel(d)}
                    </div>
                    {totalDias && (
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                        {totalDias} {totalDias === 1 ? "dia de day off" : "dias de day off"}
                      </div>
                    )}
                  </div>
                  <span className="status-chip" style={{ background: "rgba(232,75,122,0.15)", color: "#E84B7A" }}>Day Off</span>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
