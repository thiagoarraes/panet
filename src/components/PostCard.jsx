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
        <div className="post-card-head">
          <div className="post-card-datebox">
            <div className="post-card-date-day">{dateBox.day}</div>
            <div className="post-card-date-month">{dateBox.month}</div>
            <div className="post-card-date-year">{dateBox.year}</div>
          </div>
          <div className="post-card-head-content">
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

