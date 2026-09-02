import { Home, FileText, Users, Cake, Plane, Images, CalendarDays, Gamepad2, KeyRound } from "lucide-react";

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
