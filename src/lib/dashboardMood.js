export const MAX_MOOD_TAGS = 4;
export const MOOD_STORAGE_KEY = "panet:dashboard-mood:v1";

export const MOOD_OPTIONS = [
  {
    id: "rocket",
    emoji: "🚀",
    label: "Foguete",
    vibe: "ritmo alto",
    accent: "#11E7E7",
    soft: "rgba(17, 231, 231, 0.16)",
  },
  {
    id: "flow",
    emoji: "🌊",
    label: "Em fluxo",
    vibe: "produção fluida",
    accent: "#34D3C5",
    soft: "rgba(52, 211, 197, 0.16)",
  },
  {
    id: "zen",
    emoji: "🌿",
    label: "Zen",
    vibe: "dia leve",
    accent: "#56D364",
    soft: "rgba(86, 211, 100, 0.16)",
  },
  {
    id: "focus",
    emoji: "🎯",
    label: "No foco",
    vibe: "imersão total",
    accent: "#5B8DEF",
    soft: "rgba(91, 141, 239, 0.16)",
  },
  {
    id: "steady",
    emoji: "🙂",
    label: "Constante",
    vibe: "sem picos",
    accent: "#7A9AB8",
    soft: "rgba(122, 154, 184, 0.16)",
  },
  {
    id: "storm",
    emoji: "🌪️",
    label: "Caótico",
    vibe: "muita frente aberta",
    accent: "#FFA032",
    soft: "rgba(255, 160, 50, 0.16)",
  },
  {
    id: "low",
    emoji: "🌧️",
    label: "Baixa energia",
    vibe: "pedindo respiro",
    accent: "#C478E8",
    soft: "rgba(196, 120, 232, 0.16)",
  },
  {
    id: "fire",
    emoji: "🔥",
    label: "No limite",
    vibe: "dia intenso",
    accent: "#E84B7A",
    soft: "rgba(232, 75, 122, 0.16)",
  },
];

export const MOOD_TAGS = [
  "Reunião demais",
  "Criativo hoje",
  "Cansado",
  "Inspirado",
  "Com fome",
  "Tomei café",
  "Sem café",
  "Deadline próximo",
  "Bom humor",
  "Estressado",
  "Ouvindo música",
  "Modo silencioso",
  "Querendo sexta",
  "Com ideia nova",
  "Atrasado nos tasks",
];
const ALLOWED_MOOD_TAGS = new Set(MOOD_TAGS);

export const ENERGY_GLYPHS = ["🪫", "😵", "😮‍💨", "🙂", "👌", "⚡", "🚀", "🔥", "☀️", "💥"];
export const ENERGY_TEXTS = [
  "Muito baixa",
  "Arrastada",
  "Recuperando",
  "Estável",
  "Boa",
  "Ativa",
  "Animada",
  "Energizada",
  "Radiante",
  "Explosiva",
];
export const ENERGY_COLORS = [
  "#E84B4B",
  "#F06743",
  "#F58A3D",
  "#FFAA33",
  "#D9D84A",
  "#A9DC57",
  "#7ED957",
  "#56D364",
  "#34D3A2",
  "#00A86B",
];

const pad = (value) => String(value).padStart(2, "0");

export function getLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function clampEnergy(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 5;
  return Math.min(10, Math.max(1, Math.round(parsed)));
}

export function normalizeMoodTags(tags) {
  const unique = Array.from(
    new Set(
      (Array.isArray(tags) ? tags : [])
        .map((tag) => String(tag || "").trim())
        .filter((tag) => Boolean(tag) && ALLOWED_MOOD_TAGS.has(tag))
    )
  );
  return unique.slice(0, MAX_MOOD_TAGS);
}

export function getMoodOption(moodId) {
  return MOOD_OPTIONS.find((option) => option.id === moodId) || MOOD_OPTIONS.find((option) => option.id === "steady");
}

export function normalizeMoodEntry(entry) {
  const mood = getMoodOption(entry?.moodId || entry?.humor_id || entry?.mood_id);
  const dateKey = String(entry?.dateKey || entry?.data_ref || getLocalDateKey());
  const createdAt = String(entry?.createdAt || entry?.created_at || "");
  const updatedAt = String(entry?.updatedAt || entry?.updated_at || createdAt || "");

  return {
    id: entry?.id || `mood-${entry?.colaboradorId || entry?.colaborador_id || "local"}-${dateKey}`,
    colaboradorId: entry?.colaboradorId ?? entry?.colaborador_id ?? null,
    moodId: mood.id,
    energy: clampEnergy(entry?.energy ?? entry?.energia),
    tags: normalizeMoodTags(entry?.tags),
    dateKey,
    createdAt,
    updatedAt,
    pending: Boolean(entry?.pending),
  };
}

export function sortMoodEntries(entries) {
  return [...(Array.isArray(entries) ? entries : [])].sort((left, right) => {
    const leftTime = new Date(left?.updatedAt || left?.createdAt || 0).getTime();
    const rightTime = new Date(right?.updatedAt || right?.createdAt || 0).getTime();
    const safeLeftTime = Number.isFinite(leftTime) ? leftTime : 0;
    const safeRightTime = Number.isFinite(rightTime) ? rightTime : 0;
    return safeRightTime - safeLeftTime;
  });
}

export function upsertMoodEntry(entries, nextEntry) {
  const normalizedEntry = normalizeMoodEntry(nextEntry);
  const baseList = Array.isArray(entries) ? entries.map(normalizeMoodEntry) : [];
  const filtered = baseList.filter((item) => {
    const sameId = String(item.id) === String(normalizedEntry.id);
    const samePersonDay =
      String(item.colaboradorId) === String(normalizedEntry.colaboradorId) &&
      String(item.dateKey) === String(normalizedEntry.dateKey);
    return !sameId && !samePersonDay;
  });
  return sortMoodEntries([normalizedEntry, ...filtered]);
}

export function getEnergyLabel(energy) {
  return ENERGY_TEXTS[clampEnergy(energy) - 1];
}

export function getEnergyGlyph(energy) {
  return ENERGY_GLYPHS[clampEnergy(energy) - 1];
}

export function getEnergyColor(energy) {
  return ENERGY_COLORS[clampEnergy(energy) - 1];
}

export function getAverageEnergy(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return 0;
  const total = entries.reduce((sum, entry) => sum + clampEnergy(entry?.energy), 0);
  return Number((total / entries.length).toFixed(1));
}
