export const getZodiacInfo = (isoDate) => {
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
