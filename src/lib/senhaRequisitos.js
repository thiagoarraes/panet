// Requisitos de senha do primeiro acesso.
//
// Fonte unica: alimenta o checklist que a tela mostra em tempo real E a
// validacao do submit. Antes as duas coisas viviam separadas no componente e a
// barra de "forca" media so comprimento -- "Grunge775" pintava 4/4 barras
// verdes com "Boa forca" e mesmo assim era recusada por falta de caractere
// especial. Mantenha as duas usando esta lista.

export const REQUISITOS_SENHA = [
  { id: "tamanho", label: "Pelo menos 8 caracteres", teste: (s) => s.length >= 8 },
  { id: "minuscula", label: "Uma letra minúscula (a-z)", teste: (s) => /[a-z]/.test(s) },
  { id: "maiuscula", label: "Uma letra maiúscula (A-Z)", teste: (s) => /[A-Z]/.test(s) },
  { id: "numero", label: "Um número (0-9)", teste: (s) => /[0-9]/.test(s) },
  { id: "especial", label: "Um caractere especial (!@#$%…)", teste: (s) => /[^A-Za-z0-9]/.test(s) },
];

export const requisitosPendentes = (senha) =>
  REQUISITOS_SENHA.filter((r) => !r.teste(String(senha ?? "")));

export const senhaValida = (senha) => requisitosPendentes(senha).length === 0;
