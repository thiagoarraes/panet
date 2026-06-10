import { Avatar } from "../../../components/Avatar.jsx";

// Pilha de avatares sobrepostos com hover animado + tooltip do nome.
export function AvatarStack({ jogadores = [], max = 5, size = 34 }) {
  const visiveis = jogadores.slice(0, max);
  const extra = jogadores.length - visiveis.length;

  if (jogadores.length === 0) {
    return <span className="meta">Vazia</span>;
  }

  return (
    <div className="ade-stack">
      {visiveis.map((j) => (
        <div key={j.id} className="ade-stack-item" style={{ width: size, height: size }}>
          <Avatar col={j} size={size} />
          <span className="ade-stack-tip">{j.nome}</span>
        </div>
      ))}
      {extra > 0 && (
        <div className="ade-stack-item ade-stack-more" style={{ width: size, height: size }}>
          +{extra}
        </div>
      )}
    </div>
  );
}
