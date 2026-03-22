import {
  getAusenciaDiaTodoReturnDate,
  isAusenciaSingleFullDayWindow,
  isSameCalendarDay,
} from "./ausencias.js";

export const parseBrDate = (brDate) => {
  const [day, month, year] = String(brDate || "").split("/").map(Number);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day, 12, 0, 0);
};

export const getFeriasStatusByDate = (item, referenceDate = new Date()) => {
  if (!item) return "marcado";
  if (item.status === "em_andamento") return "em_andamento";

  const inicioDate = parseBrDate(item.inicio);
  const fimDate = parseBrDate(item.fim || item.inicio);
  if (!inicioDate || !fimDate) return item.status || "marcado";

  const todayNoon = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    12,
    0,
    0
  );
  return todayNoon >= inicioDate && todayNoon <= fimDate
    ? "em_andamento"
    : item.status || "marcado";
};

export const getPeriodoFolgaLabel = (item) => {
  const inicio = item?.inicio || "";
  const fim = item?.fim || item?.inicio || "";

  const toDayMonth = (brDate) => {
    const [day, month] = String(brDate || "").split("/");
    if (!day || !month) return String(brDate || "");
    return `${day}/${month}`;
  };

  if (!inicio) return "";
  if (!fim || inicio === fim) return toDayMonth(inicio);
  return `${toDayMonth(inicio)} a ${toDayMonth(fim)}`;
};

const formatPanoffDate = (date, variant = "day-month") =>
  date?.toLocaleDateString?.(
    "pt-BR",
    variant === "full-date"
      ? { day: "2-digit", month: "2-digit", year: "numeric" }
      : { day: "2-digit", month: "2-digit" }
  ) || "";

const formatPanoffTime = (date) =>
  date?.toLocaleTimeString?.("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }) || "";

export const getAusenciaMeta = (item, { dateVariant = "day-month" } = {}) => {
  if (!item?.inicio) return { dateLabel: "", timeLabel: "" };

  const inicio = new Date(item.inicio);
  const fim = item.fim ? new Date(item.fim) : null;
  if (Number.isNaN(inicio.getTime())) return { dateLabel: "", timeLabel: "" };

  const now = new Date();
  const hasFimValido = fim && !Number.isNaN(fim.getTime());
  const crossesDays = hasFimValido && !isSameCalendarDay(inicio, fim);
  const isToday = isSameCalendarDay(inicio, now);

  if (item.diaTodo) {
    const retorno = getAusenciaDiaTodoReturnDate(item);
    return {
      dateLabel: retorno
        ? `${formatPanoffDate(inicio, dateVariant)} · volta ${formatPanoffDate(retorno, dateVariant)}`
        : formatPanoffDate(inicio, dateVariant),
      timeLabel: "",
    };
  }

  if (isAusenciaSingleFullDayWindow(item)) {
    return {
      dateLabel: `${formatPanoffDate(inicio, dateVariant)} · dia todo`,
      timeLabel: "",
    };
  }

  if (crossesDays) {
    return {
      dateLabel: "",
      timeLabel: `${formatPanoffDate(inicio, dateVariant)} ${formatPanoffTime(inicio)} → ${formatPanoffDate(
        fim,
        dateVariant
      )} ${formatPanoffTime(fim)}`,
    };
  }

  return {
    dateLabel: !isToday ? formatPanoffDate(inicio, dateVariant) : "",
    timeLabel: hasFimValido
      ? `${formatPanoffTime(inicio)} às ${formatPanoffTime(fim)}`
      : `${formatPanoffTime(inicio)} · sem previsão`,
  };
};

export const getAusenciaMobileMeta = (item, meta) => {
  if (!meta?.dateLabel && !meta?.timeLabel) {
    return { label: "", icon: "calendar", isTime: false };
  }

  const inicio = item?.inicio ? new Date(item.inicio) : null;
  const fim = item?.fim ? new Date(item.fim) : null;
  const hasFimValido = fim && !Number.isNaN(fim.getTime());
  const crossesDays =
    inicio && !Number.isNaN(inicio.getTime()) && hasFimValido && !isSameCalendarDay(inicio, fim);

  if (meta.dateLabel && meta.timeLabel) {
    return {
      label: `${meta.dateLabel} ${meta.timeLabel}`,
      icon: "calendar",
      isTime: false,
    };
  }

  if (meta.dateLabel) {
    return {
      label: meta.dateLabel,
      icon: "calendar",
      isTime: false,
    };
  }

  return {
    label: meta.timeLabel,
    icon: crossesDays ? "calendar" : "clock",
    isTime: !crossesDays,
  };
};
