import { useState } from "react";
import { Modal } from "@heroui/react";
import {
  ArrowUpRight,
  Building2,
  Cake,
  Briefcase,
  HeartPulse,
  IdCard,
  Landmark,
  Lock,
  Mail,
  PhoneCall,
  Droplet,
} from "lucide-react";
import { Avatar } from "../components/Avatar";
import { SkeletonCollabCard } from "../components/Skeleton";
import { FaInstagram, FaLinkedin, FaWhatsapp, FaEnvelope, FaGithub } from "react-icons/fa6";
import { useColaboradores } from "../hooks/queries/useColaboradores.js";
import { useColaboradorDados } from "../hooks/queries/useColaboradorDados.js";
import { getZodiacInfo } from "../lib/zodiac";
import { temModulo } from "../lib/permissoes.js";

const formatDataBR = (iso) => {
  if (!iso) return "";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR");
};

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

/**
 * Monta os blocos do modal de perfil. Cada item so entra na lista se tiver
 * valor, e cada bloco so e renderizado se sobrar algum item -- e o que evita o
 * modal virar uma coluna de dezenas de linhas com "-" quando o RH ainda nao
 * preencheu tudo (o motivo de ele estar fino e comprido antes).
 *
 * `rh` chega null para quem nao tem o modulo colaboradores, entao os blocos
 * sensiveis simplesmente nao existem -- nao e ocultacao via CSS.
 */
const construirSecoes = (col, signo, signoHref, rh) => {
  const secoes = [
    {
      id: "contato",
      titulo: "Contato",
      itens: [
        { id: "email", icon: <FaEnvelope size={15} />, label: "E-mail", value: col.email, href: `mailto:${col.email}` },
        { id: "tel", icon: <FaWhatsapp size={15} />, label: "WhatsApp", value: col.telefone, href: toWhatsappHref(col.telefone) },
        {
          id: "insta",
          icon: <FaInstagram size={15} />,
          label: "Instagram",
          value: col.redes?.instagram ? `@${String(col.redes.instagram).replace(/^@+/, "")}` : "",
          href: toInstagramHref(col.redes?.instagram),
        },
        { id: "in", icon: <FaLinkedin size={15} />, label: "LinkedIn", value: col.redes?.linkedin, href: toLinkedinHref(col.redes?.linkedin) },
        { id: "gh", icon: <FaGithub size={15} />, label: "GitHub", value: col.redes?.github },
        {
          id: "signo",
          icon: <span className="collab-info-emoji">{signo?.emoji}</span>,
          label: "Signo",
          value: signo?.nome,
          hintHref: signoHref,
          hintLabel: "Como são as pessoas desse signo",
        },
      ],
    },
  ];

  if (rh) {
    secoes.push(
      {
        id: "rh-identificacao",
        titulo: "Identificação",
        restrito: true,
        itens: [
          { id: "nome", icon: <IdCard size={15} />, label: "Nome completo", value: rh.nomeCompleto },
          { id: "nasc", icon: <Cake size={15} />, label: "Nascimento", value: formatDataBR(rh.dataNascimento) },
          { id: "adm", icon: <Briefcase size={15} />, label: "Admissão", value: formatDataBR(rh.dataAdmissao) },
          { id: "rg", icon: <IdCard size={15} />, label: "RG", value: rh.rg },
          { id: "cpf", icon: <IdCard size={15} />, label: "CPF", value: rh.cpf },
          { id: "mail-pessoal", icon: <Mail size={15} />, label: "E-mail pessoal", value: rh.emailPessoal },
          { id: "mail-pan", icon: <Mail size={15} />, label: "E-mail PAN", value: rh.emailPan },
        ],
      },
      {
        id: "rh-financeiro",
        titulo: "Financeiro",
        restrito: true,
        itens: [
          { id: "cnpj", icon: <Building2 size={15} />, label: "CNPJ", value: rh.cnpj },
          { id: "ag", icon: <Landmark size={15} />, label: "Agência", value: rh.bancoAgencia },
          { id: "conta", icon: <Landmark size={15} />, label: "Conta", value: rh.bancoConta },
          { id: "pix", icon: <Landmark size={15} />, label: "Chave Pix", value: rh.bancoPix },
        ],
      },
      {
        id: "rh-saude",
        titulo: "Saúde e emergência",
        restrito: true,
        itens: [
          {
            id: "plano",
            icon: <HeartPulse size={15} />,
            label: "Plano de saúde",
            value: rh.planoSaude ? rh.planoSaudeQual || "Sim" : "Não",
          },
          { id: "sangue", icon: <Droplet size={15} />, label: "Tipo sanguíneo", value: rh.tipoSanguineo },
          {
            id: "emergencia",
            icon: <PhoneCall size={15} />,
            label: "Contato de emergência",
            value: [rh.emergenciaNome, rh.emergenciaTelefone].filter(Boolean).join(" · "),
          },
        ],
      }
    );
  }

  return secoes
    .map((s) => ({ ...s, itens: s.itens.filter((i) => i.value) }))
    .filter((s) => s.itens.length > 0);
};

