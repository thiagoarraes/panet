export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const isProd = process.env.NODE_ENV === "production";
  const base = `HttpOnly; ${isProd ? "Secure; " : ""}SameSite=Strict; Path=/; Max-Age=0`;

  res.setHeader("Set-Cookie", [
    `panet_at=; ${base}`,
    `panet_rt=; ${base}`,
    `panet_sid=; ${isProd ? "Secure; " : ""}SameSite=Strict; Path=/; Max-Age=0`,
  ]);

  return res.status(200).json({ success: true });
}
