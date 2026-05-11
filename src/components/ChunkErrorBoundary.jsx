import React from "react";

const RELOAD_FLAG = "panet:reloaded-after-chunk-error";

const CHUNK_ERROR_PATTERNS = [
  "ChunkLoadError",
  "Failed to fetch dynamically imported module",
  "Importing a module script failed",
  "error loading dynamically imported module",
];

function isChunkError(error) {
  if (!error) return false;
  if (error.name === "ChunkLoadError") return true;
  const msg = String(error.message || error);
  return CHUNK_ERROR_PATTERNS.some((p) => msg.includes(p));
}

export class ChunkErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    if (isChunkError(error) && typeof window !== "undefined") {
      if (sessionStorage.getItem(RELOAD_FLAG) === "1") return;
      sessionStorage.setItem(RELOAD_FLAG, "1");
      window.location.reload();
    }
  }

  handleReload = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(RELOAD_FLAG);
      window.location.reload();
    }
  };

  render() {
    if (this.state.error && !isChunkError(this.state.error)) {
      return (
        <div className="card">
          <div className="card-body" style={{ padding: 24 }}>
            <div className="section-sub" style={{ marginBottom: 12 }}>
              Não foi possível carregar esta página.
            </div>
            <button type="button" className="btn btn-primary" onClick={this.handleReload}>
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    if (this.state.error && isChunkError(this.state.error)) {
      return null;
    }
    return this.props.children;
  }
}
