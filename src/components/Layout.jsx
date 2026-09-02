import { Suspense, lazy } from "react";
import { Menu, X } from "lucide-react";
import { Routes, Route, Outlet, useNavigate, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "../context/AuthContext.jsx";
import { AppShellSkeleton } from "./AppShellSkeleton.jsx";
import { Sidebar } from "./Sidebar.jsx";
import { LoginPage } from "../pages/LoginPage";
import { PrimeiroAcessoPage } from "../pages/PrimeiroAcesso";
import { toPostSlug } from "../lib/postRouting.js";

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
const PanPassPage       = lazy(() => import("../pages/PanPassPage").then((m) => ({ default: m.PanPassPage })));
const AdminPage         = lazy(() => import("../pages/admin/AdminPage").then((m) => ({ default: m.AdminPage })));

const PageFallback = () => (
  <div className="pan-card">
    <div className="card-body" style={{ padding: 24 }}>
      <div className="section-sub">Carregando página...</div>
    </div>
  </div>
);

function AppShell() {
  const {
    theme,
    mobileNavOpen, setMobileNavOpen,
  } = useAuth();

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
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </div>
      </div>
    </>
  );
}

function PrivateRoute({ children }) {
  const { authLoading, currentProfile, sessionUserId, theme } = useAuth();

  if (authLoading) return <AppShellSkeleton theme={theme} />;

  if (!currentProfile && !sessionUserId) {
    return <Navigate to="/login" replace />;
  }

  // Primeiro acesso flow: manda para a troca de senha obrigatoria quem ainda
  // nao concluiu (true), nao quem ja concluiu. Estava invertido -- deixava
  // colaborador novo (senha temporaria) entrar direto, e prendia quem acabou
  // de trocar a senha num loop de volta pra /primeiro-acesso.
  if (currentProfile && currentProfile.primeiro_acesso === true) {
    return <Navigate to="/primeiro-acesso" replace />;
  }

  return children;
}

// /login e /primeiro-acesso nao tinham guarda: apos autenticar, o state
// (currentProfile/sessionUserId) mudava mas a URL continuava em /login, e
// nada chamava navigate("/") -- o botao voltava para "Entrar na Panet" sem
// erro e sem sair da tela. No sistema antigo (tela/pagina como state) isso
// nao existia porque a propria troca de `tela` decidia o que renderizar,
// independente da URL.
function PublicOnlyRoute({ children }) {
  const { authLoading, currentProfile, sessionUserId, theme } = useAuth();

  if (authLoading) return <AppShellSkeleton theme={theme} />;

  if (currentProfile && sessionUserId) {
    if (currentProfile.primeiro_acesso === true) return <Navigate to="/primeiro-acesso" replace />;
    return <Navigate to="/" replace />;
  }

  return children;
}

function AppContent() {
  const {
    authLoading, currentProfile, theme, sessionExpiredNotice,
    eu, effectiveUserId,
    handleLogin, handleConcluirPrimeiroAcesso, handleSalvarPerfil,
  } = useAuth();

  const navigate = useNavigate();

  // handleOpenPost saiu do AuthContext na migracao pro react-router (ele so
  // fazia navigateTo com o estado antigo tela/pagina/postSlug). O componente
  // que ja tem `navigate` em escopo assume o proprio roteamento.
  const handleOpenPost = (post) => {
    const slug = toPostSlug(post?.titulo || "");
    if (!slug) return;
    navigate(`/posts/${slug}`);
  };

  if (authLoading) return <AppShellSkeleton theme={theme} />;

  return (
    <Routes>
      <Route path="/login" element={
        <PublicOnlyRoute>
          <LoginPage onLogin={handleLogin} theme={theme} notice={sessionExpiredNotice} />
        </PublicOnlyRoute>
      } />
      <Route path="/primeiro-acesso" element={<PrimeiroAcessoPage onConcluir={handleConcluirPrimeiroAcesso} theme={theme} />} />
      
      <Route
        path="/"
        element={
          <PrivateRoute>
            <AppShell />
          </PrivateRoute>
        }
      >
        <Route index element={
          <DashboardPage
            onOpenPost={handleOpenPost}
            onOpenAniversarios={() => navigate("/aniversarios")}
            onOpenFolgas={() => navigate("/folgas")}
            currentUser={eu}
            currentUserId={effectiveUserId}
          />
        } />
        <Route path="pannews" element={<PostagensPage onOpen={handleOpenPost} currentUserId={effectiveUserId} />} />
        <Route path="posts/:postSlug" element={
          <PostDetalhePage
            currentUser={eu}
            currentUserId={effectiveUserId}
            onOpenAniversarios={() => navigate("/aniversarios")}
            onOpenFolgas={() => navigate("/folgas")}
          />
        } />
        <Route path="colaboradores" element={<ColaboradoresPage currentUserId={effectiveUserId} currentProfile={currentProfile} />} />
        <Route path="aniversarios" element={<AniversariosPage currentUserId={effectiveUserId} />} />
        <Route path="folgas" element={<FeriasPage currentUserId={effectiveUserId} />} />
        <Route path="eventos" element={<PresencialPage currentUserId={effectiveUserId} />} />
        <Route path="galerias/*" element={<GaleriaPage currentUserId={effectiveUserId} />} />
        <Route path="jogos" element={<JogosPage currentUser={eu} currentUserId={effectiveUserId} />} />
        <Route path="panpass" element={<PanPassPage />} />
        <Route path="perfil" element={<PerfilPage profile={currentProfile} onSalvar={handleSalvarPerfil} />} />
        
        {/* The AdminPage will handle its own sub-routes or state for now, we just route everything under /admin/* to it */}
        <Route path="admin/*" element={
          <AdminPage
            currentProfile={currentProfile}
            currentUserId={effectiveUserId}
          />
        } />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function PanetApp() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
