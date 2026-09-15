import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "../components/Avatar";
import "../styles/perfil.css";

const PerfilAvatarCropModal = lazy(() =>
  import("../components/PerfilAvatarCropModal").then((m) => ({ default: m.PerfilAvatarCropModal }))
);

const formatPhoneBR = (value) => {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const getBirthdayParts = (isoDate) => {
  if (!isoDate) return { aniversarioDia: "", aniversarioMes: "" };
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return { aniversarioDia: "", aniversarioMes: "" };
  return {
    aniversarioDia: String(parsed.getDate()).padStart(2, "0"),
    aniversarioMes: String(parsed.getMonth() + 1).padStart(2, "0"),
  };
};

const toBirthdayIso = (dia, mes) => {
  if (!dia || !mes) return null;
  const year = new Date().getFullYear();
  return `${year}-${mes}-${dia}`;
};

const MONTH_OPTIONS = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

/* ── Ícones inline (SVG) ── */
const IconUser = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);
const IconBriefcase = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
);
const IconPhone = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
);
const IconInstagram = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
);
const IconLinkedin = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
);
const IconCake = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/></svg>
);
const IconCamera = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
);
const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);
const IconMail = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
);

const FIELD_CONFIG = [
  { key: "nome", label: "Nome", icon: IconUser, placeholder: "Seu nome completo" },
  { key: "cargo", label: "Cargo", icon: IconBriefcase, placeholder: "Seu cargo na empresa" },
  { key: "telefone", label: "Telefone", icon: IconPhone, placeholder: "(00) 00000-0000" },
  { key: "instagram", label: "Instagram", icon: IconInstagram, prefix: "instagram.com/", placeholder: "seu_usuario" },
  { key: "linkedin", label: "LinkedIn", icon: IconLinkedin, prefix: "linkedin.com/in/", placeholder: "seu-perfil" },
];

