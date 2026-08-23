export function AppShellSkeleton({ theme }) {
  return (
    <>
      <nav className="sidebar">
        <div className="sidebar-logo">
          <img
            src={theme === "light" ? "/pan-logo-animado-light.svg" : "/pan-logo-animado.svg"}
            alt="Panet"
            className="logo-image"
          />
        </div>
        <div className="nav-section">
          <div className="nav-label">MENU</div>
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="nav-item" style={{ pointerEvents: "none" }}>
              <span className="nav-icon">
                <span className="pan-skeleton" style={{ width: 16, height: 16, borderRadius: 4, display: "block" }} />
              </span>
              <span className="pan-skeleton" style={{ width: `${50 + (i % 3) * 20}px`, height: 13, borderRadius: 6 }} />
            </div>
          ))}
        </div>
        <div className="sidebar-user-wrap">
          <div className="sidebar-user" style={{ pointerEvents: "none" }}>
            <span className="pan-skeleton" style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0 }} />
            <div className="user-info">
              <span className="pan-skeleton" style={{ width: 90, height: 12, borderRadius: 6, display: "block", marginBottom: 4 }} />
              <span className="pan-skeleton" style={{ width: 60, height: 10, borderRadius: 6, display: "block" }} />
            </div>
          </div>
        </div>
      </nav>
      <div className="main-wrap">
        <div className="mobile-topbar">
          <img
            src={theme === "light" ? "/pan-logo-animado-light.svg" : "/pan-logo-animado.svg"}
            alt="Panet"
            className="mobile-topbar-logo"
          />
        </div>
        <div className="content">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="pan-skeleton" style={{ width: "100%", height: 140, borderRadius: 16 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="pan-skeleton" style={{ height: 200, borderRadius: 14 }} />
              <div className="pan-skeleton" style={{ height: 200, borderRadius: 14 }} />
            </div>
            <div className="pan-skeleton" style={{ width: "100%", height: 120, borderRadius: 14 }} />
          </div>
        </div>
      </div>
    </>
  );
}
