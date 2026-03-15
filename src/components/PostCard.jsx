import { Badge } from "./Badge";
import { Heart, MessageCircle, ArrowRight } from "lucide-react";

const stripHtml = (html) =>
  String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const getDateBoxParts = (iso) => {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return { day: "--", month: "---", year: "----" };
  const day = String(date.getDate()).padStart(2, "0");
  const month = date
    .toLocaleDateString("pt-BR", { month: "short" })
    .replace(".", "")
    .slice(0, 3)
    .toUpperCase();
  const year = String(date.getFullYear());
  return { day, month, year };
};

export function PostCard({ post, onOpen, curtido, onToggleCurtida, showVerMais = false }) {
  const dateBox = getDateBoxParts(post.data);

  return (
    <div className="post-card">
      <div className="post-thumb">
        <img src={post.imagem} alt={post.titulo} />
      </div>
      <div className="post-body">
        <div style={{ display: "flex", alignItems: "stretch", gap: 10, marginBottom: 8 }}>
          <div
            style={{
              width: 56,
              minWidth: 56,
              borderRadius: 10,
              background: "linear-gradient(180deg, color-mix(in srgb, var(--accent) 84%, #fff), var(--accent2))",
              color: "#ffffff",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "6px 4px",
              boxShadow: "0 6px 14px color-mix(in srgb, var(--accent) 28%, transparent)",
            }}
          >
            <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 19, lineHeight: 1 }}>{dateBox.day}</div>
            <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 9, letterSpacing: 0.6, marginTop: 2 }}>{dateBox.month}</div>
            <div style={{ fontSize: 9, fontWeight: 600, opacity: 0.95, marginTop: 1 }}>{dateBox.year}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0, flex: 1 }}>
            <div className="post-meta" style={{ marginBottom: 4 }}>
              <Badge cat={post.categoria} />
            </div>
            <div className="post-title" onClick={() => onOpen(post)} style={{ marginBottom: 0 }}>
              {post.titulo}
            </div>
          </div>
        </div>
        <div className="post-desc">{stripHtml(post.descricao)}</div>
      </div>
      <div className="post-footer">
        <button className={`post-action ${curtido ? "liked" : ""}`} onClick={onToggleCurtida}>
          <Heart size={14} fill={curtido ? "currentColor" : "none"} /> {post.curtidas.length}
        </button>
        <button className="post-action" onClick={() => onOpen(post)}>
          <MessageCircle size={14} /> {post.comentarios.length}
        </button>
        {showVerMais && (
          <button className="post-action" onClick={() => onOpen(post)} style={{ marginLeft: "auto" }}>
            Ver mais <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

