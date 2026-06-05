import { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { Avatar } from "./Avatar";

// Renderiza o HTML de um post (sanitizado) e exibe um tooltip ao passar o mouse
// sobre menções (`<span class="mention" data-id="...">`), com foto, nome e cargo.
export function RichContent({ html, colaboradores = [], className = "rich-content", style }) {
  const containerRef = useRef(null);
  const hideTimerRef = useRef(null);
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

    const handleOver = (event) => {
      const mention = event.target.closest?.(".mention");
      if (!mention || !container.contains(mention)) return;
      const col = colaboradoresById.get(String(mention.getAttribute("data-id")));
      if (!col) return;
      clearHideTimer();
      const rect = mention.getBoundingClientRect();
      setTooltip({
        col,
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX + rect.width / 2,
      });
      setOpen(true);
    };

    const handleOut = (event) => {
      const mention = event.target.closest?.(".mention");
      if (!mention) return;
      const next = event.relatedTarget;
      if (next && mention.contains(next)) return;
      setOpen(false);
      clearHideTimer();
      hideTimerRef.current = window.setTimeout(() => setTooltip(null), 180);
    };

    container.addEventListener("pointerover", handleOver);
    container.addEventListener("pointerout", handleOut);
    return () => {
      container.removeEventListener("pointerover", handleOver);
      container.removeEventListener("pointerout", handleOut);
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
      {tooltip && (
        <div
          className={`mention-tooltip ${open ? "is-open" : ""}`}
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
