export const getGaleriaStoragePathFromUrl = (rawUrl) => {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  if (/^(data:|blob:)/i.test(value)) return "";
  if (!/^https?:\/\//i.test(value)) {
    if (value.startsWith("/galerias/")) {
      const candidate = value.slice("/galerias/".length);
      return candidate.includes("/") ? candidate : "";
    }
    return value.replace(/^\/+/, "");
  }
  try {
    const parsed = new URL(value);
    const pathname = decodeURIComponent(parsed.pathname || "");

    if (pathname.startsWith("/galerias/")) {
      return pathname.slice("/galerias/".length);
    }

    const markers = [
      "/storage/v1/object/public/galeria/",
      "/storage/v1/object/sign/galeria/",
      "/storage/v1/object/authenticated/galeria/",
    ];
    for (const marker of markers) {
      const idx = pathname.indexOf(marker);
      if (idx >= 0) return pathname.slice(idx + marker.length);
    }
    return "";
  } catch (_err) {
    return "";
  }
};

export const getAvatarStoragePathFromUrl = (rawUrl) => {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  if (/^(data:|blob:)/i.test(value)) return "";
  if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, "");
  try {
    const parsed = new URL(value);
    const pathname = decodeURIComponent(parsed.pathname || "");
    const markers = [
      "/storage/v1/object/public/avatares/",
      "/storage/v1/object/sign/avatares/",
      "/storage/v1/object/authenticated/avatares/",
    ];
    for (const marker of markers) {
      const idx = pathname.indexOf(marker);
      if (idx >= 0) return pathname.slice(idx + marker.length);
    }
    return "";
  } catch (_err) {
    return "";
  }
};

export const getPostStoragePathFromUrl = (rawUrl) => {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  if (/^(data:|blob:)/i.test(value)) return "";
  if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, "");
  try {
    const parsed = new URL(value);
    const pathname = decodeURIComponent(parsed.pathname || "");
    const markers = [
      "/storage/v1/object/public/postagens/",
      "/storage/v1/object/sign/postagens/",
      "/storage/v1/object/authenticated/postagens/",
    ];
    for (const marker of markers) {
      const idx = pathname.indexOf(marker);
      if (idx >= 0) return pathname.slice(idx + marker.length);
    }
    return "";
  } catch (_err) {
    return "";
  }
};

export const optimizeImageToWebp = async (file, maxWidth = 1080, quality = 0.92) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ratio = img.width > maxWidth ? maxWidth / img.width : 1;
        const width = Math.max(1, Math.round(img.width * ratio));
        const height = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Falha ao processar imagem."));
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Falha ao converter imagem para WebP."));
              return;
            }
            resolve(blob);
          },
          "image/webp",
          quality
        );
      };
      img.onerror = () => reject(new Error("Arquivo de imagem inválido."));
      img.src = String(reader.result || "");
    };
    reader.onerror = () => reject(new Error("Falha ao ler arquivo de imagem."));
    reader.readAsDataURL(file);
  });
