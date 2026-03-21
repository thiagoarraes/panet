function Sk({ w, h, r, style }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

export function SkeletonPostCard() {
  return (
    <div className="skeleton-post-card">
      <div className="post-thumb">
        <Sk style={{ width: "100%", height: "100%", borderRadius: 0 }} />
      </div>
      <div className="post-body">
        <div className="post-card-head">
          <Sk w={56} h={68} r={10} style={{ minWidth: 56, flexShrink: 0 }} />
          <div className="post-card-head-content" style={{ gap: 6, display: "flex", flexDirection: "column" }}>
            <Sk w={60} h={18} r={4} />
            <Sk style={{ width: "80%", height: 16, borderRadius: 4 }} />
            <Sk style={{ width: "55%", height: 14, borderRadius: 4 }} />
          </div>
        </div>
        <Sk style={{ width: "100%", height: 12, borderRadius: 4, marginBottom: 6 }} />
        <Sk style={{ width: "70%", height: 12, borderRadius: 4 }} />
      </div>
      <div className="post-footer">
        <Sk w={48} h={22} r={6} />
        <Sk w={48} h={22} r={6} />
      </div>
    </div>
  );
}

export function SkeletonCollabCard() {
  return (
    <div className="skeleton-collab-card">
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Sk w={64} h={64} r="50%" />
      </div>
      <Sk style={{ width: "68%", height: 15, margin: "14px auto 6px", borderRadius: 4 }} />
      <Sk style={{ width: "48%", height: 12, margin: "0 auto 16px", borderRadius: 4 }} />
      <Sk style={{ width: "56%", height: 11, margin: "0 auto", borderRadius: 4 }} />
    </div>
  );
}

export function SkeletonGaleriaCard() {
  return (
    <div className="skeleton-galeria-card">
      <div className="skeleton" style={{ width: "100%", height: "100%", borderRadius: 0 }} />
    </div>
  );
}

export function SkeletonAnivItem() {
  return (
    <div className="aniv-item">
      <Sk w={36} h={42} r={6} style={{ flexShrink: 0 }} />
      <Sk w={36} h={36} r="50%" style={{ flexShrink: 0 }} />
      <div className="aniv-info">
        <Sk style={{ width: "62%", height: 14, marginBottom: 5, borderRadius: 4 }} />
        <Sk style={{ width: "38%", height: 11, borderRadius: 4 }} />
      </div>
    </div>
  );
}

export function SkeletonFolgaEntry() {
  return (
    <div className="folga-entry" style={{ marginBottom: 8 }}>
      <div className="folga-avatar-wrap">
        <Sk w={32} h={32} r="50%" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, justifyContent: "center" }}>
        <Sk w={72} h={12} r={4} />
        <Sk w={58} h={18} r={20} />
        <Sk w={68} h={11} r={4} />
      </div>
    </div>
  );
}
