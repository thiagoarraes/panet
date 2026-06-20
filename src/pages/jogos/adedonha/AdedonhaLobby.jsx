import { useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { useJogoSalas } from "../../../hooks/queries/useJogoSalas.js";
import { EntrarSalaModal } from "./EntrarSalaModal.jsx";
import { AvatarStack } from "./AvatarStack.jsx";

// Lobby da adedonha: lista salas abertas ("Sala criada por <nome>") + criar.
export function AdedonhaLobby({ currentUser, onCriar, onEntrar, onVoltar }) {
  const { data: salas = [], isLoading } = useJogoSalas({ jogo: "adedonha" });
  const [modal, setModal] = useState(null); // { tipo: 'criar' } | { tipo: 'entrar', sala }

  const fecharModal = () => setModal(null);

  const confirmar = async ({ apelido, anonimo }) => {
    if (modal?.tipo === "criar") {
      await onCriar({ apelido, anonimo });
    } else if (modal?.tipo === "entrar") {
      await onEntrar({ sala: modal.sala, apelido, anonimo });
    }
    fecharModal();
  };

  return (
    <div className="fade-up ade-wrap">
      <div className="ade-topbar">
        <div>
          <button className="btn-ghost" onClick={onVoltar} style={{ marginBottom: 8 }}>
            <ArrowLeft size={16} /> Jogos
          </button>
          <h1 className="section-title">Adedonha</h1>
          <p className="section-sub">Entre numa sala aberta ou crie a sua.</p>
        </div>
        <button className="btn-primary" onClick={() => setModal({ tipo: "criar" })}>
          <Plus size={16} /> Criar sala
        </button>
      </div>

      <div className="card ade-salas-card">
        <div className="card-body" style={{ padding: 18 }}>
          {isLoading ? (
            <div className="section-sub">Carregando salas...</div>
          ) : salas.length === 0 ? (
            <div className="ade-empty">
              <span className="ade-empty-emoji" aria-hidden="true">🎲</span>
              <strong>Nenhuma sala aberta</strong>
              <span>Crie a primeira e chame a galera!</span>
            </div>
          ) : (
            salas.map((sala) => (
              <div key={sala.id} className="ade-sala-item">
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>Sala criada por {sala.hostNome || "colaborador"}</div>
                </div>
                <span className={`badge ${sala.status === "jogando" ? "jogando" : ""}`}>
                  {sala.status === "jogando" ? "Em jogo" : "Aguardando"}
                </span>
                <AvatarStack jogadores={sala.jogadores} />
                <button
                  className="btn-primary"
                  onClick={() => setModal({ tipo: "entrar", sala })}
                >
                  Entrar
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {modal && (
        <EntrarSalaModal
          titulo={modal.tipo === "criar" ? "Criar sala" : `Entrar — ${modal.sala.nome}`}
          nomePadrao={currentUser?.nome}
          confirmLabel={modal.tipo === "criar" ? "Criar" : "Entrar"}
          onConfirmar={confirmar}
          onCancelar={fecharModal}
        />
      )}
    </div>
  );
}
