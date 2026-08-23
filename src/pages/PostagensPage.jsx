import { useEffect, useState } from "react";
import { PostCard } from "../components/PostCard";
import { SkeletonPostCard } from "../components/Skeleton";
import { usePostagens } from "../hooks/queries/usePostagens";
import { useToggleCurtida } from "../hooks/mutations/usePostMutations";

export function PostagensPage({ onOpen, currentUserId }) {
  const toggleCurtida = useToggleCurtida();
  const [filtro, setFiltro] = useState("Todos");
  const [buscaInput, setBuscaInput] = useState("");
  const [busca, setBusca] = useState("");
  const cats = ["Todos", "Notícia", "Comunicado", "Evento", "Reconhecimento"];
  const categoriaSelecionada = filtro === "Todos" ? "" : filtro;

  useEffect(() => {
    const timer = setTimeout(() => setBusca(buscaInput.trim()), 250);
    return () => clearTimeout(timer);
  }, [buscaInput]);

  const postagensQuery = usePostagens(currentUserId, {
    category: categoriaSelecionada,
    search: busca,
  });
  const filtradas = postagensQuery.data || [];

  const handleToggleCurtida = (post) => {
    toggleCurtida.mutate({
      postId: post.id,
      userId: currentUserId,
      alreadyLiked: post.userCurtiu,
    });
  };

  return (
    <div className="fade-up postagens-page">
      {postagensQuery.isError && (
        <div className="pan-card" style={{ marginBottom: 14 }}>
          <div className="card-body">
            <div className="section-title" style={{ fontSize: 16 }}>Falha ao carregar PanNews</div>
            <div className="section-sub">{postagensQuery.error?.message || "Não foi possível carregar as postagens agora."}</div>
          </div>
        </div>
      )}
      <div className="section-header">
        <div>
          <div className="section-title">PanNews</div>
          <div className="section-sub">{filtradas.length} {filtradas.length === 1 ? "publicação" : "publicações"}</div>
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
          value={buscaInput}
          onChange={(e) => setBuscaInput(e.target.value)}
          style={{ width: 200 }}
        />
      </div>
      {postagensQuery.isLoading && filtradas.length === 0 ? (
        <div className="grid-3">
          {Array.from({ length: 6 }, (_, i) => <SkeletonPostCard key={i} />)}
        </div>
      ) : (
        <div className="grid-3 stagger">
          {filtradas.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onOpen={onOpen}
              curtido={post.userCurtiu}
              onToggleCurtida={() => handleToggleCurtida(post)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

