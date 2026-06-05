import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Avatar } from "./Avatar";

// Lista de autocomplete exibida ao digitar "@" no editor.
// Recebe `items` (colaboradores) e `command` (callback do TipTap suggestion).
export const MentionList = forwardRef(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => setSelectedIndex(0), [items]);

  const selectItem = (index) => {
    const item = items[index];
    if (item) command({ id: item.id, label: item.nome });
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex((i) => (i + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  if (!items.length) {
    return <div className="mention-list mention-list-empty">Nenhum colaborador</div>;
  }

  return (
    <div className="mention-list">
      {items.map((item, index) => (
        <button
          type="button"
          key={item.id}
          className={`mention-item ${index === selectedIndex ? "is-active" : ""}`}
          onMouseEnter={() => setSelectedIndex(index)}
          onClick={() => selectItem(index)}
        >
          <Avatar col={item} size={28} />
          <span className="mention-item-text">
            <span className="mention-item-nome">{item.nome}</span>
            {item.cargo ? <span className="mention-item-cargo">{item.cargo}</span> : null}
          </span>
        </button>
      ))}
    </div>
  );
});

MentionList.displayName = "MentionList";
