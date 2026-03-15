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
  onCreatePost,
  onUpdatePost,
  onDeletePost,
  onCreateFerias,
  onUpdateFerias,
  onDeleteFerias,
  muralMsgs,
  onDeleteMuralMensagem,
  galeriaEventos,
  onCreateGaleriaEvento,
  onUpdateGaleriaEvento,
  onDeleteGaleriaEvento,
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
      <div className="section-header" style={{ marginBottom: 20 }}>
        <div>
          <div className="section-title" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Settings size={20} /> Painel Admin
          </div>
          <div className="section-sub">Gestão de conteúdo e colaboradores da Panet</div>
        </div>
        <div
          style={{
            background: "rgba(17,231,231,0.1)",
            border: "1px solid rgba(17,231,231,0.2)",
            borderRadius: 6,
            padding: "4px 12px",
            fontSize: 12,
            color: "var(--accent)",
            fontWeight: 600,
          }}
        >
          Administrador
        </div>
      </div>
      <div className="filter-tabs" style={{ marginBottom: 24 }}>
        {ABAS.map((a) => (
          <button key={a.id} className={`filter-tab ${aba === a.id ? "active" : ""}`} onClick={() => onChangeAba?.(a.id)}>
            <a.icon size={14} style={{ marginRight: 6, verticalAlign: "text-bottom" }} /> {a.label}
          </button>
        ))}
      </div>
      {aba === "colaboradores" && <AdminColaboradores />}
      {aba === "postagens" && (
        <AdminPostagens
          postagens={postagens}
          setPostagens={setPostagens}
          onCreatePost={onCreatePost}
          onUpdatePost={onUpdatePost}
          onDeletePost={onDeletePost}
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
        />
      )}
      {aba === "galeria" && (
        <AdminGaleria
          eventos={galeriaEventos}
          onCreateEvento={onCreateGaleriaEvento}
          onUpdateEvento={onUpdateGaleriaEvento}
          onDeleteEvento={onDeleteGaleriaEvento}
          onAddFoto={onAddGaleriaFoto}
          onUpdateFoto={onUpdateGaleriaFoto}
          onDeleteFoto={onDeleteGaleriaFoto}
          onUploadFotosEvento={onUploadGaleriaFotos}
          onSetCapaEvento={onSetGaleriaCapa}
        />
      )}
      {aba === "mural" && <AdminMural mensagens={muralMsgs} onDeleteMensagem={onDeleteMuralMensagem} />}
    </div>
  );
}
