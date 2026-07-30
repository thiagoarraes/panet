import { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { Avatar } from "./Avatar";

// Tema especial (rose + borda arco-iris + confete) combinado com o colaborador.
const isJorgeMaia = (col) => /jorge\s+maia/i.test(col?.nome || "");

// Renderiza o HTML de um post (sanitizado) e exibe um tooltip ao passar o mouse
// sobre menções (`<span class="mention" data-id="...">`), com foto, nome e cargo.
export function RichContent({ html, colaboradores = [], className = "rich-content", style }) {
  const containerRef = useRef(null);
  const hideTimerRef = useRef(null);
  const activeRef = useRef(false);
  const [tooltip, setTooltip] = useState(null); // { col, top, left }
  const [open, setOpen] = useState(false);

  const sanitized = useMemo(
    () => DOMPurify.sanitize(html || "", { ADD_ATTR: ["data-id", "data-type"] }),
    [html]
  );

  const colaboradoresById = useMemo(() => {
    const map = new Map();
    (colaboradores || []).forEach((c) => map.set(String(c.id), c));
    return map;
  }, [colaboradores]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const clearHideTimer = () => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    const hide = () => {
      if (!activeRef.current) return;
      activeRef.current = false;
      setOpen(false);
      clearHideTimer();
      hideTimerRef.current = window.setTimeout(() => setTooltip(null), 180);
    };

    // Segue o cursor: a cada movimento reavalia se ainda está sobre uma menção.
    // Sair da menção (ou do container) esconde com fade.
    const handleMove = (event) => {
      const mention = event.target.closest?.(".mention");
      const col =
        mention && container.contains(mention)
          ? colaboradoresById.get(String(mention.getAttribute("data-id")))
          : null;
      if (!col) {
        hide();
        return;
      }
      clearHideTimer();
      activeRef.current = true;
      setTooltip({ col, top: event.pageY, left: event.pageX });
      setOpen(true);
    };

    container.addEventListener("pointermove", handleMove);
    container.addEventListener("pointerleave", hide);
    return () => {
      container.removeEventListener("pointermove", handleMove);
      container.removeEventListener("pointerleave", hide);
      clearHideTimer();
    };
  }, [colaboradoresById, sanitized]);

  return (
    <>
      <div
        ref={containerRef}
        className={className}
        style={style}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
      {tooltip && isJorgeMaia(tooltip.col) && (
        <div
          className={`mention-confetti ${open ? "is-open" : ""}`}
          style={{ top: tooltip.top, left: tooltip.left }}
          aria-hidden="true"
        />
      )}
      {tooltip && (
        <div
          className={`mention-tooltip ${open ? "is-open" : ""} ${
            isJorgeMaia(tooltip.col) ? "is-jorge-maia" : ""
          }`}
          style={{ top: tooltip.top, left: tooltip.left }}
          role="tooltip"
        >
          <Avatar col={tooltip.col} size={44} />
          <div className="mention-tooltip-info">
            <div className="mention-tooltip-nome">{tooltip.col.nome}</div>
            {tooltip.col.cargo ? <div className="mention-tooltip-cargo">{tooltip.col.cargo}</div> : null}
          </div>
        </div>
      )}
    </>
  );
}
