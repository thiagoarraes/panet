const safeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

export const isEnqueteEncerrada = (enquete, referenceDate = new Date()) => {
  if (!enquete) return true;
  if (enquete.encerradaEm) return true;
  const encerraEmDate = safeDate(enquete.encerraEm);
  if (!encerraEmDate) return false;
  return encerraEmDate.getTime() <= referenceDate.getTime();
};

export const formatEnqueteDateTime = (value) => {
  const date = safeDate(value);
  if (!date) return "";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

export const formatEnqueteDate = (value) => {
  const date = safeDate(value);
  if (!date) return "";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export const toDatetimeLocalValue = (isoValue) => {
  const date = safeDate(isoValue);
  if (!date) return "";
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  const localDate = new Date(date.getTime() - offsetMs);
  return localDate.toISOString().slice(0, 16);
};

export const fromDatetimeLocalValue = (localValue) => {
  const normalized = String(localValue || "").trim();
  if (!normalized) return null;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

export const buildEnqueteResult = ({ enquete, opcoes, votos, currentUserId }) => {
  const safeOpcoes = Array.isArray(opcoes) ? opcoes : [];
  const safeVotos = Array.isArray(votos) ? votos : [];
  const totalVotes = safeVotos.length;
  const votesByOption = safeVotos.reduce((acc, vote) => {
    const optionId = String(vote?.enquete_opcao_id || "");
    if (!optionId) return acc;
    acc.set(optionId, (acc.get(optionId) || 0) + 1);
    return acc;
  }, new Map());

  const normalizedOptions = safeOpcoes
    .slice()
    .sort((a, b) => Number(a?.ordem || 0) - Number(b?.ordem || 0))
    .map((option, index) => {
      const optionId = String(option?.id || "");
      const votes = votesByOption.get(optionId) || 0;
      const percent = totalVotes > 0 ? Math.round((votes * 100) / totalVotes) : 0;
      return {
        id: optionId || `opcao-${index}`,
        text: String(option?.texto || "").trim(),
        order: Number(option?.ordem || index + 1),
        votes,
        percent,
      };
    });

  const userVote = safeVotos.find((vote) => String(vote?.colaborador_id || "") === String(currentUserId || ""));
  const userVoteOptionId = userVote?.enquete_opcao_id ? String(userVote.enquete_opcao_id) : null;

  return {
    id: enquete?.id || "",
    question: String(enquete?.pergunta || "").trim(),
    showPartial: Boolean(enquete?.mostrarResultadoParcial),
    endsAt: enquete?.encerraEm || null,
    closedAt: enquete?.encerradaEm || null,
    isClosed: isEnqueteEncerrada(enquete),
    totalVotes,
    options: normalizedOptions,
    userVoteOptionId,
    hasVoted: Boolean(userVoteOptionId),
  };
};
