import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { FaInstagram, FaLinkedin, FaWhatsapp, FaEnvelope } from "react-icons/fa6";
import { useColaboradores } from "../hooks/queries/useColaboradores.js";

const toWhatsappHref = (telefone) => {
  const digits = String(telefone || "").replace(/\D/g, "");
  if (!digits) return "";
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}`;
};

const toInstagramHref = (instagram) => {
  const raw = String(instagram || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const handle = raw.replace(/^@+/, "").replace(/^instagram\.com\//i, "");
  return `https://instagram.com/${handle}`;
};

const toLinkedinHref = (linkedin) => {
  const raw = String(linkedin || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const slug = raw.replace(/^linkedin\.com\/in\//i, "").replace(/^@+/, "");
  return `https://linkedin.com/in/${slug}`;
};

const getZodiacInfo = (isoDate) => {
  if (!isoDate) return null;
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const month = parsed.getMonth() + 1;
  const day = parsed.getDate();

  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return { nome: "Áries", emoji: "♈" };
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return { nome: "Touro", emoji: "♉" };
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return { nome: "Gêmeos", emoji: "♊" };
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return { nome: "Câncer", emoji: "♋" };
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return { nome: "Leão", emoji: "♌" };
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return { nome: "Virgem", emoji: "♍" };
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return { nome: "Libra", emoji: "♎" };
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return { nome: "Escorpião", emoji: "♏" };
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return { nome: "Sagitário", emoji: "♐" };
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return { nome: "Capricórnio", emoji: "♑" };
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return { nome: "Aquário", emoji: "♒" };
  return { nome: "Peixes", emoji: "♓" };
};

export function ColaboradoresPage({ currentUserId }) {
  const { data: colaboradores = [] } = useColaboradores(currentUserId);
  const [selected, setSelected] = useState(null);
  const signo = getZodiacInfo(selected?.aniversario);
  const signoHref = signo
    ? `https://www.google.com/search?q=${encodeURIComponent(`como são as pessoas do signo de ${signo.nome}`)}`
    : "";

  return (
    <div className="fade-up">
      <div className="section-header">
        <div>
          <div className="section-title">Colaboradores</div>
          <div className="section-sub">{colaboradores.length} pessoas no time</div>
        </div>
      </div>

      <div className="grid-4 stagger">
        {colaboradores.map((col) => (
          <div key={col.id} className="collab-card" onClick={() => setSelected(col)}>
            {col.isMe && <span className="collab-ribbon">VOCÊ</span>}
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Avatar col={col} size={64} />
            </div>
            <div className="collab-name">{col.nome}</div>
            <div className="collab-cargo">{col.cargo}</div>
            <div className="collab-click-hint" aria-hidden="true">
              Ver detalhes
              <ArrowUpRight size={14} />
            </div>
          </div>
        ))}
      </div>

      {colaboradores.length === 0 && <div className="empty-state">Nenhum colaborador encontrado.</div>}

      {selected && (
        <div className="modal-overlay" style={{ alignItems: "center", justifyItems: "center" }} onClick={() => setSelected(null)}>
          <div className="modal collab-modal" onClick={(e) => e.stopPropagation()}>
            <div className="profile-hero">
              <Avatar col={selected} size={72} />
              <div>
                <div className="profile-name">{selected.nome}</div>
                <div className="profile-cargo">{selected.cargo}</div>
                {selected.isMe && (
                  <span className="collab-modal-you">
                    VOCÊ
                  </span>
                )}
              </div>
            </div>

            <div className="collab-modal-body">
              <div className="profile-row collab-profile-row">
                <span className="profile-icon" aria-hidden="true"><FaEnvelope size={16} /></span>
                <a className="profile-val link-primary-underline" href={`mailto:${selected.email}`}>
                  {selected.email}
                </a>
              </div>

              <div className="profile-row collab-profile-row">
                <span className="profile-icon" aria-hidden="true"><FaWhatsapp size={16} /></span>
                {selected.telefone ? (
                  <a
                    className="profile-val link-primary-underline"
                    href={toWhatsappHref(selected.telefone)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {selected.telefone}
                  </a>
                ) : (
                  <span className="profile-val">-</span>
                )}
              </div>

              {selected.redes?.instagram && (
                <div className="profile-row collab-profile-row">
                  <span className="profile-icon" aria-hidden="true"><FaInstagram size={16} /></span>
                  <a
                    className="profile-val link-primary-underline"
                    href={toInstagramHref(selected.redes.instagram)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    @{String(selected.redes.instagram).replace(/^@+/, "")}
                  </a>
                </div>
              )}

              {selected.redes?.linkedin && (
                <div className="profile-row collab-profile-row">
                  <span className="profile-icon" aria-hidden="true"><FaLinkedin size={16} /></span>
                  <a
                    className="profile-val link-primary-underline"
                    href={toLinkedinHref(selected.redes.linkedin)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {selected.redes.linkedin}
                  </a>
                </div>
              )}

              {selected.redes?.github && (
                <div className="profile-row collab-profile-row">
                  <span className="profile-icon">GH</span>
                  <span className="profile-val">{selected.redes.github}</span>
                </div>
              )}

              {signo && (
                <div className="profile-row collab-profile-row">
                  <span className="profile-icon" aria-hidden="true">{signo.emoji}</span>
                  <div className="collab-signo-content">
                    <span className="profile-val" style={{ color: "var(--text)" }}>
                      {signo.nome}
                    </span>
                    <a className="profile-val link-primary-underline collab-signo-link" href={signoHref} target="_blank" rel="noreferrer">
                      Como são as pessoas desse signo
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: "0 24px 20px" }}>
              <button className="btn-ghost btn-full btn-collab-close" onClick={() => setSelected(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
