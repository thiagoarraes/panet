export const formatDateForStore = (date) => {
  if (!date || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const parseLocalDateTime = (value) => {
  if (!value) return null;
  const [datePart, timePart = "00:00"] = String(value).split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);
  if (!year || !month || !day || Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
};

export const formatDateTimeForStore = (date) => {
  if (!date || Number.isNaN(date.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
};

export const getLocalDatePart = (value) => String(value || "").split("T")[0] || "";

export const getLocalTimePart = (value) => {
  const [, timePart = ""] = String(value || "").split("T");
  return timePart.slice(0, 5);
};

export const combineLocalDateAndTime = (datePart, timePart = "00:00") => {
  if (!datePart) return "";
  return `${datePart}T${timePart || "00:00"}`;
};

export const AUSENCIA_TIME_OPTIONS = Array.from({ length: 96 }, (_, index) => {
  const totalMinutes = index * 15;
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
});

export const formatAusenciaValueForForm = (isoString, diaTodo = false) => {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  return diaTodo ? formatDateForStore(date) : formatDateTimeForStore(date);
};

export const localDateToIsoBoundary = (localStr, boundary = "start") => {
  if (!localStr) return null;
  const date = parseLocalDateTime(localStr);
  if (!date || Number.isNaN(date.getTime())) return null;
  const normalized = new Date(date);
  if (boundary === "end") {
    normalized.setHours(23, 59, 59, 999);
  } else {
    normalized.setHours(0, 0, 0, 0);
  }
  return normalized.toISOString();
};

export const localToIso = (localStr) => {
  if (!localStr) return null;
  const date = parseLocalDateTime(localStr);
  return !date || Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const compareLocalDateTime = (leftValue, rightValue) => {
  const left = parseLocalDateTime(leftValue);
  const right = parseLocalDateTime(rightValue);
  if (!left || !right) return null;
  return right.getTime() - left.getTime();
};

export const getAusenciaFormComputed = (form = {}) => {
  const inicioDate = parseLocalDateTime(form.inicio);
  const retornoDate = parseLocalDateTime(form.fim);
  const inicioDatePart = getLocalDatePart(form.inicio);
  const inicioTimePart = getLocalTimePart(form.inicio);
  const retornoDatePart = getLocalDatePart(form.fim);
  const retornoTimePart = getLocalTimePart(form.fim);
  const retornoDiff = compareLocalDateTime(form.inicio, form.fim);
  const retornoObrigatorio = form.tipoTempo === "especifico" && !form.fim;
  const retornoInvalido =
    form.tipoTempo === "especifico" &&
    retornoDiff !== null &&
    (form.diaTodo ? retornoDiff < 0 : retornoDiff <= 0);

  return {
    inicioDate,
    retornoDate,
    inicioDatePart,
    inicioTimePart,
    retornoDatePart,
    retornoTimePart,
    retornoDiff,
    retornoObrigatorio,
    retornoInvalido,
  };
};

export const toggleAusenciaDiaTodoForm = (form, checked) => {
  const inicioDate = parseLocalDateTime(form?.inicio);
  const fimDate = parseLocalDateTime(form?.fim);

  return {
    ...form,
    diaTodo: checked,
    inicio: inicioDate ? (checked ? formatDateForStore(inicioDate) : formatDateTimeForStore(inicioDate)) : "",
    fim: fimDate ? (checked ? formatDateForStore(fimDate) : formatDateTimeForStore(fimDate)) : form?.fim || "",
  };
};
