import { Component } from "react";

// Captura crashes de render de qualquer subárvore para que um erro localizado
// (ex.: uma página) não derrube o app inteiro com tela branca.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { erro: null };
  }

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    console.error("[ErrorBoundary] render falhou:", erro, info?.componentStack);
  }

  reset = () => {
    this.setState({ erro: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.erro) return this.props.children;

    if (typeof this.props.fallback === "function") {
      return this.props.fallback({ erro: this.state.erro, reset: this.reset });
    }

    return (
      <div className="card" style={{ margin: "24px auto", maxWidth: 520 }}>
        <div className="card-body" style={{ padding: 24, textAlign: "center" }}>
          <h2 className="section-title" style={{ marginBottom: 8 }}>Algo deu errado</h2>
          <p className="section-sub" style={{ marginBottom: 16 }}>
            {this.props.mensagem || "Tivemos um problema ao carregar esta tela."}
          </p>
          <button className="btn-primary" onClick={this.reset}>Tentar de novo</button>
        </div>
      </div>
    );
  }
}
