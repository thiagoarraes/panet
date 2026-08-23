import { Tooltip } from "@heroui/react";

/**
 * Substitui o `title=` nativo dos botoes de icone da Panet.
 *
 * O title do browser demora ~1s, nao segue o tema, some no mobile e nao e
 * lido de forma consistente por leitor de tela. Este wrapper existe porque
 * o Tooltip do HeroUI precisa de 5 linhas de composicao (Trigger + Content +
 * Arrow) por instancia, e sao ~35 instancias no projeto.
 *
 * O Tooltip.Trigger e obrigatorio: o filho aqui e sempre um <button> nativo
 * da Panet (nao um Button do HeroUI), e sem o Trigger envolvendo ele o
 * tooltip nunca abre.
 *
 * Quando `texto` e vazio devolve o filho cru -- assim os call sites com
 * dica condicional (`texto={podeEditar ? undefined : motivo}`) nao precisam
 * de ternario no JSX.
 */
export function PanTooltip({ texto, placement = "top", delay = 400, children }) {
  if (!texto) return children;

  return (
    <Tooltip delay={delay}>
      <Tooltip.Trigger>{children}</Tooltip.Trigger>
      <Tooltip.Content showArrow placement={placement}>
        <Tooltip.Arrow />
        {texto}
      </Tooltip.Content>
    </Tooltip>
  );
}
