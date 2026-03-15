import { useRef, useState } from "react";
import { ImageIcon } from "lucide-react";

export function ImageUpload({ value, onChange }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef();

  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => onChange(e.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <div
      className={`upload-zone ${drag ? "drag" : ""}`}
      onClick={() => inputRef.current.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        handleFile(e.dataTransfer.files[0]);
      }}
    >
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
      {value ? (
        <img src={value} alt="preview" className="upload-preview" />
      ) : (
        <div>
          <div style={{ marginBottom: 8, display: "inline-flex", color: "var(--muted)" }}>
            <ImageIcon size={28} />
          </div>
          <div style={{ fontSize: 14, color: "var(--muted)" }}>Clique ou arraste uma imagem</div>
          <div style={{ fontSize: 12, color: "var(--border)", marginTop: 4 }}>JPG, PNG, WebP - recomendado 9:16</div>
        </div>
      )}
    </div>
  );
}
