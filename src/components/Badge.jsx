export const Badge = ({ cat }) => {
  const map = { Notícia: "#3B8EEA", Comunicado: "#E8955A", Evento: "#7EC47A", Reconhecimento: "#F5A623" };
  return <span style={{ background: map[cat] || "#555", color: "#fff", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", flexShrink: 0 }}>{cat}</span>;
};

// ── CSS ───────────────────────────────────────────────────────────────────────
