import { Suspense, lazy, useEffect } from "react";
import { CalendarDays, FileText, Images, MessageSquare, Plane, Settings, Users } from "lucide-react";

const AdminColaboradores = lazy(() => import("./AdminColaboradores").then((m) => ({ default: m.AdminColaboradores })));
const AdminPostagens = lazy(() => import("./AdminPostagens").then((m) => ({ default: m.AdminPostagens })));
const AdminFerias = lazy(() => import("./AdminFerias").then((m) => ({ default: m.AdminFerias })));
const AdminMural = lazy(() => import("./AdminMural").then((m) => ({ default: m.AdminMural })));
const AdminGaleria = lazy(() => import("./AdminGaleria").then((m) => ({ default: m.AdminGaleria })));
const AdminPresencial = lazy(() => import("./AdminPresencial").then((m) => ({ default: m.AdminPresencial })));

const AdminTabFallback = () => (
  <div className="card">
    <div className="card-body" style={{ padding: 20 }}>
      <div className="section-sub">Carregando módulo...</div>
    </div>
  </div>
);

const ALL_ABAS = [
  { id: "colaboradores", label: "Colaboradores", icon: Users },
  { id: "postagens", label: "PanNews", icon: FileText },
  { id: "ferias", label: "PanOff", icon: Plane },
  { id: "presencial", label: "Confirmar presença", icon: CalendarDays },
  { id: "galeria", label: "Galerias", icon: Images },
  { id: "mural", label: "PanZap", icon: MessageSquare },
];

export function AdminPage({
  aba = "colaboradores",
  onChangeAba,
  currentProfile,
  postagens,
  setPostagens,
  ferias,
  dayoff,
  colaboradores,
  currentUserId,
  onDeleteColaborador,
  onCreatePost,
  onUpdatePost,
  onDeletePost,
  onListPostagens,
  onCreateFerias,
  onUpdateFerias,
  onDeleteFerias,
  onListFerias,
  ausencias,
  onCreateAusencia,
  onUpdateAusencia,
  onDeleteAusencia,
  onListAusencias,
  presencialAgendas,
  onCreatePresencialAgenda,
  onUpdatePresencialAgenda,
  onDeletePresencialAgenda,
  onListPresencial,
  onRunPresencialSecretSanta,
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
  // null = super admin (acesso total); array = módulos permitidos
  const adminModulos = currentProfile?.admin_modulos ?? null;
  const isSuperAdmin = adminModulos === null;

  const ABAS = isSuperAdmin
    ? ALL_ABAS
    : ALL_ABAS.filter((a) => (adminModulos || []).includes(a.id));

  // Redireciona para a primeira aba acessível se a atual não estiver disponível
  useEffect(() => {
    if (ABAS.length > 0 && !ABAS.find((a) => a.id === aba)) {
      onChangeAba?.(ABAS[0].id);
    }
  }, [ABAS, aba, onChangeAba]);

  const abaAtiva = ABAS.find((a) => a.id === aba) ? aba : (ABAS[0]?.id || aba);

  return (
    <div className="fade-up admin-page">
      <div className="section-header admin-header" style={{ marginBottom: 20 }}>
        <div>
          <div className="section-title" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Settings size={20} /> Painel Administrativo
          </div>
          <div className="section-sub">Gestão de conteúdo e colaboradores da Panet</div>
        </div>
      </div>
      <div className="filter-tabs admin-tabs" style={{ marginBottom: 24 }}>
        {ABAS.map((a) => (
          <button key={a.id} className={`filter-tab ${abaAtiva === a.id ? "active" : ""}`} onClick={() => onChangeAba?.(a.id)}>
            <a.icon size={14} style={{ marginRight: 6, verticalAlign: "text-bottom" }} /> {a.label}
          </button>
        ))}
      </div>
      {abaAtiva === "colaboradores" && (
        <Suspense fallback={<AdminTabFallback />}>
          <AdminColaboradores
            initialColaboradores={colaboradores}
            currentUserId={currentUserId}
            isSuperAdmin={isSuperAdmin}
            onDeleteColaborador={onDeleteColaborador}
          />
        </Suspense>
      )}
      {abaAtiva === "postagens" && (
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
      {abaAtiva === "ferias" && (
        <Suspense fallback={<AdminTabFallback />}>
          <AdminFerias
            ferias={ferias}
            dayoff={dayoff}
            colaboradores={colaboradores}
            onCreateFerias={onCreateFerias}
            onUpdateFerias={onUpdateFerias}
            onDeleteFerias={onDeleteFerias}
            onListFerias={onListFerias}
            ausencias={ausencias}
            onCreateAusencia={onCreateAusencia}
            onUpdateAusencia={onUpdateAusencia}
            onDeleteAusencia={onDeleteAusencia}
            onListAusencias={onListAusencias}
          />
        </Suspense>
      )}
      {abaAtiva === "galeria" && (
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
      {abaAtiva === "presencial" && (
        <Suspense fallback={<AdminTabFallback />}>
          <AdminPresencial
            agendas={presencialAgendas}
            onCreateAgenda={onCreatePresencialAgenda}
            onUpdateAgenda={onUpdatePresencialAgenda}
            onDeleteAgenda={onDeletePresencialAgenda}
            onListPresencial={onListPresencial}
            onRunSecretSanta={onRunPresencialSecretSanta}
          />
        </Suspense>
      )}
      {abaAtiva === "mural" && (
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
