import { buscarMarcaPanPass, corMonogramaPanPass, iniciaisPanPass } from "../lib/panpassIcones";

// Logo de um serviço do PanPass, com três níveis de fallback:
//   1. logo_url cadastrado pelo admin (imagem real)
//   2. ícone de marca do Simple Icons, quando existe um match seguro
//   3. monograma colorido com as iniciais — nunca dois serviços diferentes
//      caem no mesmo ícone genérico, mesmo sem nenhuma logo cadastrada
export function PanPassServicoLogo({ servico, size, className }) {
  const px = `${size}px`;

  if (servico?.logo_url) {
    return (
      <img
        className={className}
        src={servico.logo_url}
        alt=""
        width={size}
        height={size}
        loading="lazy"
      />
    );
  }

  const marca = buscarMarcaPanPass(servico?.nome);
  if (marca) {
    const { Icon, cor } = marca;
    return (
      <span
        className={className}
        aria-hidden="true"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: px,
          height: px,
          color: cor,
          background: "color-mix(in srgb, currentColor 12%, var(--surface2))",
        }}
      >
        <Icon size={Math.round(size * 0.5)} />
      </span>
    );
  }

  return (
    <span
      className={className}
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: px,
        height: px,
        fontFamily: "'Sora', sans-serif",
        fontWeight: 700,
        fontSize: `${Math.round(size * 0.34)}px`,
        color: "#fff",
        background: corMonogramaPanPass(servico?.nome),
      }}
    >
      {iniciaisPanPass(servico?.nome)}
    </span>
  );
}
