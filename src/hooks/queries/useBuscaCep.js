import { useState } from "react";
import { soDigitos } from "../../lib/documentos.js";

/**
 * Busca endereco por CEP via ViaCEP (publica, sem chave, e o servico padrao
 * de mercado para isso no Brasil). Fica isolado num hook -- e a unica chamada
 * de rede a um servico externo neste modal -- para o componente so lidar com
 * o resultado, nao com fetch/estado de loading manual.
 *
 * Nao ha cache/query aqui de proposito: e uma busca pontual disparada no blur
 * do campo, nao um dado que se repete entre renders.
 */
export function useBuscaCep() {
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState("");

  const buscar = async (cepDigitado) => {
    const cep = soDigitos(cepDigitado);
    if (cep.length !== 8) return null;

    setBuscando(true);
    setErro("");
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!resp.ok) throw new Error("Falha ao consultar o CEP.");
      const data = await resp.json();
      if (data.erro) {
        setErro("CEP não encontrado.");
        return null;
      }
      return {
        logradouro: data.logradouro || "",
        bairro: data.bairro || "",
        cidade: data.localidade || "",
        uf: data.uf || "",
      };
    } catch {
      setErro("Não foi possível consultar o CEP agora.");
      return null;
    } finally {
      setBuscando(false);
    }
  };

  return { buscar, buscando, erro };
}
