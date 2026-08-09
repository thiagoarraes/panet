import { Home, FileText, Users, Cake, Plane, Images, CalendarDays, Gamepad2, KeyRound } from "lucide-react";
import { extractPostSlugFromPathname } from "./postRouting.js";

export const NAV_ITEMS = [
  { id: "dashboard",   label: "Dashboard",          icon: Home },
  { id: "postagens",   label: "PanNews",             icon: FileText },
  { id: "colaboradores", label: "Colaboradores",     icon: Users },
  { id: "aniversarios", label: "Aniversários",       icon: Cake },
  { id: "ferias",      label: "PanOff",              icon: Plane },
  { id: "presencial",  label: "Eventos",             icon: CalendarDays },
  { id: "galeria",     label: "Galerias",            icon: Images },
  { id: "jogos",       label: "Jogos",               icon: Gamepad2 },
  { id: "panpass",     label: "PanPass",             icon: KeyRound },
];

export const PAGE_PATHS = {
  dashboard:  "/",
  postagens:  "/pannews",
  colaboradores: "/colaboradores",
  aniversarios:  "/aniversarios",
  ferias:     "/folgas",
  presencial: "/eventos",
  galeria:    "/galerias",
  jogos:      "/jogos",
  panpass:    "/panpass",
  perfil:     "/perfil",
  admin:      "/admin",
};

export const ADMIN_TAB_PATHS = {
  colaboradores: "/admin/colaboradores",
  postagens:     "/admin/pannews",
  ferias:        "/admin/folgas",
  presencial:    "/admin/eventos",
  galeria:       "/admin/galeria",
  enquetes:      "/admin/enquetes",
  corridas:      "/admin/corridas",
  panpass:       "/admin/panpass",
};

export const resolveRoute = (pathname) => {
  const path = String(pathname || "/");
  if (path.startsWith("/galerias/")) {
    return { pagina: "galeria", adminAba: "colaboradores", known: true };
  }
  switch (path) {
    case "/":
    case "/dashboard":
      return { pagina: "dashboard", adminAba: "colaboradores", known: true };
    case "/pannews":
    case "/posts":
    case "/post":
      return { pagina: "postagens", adminAba: "colaboradores", known: true };
    case "/colaboradores":
      return { pagina: "colaboradores", adminAba: "colaboradores", known: true };
    case "/aniversarios":
      return { pagina: "aniversarios", adminAba: "colaboradores", known: true };
    case "/folgas":
      return { pagina: "ferias", adminAba: "colaboradores", known: true };
    case "/eventos":
    case "/confirmar-presenca":
      return { pagina: "presencial", adminAba: "colaboradores", known: true };
    case "/galerias":
    case "/galeria":
      return { pagina: "galeria", adminAba: "colaboradores", known: true };
    case "/jogos":
      return { pagina: "jogos", adminAba: "colaboradores", known: true };
    case "/panpass":
      return { pagina: "panpass", adminAba: "colaboradores", known: true };
    case "/perfil":
      return { pagina: "perfil", adminAba: "colaboradores", known: true };
    case "/admin":
      return { pagina: "admin", adminAba: "postagens", known: true };
    case "/admin/colaboradores":
      return { pagina: "admin", adminAba: "colaboradores", known: true };
    case "/admin/pannews":
    case "/admin/posts":
      return { pagina: "admin", adminAba: "postagens", known: true };
    case "/admin/folgas":
      return { pagina: "admin", adminAba: "ferias", known: true };
    case "/admin/eventos":
    case "/admin/confirmar-presenca":
      return { pagina: "admin", adminAba: "presencial", known: true };
    case "/admin/galeria":
      return { pagina: "admin", adminAba: "galeria", known: true };
    case "/admin/enquetes":
      return { pagina: "admin", adminAba: "enquetes", known: true };
    case "/admin/corridas":
      return { pagina: "admin", adminAba: "corridas", known: true };
    case "/admin/panpass":
      return { pagina: "admin", adminAba: "panpass", known: true };
    default:
      break;
  }
  const slug = extractPostSlugFromPathname(path);
  if (slug) {
    return { pagina: "post_detalhe", adminAba: "colaboradores", known: true, postSlug: slug };
  }
  return { pagina: "dashboard", adminAba: "colaboradores", known: false };
};
