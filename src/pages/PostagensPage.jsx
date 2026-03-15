import { useState } from "react";
import { PostCard } from "../components/PostCard";

export function PostagensPage({ onOpen, onToggleCurtida, postagens }) {
  const [filtro, setFiltro] = useState("Todos");
  const [busca, setBusca] = useState("");
  const cats = ["Todos", "Notícia", "Comunicado", "Evento"];
  const filtradas = postagens.filter(
    (p) =>
      (filtro === "Todos" || p.categoria === filtro) &&
      (busca === "" || p.titulo.toLowerCase().includes(busca.toLowerCase()))
  );

  return (
    <div className="fade-up postagens-page">
      <div className="section-header">
        <div>
          <div className="section-title">Postagens</div>
          <div className="section-sub">{postagens.length} publicações</div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <div className="filter-tabs">
          {cats.map((c) => (
            <button
              key={c}
              className={`filter-tab ${filtro === c ? "active" : ""}`}
              onClick={() => setFiltro(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <input
          className="search-input"
          placeholder="Buscar postagem..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ width: 200 }}
        />
      </div>
      <div className="grid-3 stagger">
        {filtradas.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onOpen={onOpen}
            curtido={post.userCurtiu}
            onToggleCurtida={() => onToggleCurtida(post.id)}
          />
        ))}
      </div>
    </div>
  );
}
