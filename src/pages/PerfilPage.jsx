import { useEffect, useMemo, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { Avatar } from "../components/Avatar";

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

const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

const getCroppedBlob = async (imageSrc, pixelCrop) => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Não foi possível recortar a imagem."));
        return;
      }
      resolve(blob);
    }, "image/jpeg", 0.92);
  });
};

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
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [cropLoading, setCropLoading] = useState(false);

  const fileInputRef = useRef(null);
  const lastProfileIdRef = useRef(null);

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
      setAvatarSrc(profile.foto_url || "");
    }
  }, [profile, isDirty]);

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
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setAvatarSrc(String(reader.result || ""));
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const aplicarCrop = async () => {
    if (!avatarSrc || !croppedAreaPixels) return;
    try {
      setCropLoading(true);
      setError("");
      const blob = await getCroppedBlob(avatarSrc, croppedAreaPixels);
      const preview = URL.createObjectURL(blob);
      setAvatarBlob(blob);
      setAvatarSrc(preview);
      setCropModalOpen(false);
      setIsDirty(true);
    } catch (err) {
      setError(err?.message || "Não foi possível recortar a imagem.");
    } finally {
      setCropLoading(false);
    }
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
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err?.message || "Não foi possível salvar o perfil.");
    } finally {
      setSaving(false);
    }
  };

  if (!profile || !eu) {
    return (
      <div className="fade-up" style={{ maxWidth: 560 }}>
        <div className="section-title" style={{ marginBottom: 20 }}>
          Meu Perfil
        </div>
        <div className="card" style={{ padding: 24 }}>
          Carregando perfil...
        </div>
      </div>
    );
  }

  return (
    <div className="fade-up" style={{ maxWidth: 560 }}>
      <div className="section-title" style={{ marginBottom: 20 }}>
        Meu Perfil
      </div>
      <div className="card">
        <div style={{ padding: 24, display: "flex", alignItems: "center", gap: 16, borderBottom: "1px solid var(--border)" }}>
          <div>
            <Avatar col={eu} size={72} />
            <button
              className="btn-ghost"
              style={{ marginTop: 10, fontSize: 12, padding: "6px 10px" }}
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              Alterar foto
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onSelectAvatar} />
          </div>
          <div>
            <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 20 }}>{eu.nome}</div>
            <div style={{ color: "var(--muted)", fontSize: 14 }}>{eu.cargo}</div>
            <div style={{ fontSize: 12, color: "var(--accent)", marginTop: 4 }}>{eu.email}</div>
          </div>
        </div>
        <div style={{ padding: 24 }}>
          {["nome", "cargo", "telefone", "instagram", "linkedin"].map((key) => (
            <div className="form-group" key={key}>
              <label className="form-label">{key.toUpperCase()}</label>
              {key === "instagram" || key === "linkedin" ? (
                <div className="input-group">
                  <span className="input-group-text">{key === "instagram" ? "instagram.com/" : "linkedin.com/in/"}</span>
                  <input
                    className="form-input"
                    value={form[key]}
                    onChange={(e) => {
                      setIsDirty(true);
                      setForm((p) => ({ ...p, [key]: e.target.value }));
                    }}
                    placeholder=""
                  />
                </div>
              ) : (
                <input
                  className="form-input"
                  value={form[key]}
                  onChange={(e) => {
                    setIsDirty(true);
                    setForm((p) => ({
                      ...p,
                      [key]: key === "telefone" ? formatPhoneBR(e.target.value) : e.target.value,
                    }));
                  }}
                  placeholder=""
                />
              )}
            </div>
          ))}

          <div className="form-group">
            <label className="form-label">ANIVERSÁRIO (DIA E MÊS)</label>
            <div className="grid-2 perfil-aniversario-grid">
              <select
                className="form-input"
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
              <select
                className="form-input"
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

          {error && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 10 }}>{error}</div>}
          <button className="btn-primary" onClick={salvar} disabled={saving}>
            {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar alterações"}
          </button>
        </div>
      </div>

      {cropModalOpen && (
        <div className="modal-overlay" style={{ alignItems: "center", justifyItems: "center" }} onClick={() => setCropModalOpen(false)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17 }}>Ajustar avatar</div>
              <button className="modal-close" onClick={() => setCropModalOpen(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="avatar-crop-wrap">
                <Cropper
                  image={avatarSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_, areaPixels) => setCroppedAreaPixels(areaPixels)}
                />
              </div>
              <div style={{ marginTop: 14 }}>
                <label className="form-label">ZOOM</label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
                <button className="btn-ghost" onClick={() => setCropModalOpen(false)}>
                  Cancelar
                </button>
                <button className="btn-primary" onClick={aplicarCrop} disabled={cropLoading}>
                  {cropLoading ? "Aplicando..." : "Aplicar recorte"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

