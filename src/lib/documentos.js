/**
 * Mascara e validacao de documentos brasileiros. O banco guarda CPF/CNPJ so
 * com digitos (ver check constraint em colaboradores_dados); mascara e
 * validacao de digito verificador sao responsabilidade desta camada.
 */

export const soDigitos = (valor) => String(valor || "").replace(/\D/g, "");

/** Aplica a mascara 000.000.000-00 progressivamente, enquanto o usuario digita. */
export const formatCpf = (valor) => {
  const d = soDigitos(valor).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

/** Aplica a mascara 00.000.000/0000-00 progressivamente. */
export const formatCnpj = (valor) => {
  const d = soDigitos(valor).slice(0, 14);
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};

/** Aplica a mascara 00000-000 progressivamente. */
export const formatCep = (valor) => {
  const d = soDigitos(valor).slice(0, 8);
  return d.replace(/(\d{5})(\d{1,3})$/, "$1-$2");
};

/** Aceita fixo (00) 0000-0000 e celular (00) 00000-0000. */
export const formatTelefone = (valor) => {
  const d = soDigitos(valor).slice(0, 11);
  if (d.length <= 10) {
    return d
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return d
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
};

/**
 * Digito verificador de CPF (modulo 11, dois digitos). Rejeita sequencias
 * repetidas (111.111.111-11 etc), que passariam num check so de formato.
 */
export const isCpfValido = (valor) => {
  const d = soDigitos(valor);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;

  const calcDigito = (base) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const d1 = calcDigito(d.slice(0, 9));
  const d2 = calcDigito(d.slice(0, 9) + d1);
  return d.slice(9) === `${d1}${d2}`;
};

/** Digito verificador de CNPJ (modulo 11, pesos proprios, dois digitos). */
export const isCnpjValido = (valor) => {
  const d = soDigitos(valor);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;

  const calcDigito = (base, pesos) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * pesos[i];
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calcDigito(d.slice(0, 12), pesos1);
  const d2 = calcDigito(d.slice(0, 12) + d1, pesos2);
  return d.slice(12) === `${d1}${d2}`;
};
