import { useMemo, useState } from "react";
import { Heart, MessageCircle, Send, X } from "lucide-react";
import { Avatar } from "./Avatar";
import { Badge } from "./Badge";

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

const formatCountLabel = (count, singular, plural) => `${count} ${count === 1 ? singular : plural}`;

export function PostModal({ post, currentUser, onClose, onToggleCurtida, onComentar }) {
  const [texto, setTexto] = useState("");
  const [loadingComentario, setLoadingComentario] = useState(false);
  const eu = useMemo(() => currentUser || { nome: "Você", foto: "U", cor: "#11E7E7" }, [currentUser]);
  const dateBox = useMemo(() => getDateBoxParts(post.data), [post.data]);

  const comentar = async () => {
    if (!texto.trim()) return;
    try {
      setLoadingComentario(true);
      await onComentar(post.id, texto.trim());
      setTexto("");
    } finally {
      setLoadingComentario(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ alignItems: "center", justifyItems: "center" }} onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ width: "100%", aspectRatio: "2 / 1", overflow: "hidden", borderRadius: "16px 16px 0 0" }}>
          <img src={post.imagem} alt={post.titulo} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "stretch", gap: 12, flex: 1 }}>
            <div
              style={{
                width: 74,
                minWidth: 74,
                borderRadius: 12,
                background: "linear-gradient(180deg, color-mix(in srgb, var(--accent) 84%, #fff), var(--accent2))",
                color: "#ffffff",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "8px 6px",
                boxShadow: "0 8px 18px color-mix(in srgb, var(--accent) 32%, transparent)",
              }}
            >
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 24, lineHeight: 1 }}>{dateBox.day}</div>
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: 0.7, marginTop: 2 }}>{dateBox.month}</div>
              <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.95, marginTop: 2 }}>{dateBox.year}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <Badge cat={post.categoria} />
              </div>
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 18, lineHeight: 1.35 }}>{post.titulo}</div>
            </div>
          </div>
          <button className="modal-close post-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <div className="rich-content" style={{ marginBottom: 20 }} dangerouslySetInnerHTML={{ __html: post.descricao || "" }} />
          <div style={{ display: "flex", gap: 12, padding: "12px 0", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", marginBottom: 16 }}>
            <button className={`post-action ${post.userCurtiu ? "liked" : ""}`} onClick={() => onToggleCurtida(post.id)}>
              <Heart size={14} fill={post.userCurtiu ? "currentColor" : "none"} />{" "}
              {formatCountLabel(post.curtidas.length, "curtida", "curtidas")}
            </button>
            <button className="post-action">
              <MessageCircle size={14} /> {formatCountLabel(post.comentarios.length, "comentário", "comentários")}
            </button>
          </div>
          <div style={{ marginBottom: 16 }}>
            {post.comentarios.map((c) => (
              <div key={c.id} className="comment">
                <Avatar col={c.autor} size={32} />
                <div className="comment-body">
                  <div className="comment-head">
                    <div className="comment-author">{c.autor.nome}</div>
                    <div className="comment-time">{c.hora}</div>
                  </div>
                  <div className="comment-text">{c.texto}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mural-input">
            <Avatar col={eu} size={32} />
            <input
              className="input-field"
              placeholder="Escreva um comentário..."
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && comentar()}
            />
            <button className="btn-primary" onClick={comentar} disabled={loadingComentario}>
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
