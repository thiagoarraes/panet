// Copia texto para a area de transferencia, com fallback.
//
// `navigator.clipboard.writeText` existir nao significa que ela funciona: o
// navegador rejeita com NotAllowedError quando o documento nao esta focado,
// quando a permissao clipboard-write esta negada ou em contexto nao seguro.
// Os dois chamadores antigos so caiam no fallback quando a API estava
// AUSENTE, nunca quando ela falhava -- por isso o botao "Copiar senha" do
// admin mostrava erro e o do PanPass nao fazia absolutamente nada (a promise
// rejeitada nem era capturada).
//
// Retorna true se copiou, false se nao deu. Nunca lanca: quem chama decide o
// que mostrar.
export async function copiarTexto(texto) {
  const valor = String(texto ?? "");
  if (!valor) return false;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(valor);
      return true;
    }
  } catch {
    // Cai no fallback abaixo.
  }

  // execCommand e obsoleto, mas continua funcionando em casos que a API
  // rejeita -- e e sincrono, entao aproveita o gesto do usuario.
  try {
    const textarea = document.createElement("textarea");
    textarea.value = valor;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, valor.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return Boolean(ok);
  } catch {
    return false;
  }
}
