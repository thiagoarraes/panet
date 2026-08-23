import { Suspense, lazy, useEffect } from "react";
import { BarChart3, CalendarDays, Car, FileText, Images, KeyRound, Plane, Settings, Users } from "lucide-react";

const AdminColaboradores = lazy(() => import("./AdminColaboradores").then((m) => ({ default: m.AdminColaboradores })));
const AdminPostagens = lazy(() => import("./AdminPostagens").then((m) => ({ default: m.AdminPostagens })));
const AdminFerias = lazy(() => import("./AdminFerias").then((m) => ({ default: m.AdminFerias })));
const AdminGaleria = lazy(() => import("./AdminGaleria").then((m) => ({ default: m.AdminGaleria })));
const AdminPresencial = lazy(() => import("./AdminPresencial").then((m) => ({ default: m.AdminPresencial })));
const AdminEnquetes = lazy(() => import("./AdminEnquetes").then((m) => ({ default: m.AdminEnquetes })));
const AdminCorridas = lazy(() => import("./AdminCorridas").then((m) => ({ default: m.AdminCorridas })));
const AdminPanPass = lazy(() => import("./AdminPanPass").then((m) => ({ default: m.AdminPanPass })));

const AdminTabFallback = () => (
  <div className="pan-card">
    <div className="card-body" style={{ padding: 20 }}>
      <div className="section-sub">Carregando módulo...</div>
    </div>
  </div>
);

const ALL_ABAS = [
  { id: "postagens", label: "PanNews", icon: FileText },
  { id: "colaboradores", label: "Colaboradores", icon: Users },
  { id: "ferias", label: "PanOff", icon: Plane },
  { id: "presencial", label: "Eventos", icon: CalendarDays },
  { id: "enquetes", label: "Enquetes", icon: BarChart3 },
  { id: "galeria", label: "Galerias", icon: Images },
  { id: "corridas", label: "PanUber", icon: Car },
  { id: "panpass", label: "PanPass", icon: KeyRound },
];

export function AdminPage({
  aba = "postagens",
  onChangeAba,
  currentProfile,
  currentUserId,
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
      {/*
        Semantica de abas no markup proprio, em vez do Tabs do HeroUI: o
        visual e o roteamento (abaAtiva vive no AuthContext e alimenta a URL)
        ja funcionam, e trocar o componente exigiria sobrescrever todo o
        estilo do HeroUI sem ganho alem do que estes atributos dao.
        Setas/Home/End navegam entre as abas, como manda o padrao WAI-ARIA.
      */}
      <div
        className="filter-tabs admin-tabs"
        style={{ marginBottom: 24 }}
        role="tablist"
        aria-label="Seções do painel administrativo"
        onKeyDown={(e) => {
          const passo = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
          if (!passo && e.key !== "Home" && e.key !== "End") return;
          e.preventDefault();
          const i = ABAS.findIndex((a) => a.id === abaAtiva);
          const proximo =
            e.key === "Home" ? 0
            : e.key === "End" ? ABAS.length - 1
            : (i + passo + ABAS.length) % ABAS.length;
          onChangeAba?.(ABAS[proximo].id);
        }}
      >
        {ABAS.map((a) => (
          <button
            key={a.id}
            id={`admin-aba-${a.id}`}
            role="tab"
            aria-selected={abaAtiva === a.id}
            aria-controls={`admin-painel-${a.id}`}
            tabIndex={abaAtiva === a.id ? 0 : -1}
            className={`filter-tab ${abaAtiva === a.id ? "active" : ""}`}
            onClick={() => onChangeAba?.(a.id)}
          >
            <a.icon size={14} style={{ marginRight: 6, verticalAlign: "text-bottom" }} /> {a.label}
          </button>
        ))}
      </div>
      {/* Um unico tabpanel: so uma aba renderiza por vez, entao o id e o
          aria-labelledby acompanham a aba ativa. */}
      <div
        role="tabpanel"
        id={`admin-painel-${abaAtiva}`}
        aria-labelledby={`admin-aba-${abaAtiva}`}
        tabIndex={0}
      >
      {abaAtiva === "colaboradores" && (
        <Suspense fallback={<AdminTabFallback />}>
          <AdminColaboradores
            currentUserId={currentUserId}
            isSuperAdmin={isSuperAdmin}
          />
        </Suspense>
      )}
      {abaAtiva === "postagens" && (
        <Suspense fallback={<AdminTabFallback />}>
          <AdminPostagens currentUserId={currentUserId} />
        </Suspense>
      )}
      {abaAtiva === "ferias" && (
        <Suspense fallback={<AdminTabFallback />}>
          <AdminFerias currentUserId={currentUserId} />
        </Suspense>
      )}
      {abaAtiva === "galeria" && (
        <Suspense fallback={<AdminTabFallback />}>
          <AdminGaleria />
        </Suspense>
      )}
      {abaAtiva === "presencial" && (
        <Suspense fallback={<AdminTabFallback />}>
          <AdminPresencial currentUserId={currentUserId} />
        </Suspense>
      )}
      {abaAtiva === "enquetes" && (
        <Suspense fallback={<AdminTabFallback />}>
          <AdminEnquetes currentUserId={currentUserId} />
        </Suspense>
      )}
      {abaAtiva === "corridas" && (
        <Suspense fallback={<AdminTabFallback />}>
          <AdminCorridas currentUserId={currentUserId} />
        </Suspense>
      )}
      {abaAtiva === "panpass" && (
        <Suspense fallback={<AdminTabFallback />}>
          <AdminPanPass currentUserId={currentUserId} />
        </Suspense>
      )}
      </div>
    </div>
  );
}
