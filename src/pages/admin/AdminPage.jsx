import { Suspense, lazy } from "react";
import { FileText, Images, MessageSquare, Plane, Settings, Users } from "lucide-react";

const AdminColaboradores = lazy(() => import("./AdminColaboradores").then((m) => ({ default: m.AdminColaboradores })));
const AdminPostagens = lazy(() => import("./AdminPostagens").then((m) => ({ default: m.AdminPostagens })));
const AdminFerias = lazy(() => import("./AdminFerias").then((m) => ({ default: m.AdminFerias })));
const AdminMural = lazy(() => import("./AdminMural").then((m) => ({ default: m.AdminMural })));
const AdminGaleria = lazy(() => import("./AdminGaleria").then((m) => ({ default: m.AdminGaleria })));

const AdminTabFallback = () => (
  <div className="card">
    <div className="card-body" style={{ padding: 20 }}>
      <div className="section-sub">Carregando módulo...</div>
    </div>
  </div>
);

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
      {aba === "colaboradores" && (
        <Suspense fallback={<AdminTabFallback />}>
          <AdminColaboradores initialColaboradores={colaboradores} currentUserId={currentUserId} />
        </Suspense>
      )}
      {aba === "postagens" && (
        <Suspense fallback={<AdminTabFallback />}>
          <AdminPostagens
            postagens={postagens}
            setPostagens={setPostagens}
            onCreatePost={onCreatePost}
            onUpdatePost={onUpdatePost}
            onDeletePost={onDeletePost}
            onListPostagens={onListPostagens}
          />
        </Suspense>
      )}
      {aba === "ferias" && (
        <Suspense fallback={<AdminTabFallback />}>
          <AdminFerias
            ferias={ferias}
            dayoff={dayoff}
            colaboradores={colaboradores}
            onCreateFerias={onCreateFerias}
            onUpdateFerias={onUpdateFerias}
            onDeleteFerias={onDeleteFerias}
            onListFerias={onListFerias}
          />
        </Suspense>
      )}
      {aba === "galeria" && (
        <Suspense fallback={<AdminTabFallback />}>
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
        </Suspense>
      )}
      {aba === "mural" && (
        <Suspense fallback={<AdminTabFallback />}>
          <AdminMural
            mensagens={muralMsgs}
            onDeleteMensagem={onDeleteMuralMensagem}
            onDeleteMensagens={onDeleteMuralMensagens}
            onListMural={onListMural}
          />
        </Suspense>
      )}
    </div>
  );
}
