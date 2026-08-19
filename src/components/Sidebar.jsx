import { useEffect, useRef, useState } from "react";
import { Settings, ChevronDown, ChevronUp, User, Sun, Moon, LogOut } from "lucide-react";
import { Avatar } from "./Avatar";
import { useAuth } from "../context/AuthContext.jsx";
import { NAV_ITEMS, PAGE_PATHS } from "../lib/router.js";

export function Sidebar() {
  const {
    pagina, navigateTo,
    isAdmin,
    eu, theme,
    handleToggleTheme, handleLogout,
    mobileNavOpen,
  } = useAuth();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (!userMenuRef.current) return;
      if (!userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <nav className={`sidebar ${mobileNavOpen ? "open" : ""}`}>
      <div className="sidebar-logo">
        <img
          src={theme === "light" ? "/pan-logo-animado-light.svg" : "/pan-logo-animado.svg"}
          alt="Panet"
          className="logo-image"
        />
      </div>

      <div className="nav-section">
        <div className="nav-label">MENU</div>
        {NAV_ITEMS.map((n) => (
          <button
            key={n.id}
            className={`nav-item ${pagina === n.id || (n.id === "postagens" && pagina === "post_detalhe") ? "active" : ""}`}
            onClick={() => navigateTo(n.id)}
          >
            <span className="nav-icon"><n.icon size={16} /></span>
            {n.label}
          </button>
        ))}
      </div>

      {isAdmin && (
        <div className="nav-section">
          <div className="nav-label">Administração</div>
          <button
            className={`nav-item ${pagina === "admin" ? "active" : ""}`}
            onClick={() => navigateTo("admin", "colaboradores", { path: PAGE_PATHS.admin })}
          >
            <span className="nav-icon"><Settings size={16} /></span>
            Painel Administrativo
          </button>
        </div>
      )}

      <div className="sidebar-user-wrap" ref={userMenuRef}>
        {userMenuOpen && (
          <div className="user-menu">
            <button
              className="user-menu-item"
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              onClick={() => { navigateTo("perfil"); setUserMenuOpen(false); }}
            >
              <User size={14} />
              Editar perfil
            </button>
            <button
              className="user-menu-item"
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              onClick={handleToggleTheme}
            >
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              {theme === "dark" ? "Tema claro" : "Tema escuro"}
            </button>
            <button
              className="user-menu-item danger"
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              onClick={() => handleLogout()}
            >
              <LogOut size={14} />
              Deslogar
            </button>
          </div>
        )}
        <div className="sidebar-user" onClick={() => setUserMenuOpen((prev) => !prev)}>
          <Avatar col={eu} size={34} />
          <div className="user-info">
            <div className="user-name">{eu.nome}</div>
            <div className="user-role">{eu.cargo}</div>
          </div>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            {userMenuOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </div>
      </div>
    </nav>
  );
}
