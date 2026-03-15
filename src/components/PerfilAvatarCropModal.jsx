import { useState } from "react";
import Cropper from "react-easy-crop";

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

export function PerfilAvatarCropModal({ open, avatarSrc, onClose, onApply, onError }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [cropLoading, setCropLoading] = useState(false);

  if (!open) return null;

  const aplicarCrop = async () => {
    if (!avatarSrc || !croppedAreaPixels) return;
    try {
      setCropLoading(true);
      const blob = await getCroppedBlob(avatarSrc, croppedAreaPixels);
      const preview = URL.createObjectURL(blob);
      onApply?.(blob, preview);
    } catch (err) {
      onError?.(err?.message || "Não foi possível recortar a imagem.");
    } finally {
      setCropLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ alignItems: "center", justifyItems: "center" }} onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17 }}>Ajustar avatar</div>
          <button className="modal-close" onClick={onClose}>
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
            <button className="btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={aplicarCrop} disabled={cropLoading}>
              {cropLoading ? "Aplicando..." : "Aplicar recorte"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