function InfoItem({ icon, label, value, href, hintHref, hintLabel }) {
  const externo = href && !href.startsWith("mailto:");
  return (
    <div className="collab-info">
      <span className="collab-info-icon" aria-hidden="true">{icon}</span>
      <div className="collab-info-text">
        <span className="collab-info-label">{label}</span>
        {href ? (
          <a
            className="collab-info-value link-primary-underline"
            href={href}
            target={externo ? "_blank" : undefined}
            rel={externo ? "noreferrer" : undefined}
          >
            {value}
          </a>
        ) : (
          <span className="collab-info-value">{value}</span>
        )}
        {hintHref && (
          <a className="collab-info-hint link-primary-underline" href={hintHref} target="_blank" rel="noreferrer">
            {hintLabel}
          </a>
        )}
      </div>
    </div>
  );
}

export function ColaboradoresPage({ currentUserId, currentProfile }) {
  const colaboradoresQuery = useColaboradores(currentUserId);
  const colaboradores = colaboradoresQuery.data || [];
  const [selected, setSelected] = useState(null);
  const signo = getZodiacInfo(selected?.aniversario);
  const signoHref = signo
    ? `https://www.google.com/search?q=${encodeURIComponent(`como são as pessoas do signo de ${signo.nome}`)}`
    : "";

  // Sem o modulo colaboradores, NENHUMA requisicao a colaboradores_dados sai
  // do browser -- o enabled controla isso, nao e so ocultacao de UI. A RLS no
  // banco e quem decide de verdade o que a API devolve; isto so evita gastar
  // uma request que a RLS ia zerar mesmo.
  const podeVerRh = temModulo(currentProfile, "colaboradores");
  const rhQuery = useColaboradorDados(selected?.id, { enabled: podeVerRh && !!selected });
  const rh = rhQuery.data;
  const secoes = selected ? construirSecoes(selected, signo, signoHref, podeVerRh ? rh : null) : [];

  return (
    <div className="fade-up">
      {colaboradoresQuery.isError && (
        <div className="pan-card" style={{ marginBottom: 14 }}>
          <div className="card-body">
            <div className="section-title" style={{ fontSize: 16 }}>Falha ao carregar colaboradores</div>
            <div className="section-sub">{colaboradoresQuery.error?.message || "Não foi possível carregar os dados agora."}</div>
          </div>
        </div>
      )}
      <div className="section-header">
        <div>
          <div className="section-title">Colaboradores</div>
          <div className="section-sub">{colaboradores.length} pessoas no time</div>
        </div>
      </div>

      {colaboradoresQuery.isLoading && colaboradores.length === 0 ? (
        <div className="grid-4">
          {Array.from({ length: 8 }, (_, i) => <SkeletonCollabCard key={i} />)}
        </div>
      ) : (
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
      )}
      {!colaboradoresQuery.isLoading && colaboradores.length === 0 && (
        <div className="empty-state">Nenhum colaborador encontrado.</div>
      )}

      {selected && (
        <Modal.Backdrop
          isOpen
          variant="blur"
          onOpenChange={(aberto) => {
            if (!aberto) setSelected(null);
          }}
        >
          <Modal.Container scroll="inside">
            <Modal.Dialog
              aria-label={`Perfil de ${selected.nome}`}
              className="collab-modal collab-modal--perfil"
              style={{ border: "1px solid var(--border)", padding: 0, maxWidth: 720 }}
            >
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
              {secoes.map((secao) => (
                <section key={secao.id} className={secao.restrito ? "collab-section collab-section--restrito" : "collab-section"}>
                  <h3 className="collab-section-title">
                    {secao.restrito && <Lock size={13} aria-hidden="true" />}
                    {secao.titulo}
                    {secao.restrito && <span className="collab-section-tag">RH</span>}
                  </h3>
                  <div className="collab-info-grid">
                    {secao.itens.map((item) => <InfoItem key={item.id} {...item} />)}
                  </div>
                </section>
              ))}
            </div>

            <div style={{ padding: "0 24px 20px" }}>
              <button className="btn-ghost btn-full btn-collab-close" onClick={() => setSelected(null)}>
                Fechar
              </button>
            </div>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      )}
    </div>
  );
}
