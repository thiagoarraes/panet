import { FileText, Images, MessageSquare, Plane, Settings, Users } from "lucide-react";
import { AdminColaboradores } from "./AdminColaboradores";
import { AdminPostagens } from "./AdminPostagens";
import { AdminFerias } from "./AdminFerias";
import { AdminMural } from "./AdminMural";
import { AdminGaleria } from "./AdminGaleria";

export function AdminPage({
  aba = "colaboradores",
  onChangeAba,
  postagens,
  setPostagens,
  ferias,
  dayoff,
  colaboradores,
  currentUserId,
  onCreatePost,
  onUpdatePost,
  onDeletePost,
  onListPostagens,
  onCreateFerias,
  onUpdateFerias,
  onDeleteFerias,
  onListFerias,
  muralMsgs,
  onDeleteMuralMensagem,
  onDeleteMuralMensagens,
  onListMural,
  galeriaEventos,
  onCreateGaleriaEvento,
  onUpdateGaleriaEvento,
  onDeleteGaleriaEvento,
  onListGaleria,
  onAddGaleriaFoto,
  onUpdateGaleriaFoto,
  onDeleteGaleriaFoto,
  onUploadGaleriaFotos,
  onSetGaleriaCapa,
}) {
  const ABAS = [
    { id: "colaboradores", label: "Colaboradores", icon: Users },
    { id: "postagens", label: "Postagens", icon: FileText },
    { id: "ferias", label: "Férias & Day Off", icon: Plane },
    { id: "galeria", label: "Galerias", icon: Images },
    { id: "mural", label: "PanZap", icon: MessageSquare },
  ];

  return (
    <div className="fade-up admin-page">
      <div className="section-header admin-header" style={{ marginBottom: 20 }}>
        <div>
          <div className="section-title" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Settings size={20} /> Painel Admin
          </div>
          <div className="section-sub">Gestão de conteúdo e colaboradores da Panet</div>
        </div>
      </div>
      <div className="filter-tabs admin-tabs" style={{ marginBottom: 24 }}>
        {ABAS.map((a) => (
          <button key={a.id} className={`filter-tab ${aba === a.id ? "active" : ""}`} onClick={() => onChangeAba?.(a.id)}>
            <a.icon size={14} style={{ marginRight: 6, verticalAlign: "text-bottom" }} /> {a.label}
          </button>
        ))}
      </div>
      {aba === "colaboradores" && <AdminColaboradores initialColaboradores={colaboradores} currentUserId={currentUserId} />}
      {aba === "postagens" && (
        <AdminPostagens
          postagens={postagens}
          setPostagens={setPostagens}
          onCreatePost={onCreatePost}
          onUpdatePost={onUpdatePost}
          onDeletePost={onDeletePost}
          onListPostagens={onListPostagens}
        />
      )}
      {aba === "ferias" && (
        <AdminFerias
          ferias={ferias}
          dayoff={dayoff}
          colaboradores={colaboradores}
          onCreateFerias={onCreateFerias}
          onUpdateFerias={onUpdateFerias}
          onDeleteFerias={onDeleteFerias}
          onListFerias={onListFerias}
        />
      )}
      {aba === "galeria" && (
        <AdminGaleria
          eventos={galeriaEventos}
          onCreateEvento={onCreateGaleriaEvento}
          onUpdateEvento={onUpdateGaleriaEvento}
          onDeleteEvento={onDeleteGaleriaEvento}
          onListGaleria={onListGaleria}
          onAddFoto={onAddGaleriaFoto}
          onUpdateFoto={onUpdateGaleriaFoto}
          onDeleteFoto={onDeleteGaleriaFoto}
          onUploadFotosEvento={onUploadGaleriaFotos}
          onSetCapaEvento={onSetGaleriaCapa}
        />
      )}
      {aba === "mural" && (
        <AdminMural
          mensagens={muralMsgs}
          onDeleteMensagem={onDeleteMuralMensagem}
          onDeleteMensagens={onDeleteMuralMensagens}
          onListMural={onListMural}
        />
      )}
    </div>
  );
}

