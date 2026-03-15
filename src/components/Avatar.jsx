export const Avatar = ({ col, size = 40 }) => {
  const avatarUrl = col?.fotoUrl || col?.foto_url || "";
  const hasImage = Boolean(avatarUrl);

  return (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: hasImage ? col?.cor || "#444" : "var(--avatar-empty-bg, #444)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      fontSize: size * 0.36,
      fontWeight: 700,
      color: hasImage ? "#0a1929" : "var(--avatar-empty-text, #0a1929)",
      fontFamily: "'Sora', sans-serif",
      flexShrink: 0,
      letterSpacing: "-0.5px",
      transition: "transform 0.2s",
    }}
  >
    {hasImage ? (
      <img
        src={avatarUrl}
        alt={col?.nome || "Avatar"}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    ) : (
      col?.foto
    )}
  </div>
  );
};
