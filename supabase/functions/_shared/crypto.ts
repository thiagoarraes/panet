// Cifra simétrica dos segredos do PanPass (senha e secret TOTP).
// AES-256-GCM via WebCrypto nativo do Deno — sem dependência externa.
// Formato armazenado: "base64(iv):base64(ciphertext+tag)".
//
// A chave vem de PANPASS_MASTER_KEY (base64 de 32 bytes), definida nos secrets
// das Edge Functions. Gerar uma vez com:
//   openssl rand -base64 32

const IV_BYTES = 12;

const b64encode = (bytes: Uint8Array): string => {
  let str = "";
  for (const byte of bytes) str += String.fromCharCode(byte);
  return btoa(str);
};

// `new Uint8Array(n)` mantém o tipo preso a ArrayBuffer — o que o WebCrypto
// exige. `Uint8Array.from` resolveria para ArrayBufferLike e não compila.
const b64decode = (value: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(value);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

let cachedKey: CryptoKey | null = null;

async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const raw = Deno.env.get("PANPASS_MASTER_KEY");
  if (!raw) throw new Error("PANPASS_MASTER_KEY não configurada.");
  const bytes = b64decode(raw.trim());
  if (bytes.length !== 32) {
    throw new Error("PANPASS_MASTER_KEY deve ser base64 de exatamente 32 bytes.");
  }
  cachedKey = await crypto.subtle.importKey("raw", bytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
  return cachedKey;
}

export async function encrypt(plain: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plain),
  );
  return `${b64encode(iv)}:${b64encode(new Uint8Array(ct))}`;
}

export async function decrypt(blob: string): Promise<string> {
  const [ivPart, ctPart] = String(blob || "").split(":");
  if (!ivPart || !ctPart) throw new Error("Valor cifrado em formato inválido.");
  const key = await getKey();
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64decode(ivPart) },
    key,
    b64decode(ctPart),
  );
  return new TextDecoder().decode(plain);
}
