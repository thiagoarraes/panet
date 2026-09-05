import { useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { ImageIcon } from "lucide-react";

const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

const getCroppedBlob = async (imageSrc, pixelCrop, maxWidth = 1000) => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const ratio = pixelCrop.width > maxWidth ? maxWidth / pixelCrop.width : 1;
  const targetWidth = Math.max(1, Math.round(pixelCrop.width * ratio));
  const targetHeight = Math.max(1, Math.round(pixelCrop.height * ratio));
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  }
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    targetWidth,
    targetHeight
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Não foi possível recortar a imagem."));
          return;
        }
        resolve(blob);
      },
      "image/webp",
      0.95
    );
  });
};

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

export function PostImageUploadCrop({ value, onChange, aspect = 2 }) {
  const [drag, setDrag] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [cropLoading, setCropLoading] = useState(false);
  const inputRef = useRef(null);

  const onSelectFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCropSrc(String(reader.result || ""));
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const applyCrop = async () => {
    if (!cropSrc || !croppedAreaPixels) return;
    try {
      setCropLoading(true);
      const blob = await getCroppedBlob(cropSrc, croppedAreaPixels);
      const dataUrl = await blobToDataUrl(blob);
      onChange(dataUrl);
      setCropModalOpen(false);
    } finally {
      setCropLoading(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          onSelectFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        className={`upload-zone ${drag ? "drag" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          onSelectFile(e.dataTransfer.files?.[0]);
        }}
      >
        {value ? (
          <img src={value} alt="Imagem de destaque" className="upload-preview" />
        ) : (
          <div>
            <div style={{ marginBottom: 8, display: "inline-flex", color: "var(--muted)" }}>
              <ImageIcon size={28} />
            </div>
            <div style={{ fontSize: 14, color: "var(--muted)" }}>Clique ou arraste uma imagem</div>
            <div style={{ fontSize: 12, color: "var(--border)", marginTop: 4 }}>JPG, PNG, WebP - otimizada em WebP automaticamente</div>
          </div>
        )}
      </button>

      {cropModalOpen && (
        <div className="modal-overlay" role="presentation" style={{ alignItems: "center", justifyItems: "center" }} onClick={() => setCropModalOpen(false)}>
          <div className="pan-modal" role="presentation" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17 }}>Ajustar imagem de destaque</div>
              <button className="modal-close" onClick={() => setCropModalOpen(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="post-crop-wrap">
                <Cropper
                  image={cropSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={aspect}
                  showGrid={true}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_, areaPixels) => setCroppedAreaPixels(areaPixels)}
                />
              </div>
              <div style={{ marginTop: 14 }}>
                <label className="form-label" htmlFor="post-image-crop-zoom">ZOOM</label>
                <input
                  id="post-image-crop-zoom"
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
                <button className="btn-primary" onClick={applyCrop} disabled={cropLoading}>
                  {cropLoading ? "Aplicando..." : "Aplicar recorte"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
