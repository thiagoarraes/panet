import { Tooltip } from "@heroui/react";

/**
 * Substitui o `title=` nativo dos botoes de icone da Panet.
 *
 * O title do browser demora ~1s, nao segue o tema, some no mobile e nao e
 * lido de forma consistente por leitor de tela. Este wrapper existe porque
 * o Tooltip do HeroUI precisa de 5 linhas de composicao (Trigger + Content +
 * Arrow) por instancia, e sao ~35 instancias no projeto.
 *
 * O Tooltip.Trigger e obrigatorio AQUI, e nao e o que a doc mostra no exemplo
 * basico: la o filho direto e o <Button> do HeroUI, que propaga os handlers de
 * hover/press sozinho. O filho aqui e sempre um <button> nativo da Panet, que
 * nao recebe nada -- testado: sem o Trigger o tooltip simplesmente nao abre.
 *
 * Custo disso: o Trigger envolve o filho numa <div role="button" tabIndex=0>,
 * o que gera uma parada de Tab a mais por icone. O wrapper e neutralizado no
 * layout por `display: contents` (global.css), senao o bloco ainda esticava e
 * desalinhava as linhas de acoes. Resolver o tab duplo exigiria trocar os
 * ~35 <button> nativos pelo Button do HeroUI.
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