export function PerfilPage({ profile, onSalvar }) {
  const [form, setForm] = useState({
    nome: "",
    cargo: "",
    telefone: "",
    instagram: "",
    linkedin: "",
    aniversarioDia: "",
    aniversarioMes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState("");
  const [avatarBlob, setAvatarBlob] = useState(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);

  const fileInputRef = useRef(null);
  const lastProfileIdRef = useRef(null);
  const avatarObjectUrlRef = useRef("");

  useEffect(() => {
    if (!profile) return;

    const profileChanged = lastProfileIdRef.current !== profile.id;
    if (!profileChanged && isDirty) return;

    const birthday = getBirthdayParts(profile.aniversario);
    setForm({
      nome: profile.nome || "",
      cargo: profile.cargo || "",
      telefone: formatPhoneBR(profile.telefone || ""),
      instagram: profile.instagram || "",
      linkedin: profile.linkedin || "",
      aniversarioDia: birthday.aniversarioDia,
      aniversarioMes: birthday.aniversarioMes,
    });

    lastProfileIdRef.current = profile.id;
    if (profileChanged) {
      setIsDirty(false);
      setAvatarBlob(null);
      if (avatarObjectUrlRef.current) {
        URL.revokeObjectURL(avatarObjectUrlRef.current);
        avatarObjectUrlRef.current = "";
      }
      setAvatarSrc(profile.foto_url || "");
    }
  }, [profile, isDirty]);

  useEffect(
    () => () => {
      if (avatarObjectUrlRef.current) {
        URL.revokeObjectURL(avatarObjectUrlRef.current);
      }
    },
    []
  );

  const eu = useMemo(() => {
    if (!profile) return null;
    const initials = profile.nome
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("");

    return {
      id: profile.id,
      nome: profile.nome,
      cargo: profile.cargo,
      email: profile.email,
      telefone: profile.telefone,
      foto: initials || "U",
      fotoUrl: avatarSrc || profile.foto_url || "",
      cor: profile.cor_avatar || "#11E7E7",
      redes: {
        instagram: profile.instagram || "",
        linkedin: profile.linkedin || "",
        github: profile.github || "",
      },
    };
  }, [profile, avatarSrc]);

  const onSelectAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Selecione um arquivo de imagem válido.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setError("");
      setAvatarSrc(String(reader.result || ""));
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const salvar = async () => {
    if (!onSalvar) return;
    try {
      setSaving(true);
      setError("");
      await onSalvar({
        ...form,
        aniversario: toBirthdayIso(form.aniversarioDia, form.aniversarioMes),
        avatarBlob,
      });
      setIsDirty(false);
      setAvatarBlob(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err?.message || "Não foi possível salvar o perfil.");
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (key, value) => {
    setIsDirty(true);
    setForm((p) => ({
      ...p,
      [key]: key === "telefone" ? formatPhoneBR(value) : value,
    }));
  };

  if (!profile || !eu) {
    return (
      <div className="perfil-page-v2">
        <div className="perfil-loading">
          <div className="perfil-loading-spinner" />
          <span>Carregando perfil...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="perfil-page-v2">
      {/* ── Banner + Avatar ── */}
      <div className="perfil-banner">
        <div className="perfil-banner-gradient" />
        <div className="perfil-banner-content">
          <div className="perfil-avatar-wrapper">
            <Avatar col={eu} size={96} />
            <button
              className="perfil-avatar-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              type="button"
              title="Alterar foto"
            >
              <IconCamera />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onSelectAvatar} />
          </div>
          <div className="perfil-header-info">
            <h1 className="perfil-nome">{form.nome || eu.nome}</h1>
            <span className="perfil-cargo-badge">{form.cargo || eu.cargo}</span>
            <div className="perfil-email-row">
              <IconMail />
              <span>{eu.email}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Formulário ── */}
      <div className="perfil-form-card">
        <div className="perfil-section-header">
          <h2 className="perfil-section-title">Informações pessoais</h2>
          <p className="perfil-section-desc">Atualize seus dados para que a equipe te encontre facilmente.</p>
        </div>

        <div className="perfil-fields">
          {FIELD_CONFIG.map(({ key, label, icon: Icon, prefix, placeholder }) => (
            <div className="perfil-field" key={key}>
              <label className="perfil-field-label">
                <span className="perfil-field-icon"><Icon /></span>
                {label}
              </label>
              {prefix ? (
                <div className="perfil-input-group">
                  <span className="perfil-input-prefix">{prefix}</span>
                  <input
                    className="perfil-input"
                    value={form[key]}
                    onChange={(e) => handleFieldChange(key, e.target.value)}
                    placeholder={placeholder}
                  />
                </div>
              ) : (
                <input
                  className="perfil-input"
                  value={form[key]}
                  onChange={(e) => handleFieldChange(key, e.target.value)}
                  placeholder={placeholder}
                />
              )}
            </div>
          ))}

          {/* Aniversário */}
          <div className="perfil-field">
            <label className="perfil-field-label" htmlFor="perfil-aniversario-dia">
              <span className="perfil-field-icon"><IconCake /></span>
              Aniversário
            </label>
            <div className="perfil-birthday-row">
              <div className="perfil-select-wrap">
                <select
                  id="perfil-aniversario-dia"
                  className="perfil-select"
                  aria-label="Dia do aniversário"
                  value={form.aniversarioDia}
                  onChange={(e) => {
                    setIsDirty(true);
                    setForm((p) => ({ ...p, aniversarioDia: e.target.value }));
                  }}
                >
                  <option value="">Dia</option>
                  {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="perfil-select-wrap">
                <select
                  className="perfil-select"
                  aria-label="Mês do aniversário"
                  value={form.aniversarioMes}
                  onChange={(e) => {
                    setIsDirty(true);
                    setForm((p) => ({ ...p, aniversarioMes: e.target.value }));
                  }}
                >
                  <option value="">Mês</option>
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Erro */}
        {error && (
          <div className="perfil-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            {error}
          </div>
        )}

        {/* Botão salvar */}
        <button
          className={`perfil-save-btn ${saved ? "perfil-save-btn--success" : ""}`}
          onClick={salvar}
          disabled={saving}
          type="button"
        >
          {saving ? (
            <>
              <span className="perfil-spinner" />
              Salvando...
            </>
          ) : saved ? (
            <>
              <IconCheck />
              Salvo com sucesso!
            </>
          ) : (
            "Salvar alterações"
          )}
        </button>

        {isDirty && !saving && !saved && (
          <p className="perfil-dirty-hint">Você tem alterações não salvas.</p>
        )}
      </div>

      {cropModalOpen && (
        <Suspense
          fallback={
            <div className="modal-overlay" style={{ alignItems: "center", justifyItems: "center" }}>
              <div className="pan-modal" style={{ maxWidth: 560 }}>
                <div className="modal-body">
                  <div className="section-sub">Carregando editor de avatar...</div>
                </div>
              </div>
            </div>
          }
        >
          <PerfilAvatarCropModal
            open={cropModalOpen}
            avatarSrc={avatarSrc}
            onClose={() => setCropModalOpen(false)}
            onError={(message) => setError(message)}
            onApply={(blob, preview) => {
              if (avatarObjectUrlRef.current) URL.revokeObjectURL(avatarObjectUrlRef.current);
              avatarObjectUrlRef.current = preview;
              setError("");
              setAvatarBlob(blob);
              setAvatarSrc(preview);
              setCropModalOpen(false);
              setIsDirty(true);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}