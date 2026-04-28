const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfLocalDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);

const endOfLocalDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

export const isSameCalendarDay = (left, right) =>
  left?.getDate?.() === right?.getDate?.() &&
  left?.getMonth?.() === right?.getMonth?.() &&
  left?.getFullYear?.() === right?.getFullYear?.();

export const getAusenciaDiaTodoReturnDate = (item) => {
  if (!item?.diaTodo) return null;

  const inicio = toDate(item.inicio);
  const fim = toDate(item.fim);

  if (!inicio || !fim || isSameCalendarDay(inicio, fim)) return null;
  return startOfLocalDay(fim);
};

export const isAusenciaSingleFullDayWindow = (item) => {
  if (!item || item.diaTodo) return false;

  const inicio = toDate(item.inicio);
  const fim = toDate(item.fim);

  if (!inicio || !fim || isSameCalendarDay(inicio, fim)) return false;

  const sameTime =
    inicio.getHours() === fim.getHours() &&
    inicio.getMinutes() === fim.getMinutes();

  if (!sameTime) return false;

  const diffDays =
    (startOfLocalDay(fim).getTime() - startOfLocalDay(inicio).getTime()) /
    (1000 * 60 * 60 * 24);

  return diffDays === 1;
};

export const getAusenciaEffectiveEnd = (item) => {
  if (!item?.diaTodo) {
    // Ausência por horário: usa fim direto se disponível
    const fim = toDate(item?.fim);
    if (fim) return fim;
    // Sem previsão de retorno: expira ao final do dia de início
    const inicio = toDate(item?.inicio);
    return inicio ? endOfLocalDay(inicio) : null;
  }

  // diaTodo = true: ausência de dia inteiro
  const inicio = toDate(item?.inicio);
  if (!inicio) return null;

  const fim = toDate(item?.fim);

  // Sem fim ou mesmo dia → ausência de um dia só: encerra ao fim do dia de início
  if (!fim || isSameCalendarDay(inicio, fim)) {
    return endOfLocalDay(inicio);
  }

  // Multi-dia: fim é a data de retorno → encerra na meia-noite desse dia
  return startOfLocalDay(fim);
};
