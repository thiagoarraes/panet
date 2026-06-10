import { Suspense, lazy } from "react";
import { Menu, X } from "lucide-react";
import { AuthProvider, useAuth } from "../context/AuthContext.jsx";
import { AppShellSkeleton } from "./AppShellSkeleton.jsx";
import { Sidebar } from "./Sidebar.jsx";
import { LoginPage } from "../pages/LoginPage";
import { PrimeiroAcessoPage } from "../pages/PrimeiroAcesso";

// ─── Lazy pages ───────────────────────────────────────────────────────────────
const DashboardPage     = lazy(() => import("../pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const PostagensPage     = lazy(() => import("../pages/PostagensPage").then((m) => ({ default: m.PostagensPage })));
const PostDetalhePage   = lazy(() => import("../pages/PostDetalhePage").then((m) => ({ default: m.PostDetalhePage })));
const ColaboradoresPage = lazy(() => import("../pages/ColaboradoresPage").then((m) => ({ default: m.ColaboradoresPage })));
const AniversariosPage  = lazy(() => import("../pages/AniversariosPage").then((m) => ({ default: m.AniversariosPage })));
const FeriasPage        = lazy(() => import("../pages/FeriasPage").then((m) => ({ default: m.FeriasPage })));
const GaleriaPage       = lazy(() => import("../pages/GaleriaPage").then((m) => ({ default: m.GaleriaPage })));
const PresencialPage    = lazy(() => import("../pages/PresencialPage").then((m) => ({ default: m.PresencialPage })));
const PerfilPage        = lazy(() => import("../pages/PerfilPage").then((m) => ({ default: m.PerfilPage })));
const JogosPage         = lazy(() => import("../pages/JogosPage").then((m) => ({ default: m.JogosPage })));
const AdminPage         = lazy(() => import("../pages/admin/AdminPage").then((m) => ({ default: m.AdminPage })));

const PageFallback = () => (
  <div className="card">
    <div className="card-body" style={{ padding: 24 }}>
      <div className="section-sub">Carregando página...</div>
    </div>
  </div>
);

// ─── Inner app — precisa do AuthProvider acima ─────────────────────────────────
function AppContent() {
  const {
    tela, pagina, adminAba, postSlug,
    authLoading, currentProfile, theme,
    eu, effectiveUserId,
    mobileNavOpen, setMobileNavOpen,
    navigateTo,
    handleLogin, handleConcluirPrimeiroAcesso, handleSalvarPerfil, handleOpenPost,
  } = useAuth();

  if (authLoading) return <AppShellSkeleton theme={theme} />;
  if (tela === "login") return <LoginPage onLogin={handleLogin} theme={theme} />;
  if (tela === "primeiro_acesso") return <PrimeiroAcessoPage onConcluir={handleConcluirPrimeiroAcesso} theme={theme} />;

  const PAGINAS = {
    dashboard: (
      <DashboardPage
        onOpenPost={handleOpenPost}
        onOpenAniversarios={() => navigateTo("aniversarios")}
        onOpenFolgas={() => navigateTo("ferias")}
        currentUser={eu}
        currentUserId={effectiveUserId}
      />
    ),
    postagens:    <PostagensPage onOpen={handleOpenPost} currentUserId={effectiveUserId} />,
    post_detalhe: (
      <PostDetalhePage
        currentUser={eu}
        currentUserId={effectiveUserId}
        postSlug={postSlug}
        onOpenAniversarios={() => navigateTo("aniversarios")}
        onOpenFolgas={() => navigateTo("ferias")}
      />
    ),
    colaboradores: <ColaboradoresPage currentUserId={effectiveUserId} />,
    aniversarios:  <AniversariosPage currentUserId={effectiveUserId} />,
    ferias:        <FeriasPage currentUserId={effectiveUserId} />,
    presencial:    <PresencialPage currentUserId={effectiveUserId} />,
    galeria:       <GaleriaPage currentUserId={effectiveUserId} />,
    jogos:         <JogosPage currentUser={eu} currentUserId={effectiveUserId} />,
    perfil:        <PerfilPage profile={currentProfile} onSalvar={handleSalvarPerfil} />,
    admin: (
      <AdminPage
        aba={adminAba}
        onChangeAba={(aba) => navigateTo("admin", aba)}
        currentProfile={currentProfile}
        currentUserId={effectiveUserId}
      />
    ),
  };

  return (
    <>
      <Sidebar />
      {mobileNavOpen && (
        <button className="sidebar-overlay" aria-label="Fechar menu" onClick={() => setMobileNavOpen(false)} />
      )}
      <div className="main-wrap">
        <div className="mobile-topbar">
          <img
            src={theme === "light" ? "/pan-logo-animado-light.svg" : "/pan-logo-animado.svg"}
            alt="Panet"
            className="mobile-topbar-logo"
          />
          <button
            className="mobile-menu-btn"
            aria-label="Abrir menu"
            onClick={() => setMobileNavOpen((prev) => !prev)}
          >
            {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
        <div className="content">
          <Suspense fallback={<PageFallback />}>{PAGINAS[pagina]}</Suspense>
        </div>
      </div>
    </>
  );
}

// ─── Root — mantém compatibilidade com panet.jsx → App.jsx → main.jsx ─────────
export default function PanetApp() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
