import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EditorContent, ReactRenderer, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Mention from "@tiptap/extension-mention";
import Image from "@tiptap/extension-image";
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Strikethrough, Undo2, Redo2, Smile, Film } from "lucide-react";
import { MentionList } from "./MentionList";

const EmojiPicker = lazy(() => import("emoji-picker-react"));

const EMOJI_W = 320;
const EMOJI_H = 380;
const GIF_W = 300;

// Categorias do seletor de emojis traduzidas para pt-br.
const EMOJI_CATEGORIES = [
  { category: "suggested", name: "Usados com frequência" },
  { category: "smileys_people", name: "Rostos e pessoas" },
  { category: "animals_nature", name: "Animais e natureza" },
  { category: "food_drink", name: "Comidas e bebidas" },
  { category: "travel_places", name: "Viagens e lugares" },
  { category: "activities", name: "Atividades" },
  { category: "objects", name: "Objetos" },
  { category: "symbols", name: "Símbolos" },
  { category: "flags", name: "Bandeiras" },
];

// Cria a configuração de `suggestion` para a extensão de menção.
// Lê a lista de colaboradores de um ref para refletir atualizações sem recriar o editor.
const buildMentionSuggestion = (colaboradoresRef) => ({
  char: "@",
  allowSpaces: false,
  items: ({ query }) => {
    const term = query.trim().toLowerCase();
    const list = colaboradoresRef.current || [];
    const filtered = term
      ? list.filter((c) => String(c.nome || "").toLowerCase().includes(term))
      : list;
    return filtered.slice(0, 8);
  },
  render: () => {
    let component;
    let popup;

    const positionPopup = (clientRect) => {
      if (!popup || !clientRect) return;
      const rect = clientRect();
      if (!rect) return;
      popup.style.left = `${rect.left + window.scrollX}px`;
      popup.style.top = `${rect.bottom + window.scrollY + 6}px`;
    };

    return {
      onStart: (props) => {
        component = new ReactRenderer(MentionList, { props, editor: props.editor });
        popup = document.createElement("div");
        popup.className = "mention-popup";
        popup.appendChild(component.element);
        document.body.appendChild(popup);
        positionPopup(props.clientRect);
      },
      onUpdate: (props) => {
        component?.updateProps(props);
        positionPopup(props.clientRect);
      },
      onKeyDown: (props) => {
        if (props.event.key === "Escape") {
          popup?.remove();
          return true;
        }
        return component?.ref?.onKeyDown(props) ?? false;
      },
      onExit: () => {
        popup?.remove();
        component?.destroy();
      },
    };
  },
});

export function RichTextEditor({ value = "", onChange, placeholder = "Escreva aqui...", colaboradores = [] }) {
  const content = useMemo(() => (value && String(value).trim() ? value : "<p></p>"), [value]);
  const colaboradoresRef = useRef(colaboradores);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiPos, setEmojiPos] = useState({ top: 0, left: 0 });
  const [emojiTheme, setEmojiTheme] = useState("dark");
  const emojiBtnRef = useRef(null);
  const emojiPopRef = useRef(null);
  const [gifOpen, setGifOpen] = useState(false);
  const [gifPos, setGifPos] = useState({ top: 0, left: 0 });
  const [gifUrl, setGifUrl] = useState("");
  const gifBtnRef = useRef(null);
  const gifPopRef = useRef(null);
  const gifInputRef = useRef(null);

  useEffect(() => {
    colaboradoresRef.current = colaboradores;
  }, [colaboradores]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Link is configured explicitly below to avoid duplicate extension registration.
        link: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      Image.configure({
        inline: false,
        HTMLAttributes: { class: "rte-gif" },
      }),
      Mention.configure({
        HTMLAttributes: { class: "mention" },
        renderHTML({ options, node }) {
          return [
            "span",
            { ...options.HTMLAttributes, "data-type": "mention", "data-id": node.attrs.id },
            `@${node.attrs.label ?? node.attrs.id}`,
          ];
        },
        suggestion: buildMentionSuggestion(colaboradoresRef),
      }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor: instance }) => {
      onChange?.(instance.getHTML());
    },
  });

  // Fecha o popover de emoji ao clicar fora (botão e popover ficam em portal).
  useEffect(() => {
    if (!emojiOpen) return;
    const handlePointerDown = (event) => {
      const inBtn = emojiBtnRef.current?.contains(event.target);
      const inPop = emojiPopRef.current?.contains(event.target);
      if (!inBtn && !inPop) setEmojiOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [emojiOpen]);

  // Abre/fecha o seletor de emoji, calculando uma posição fixa que não seja
  // cortada pelo overflow do modal (abre acima/abaixo conforme o espaço).
  const toggleEmoji = () => {
    if (emojiOpen) {
      setEmojiOpen(false);
      return;
    }
    const rect = emojiBtnRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow >= EMOJI_H + 8 ? rect.bottom + 6 : Math.max(8, rect.top - EMOJI_H - 6);
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - EMOJI_W - 8);
      setEmojiPos({ top, left });
    }
    setEmojiTheme(document.documentElement.classList.contains("theme-light") ? "light" : "dark");
    setEmojiOpen(true);
  };

  const setLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href || "";
    const url = window.prompt("Cole a URL do link", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  // Fecha o popover de GIF ao clicar fora.
  useEffect(() => {
    if (!gifOpen) return;
    const handlePointerDown = (event) => {
      const inBtn = gifBtnRef.current?.contains(event.target);
      const inPop = gifPopRef.current?.contains(event.target);
      if (!inBtn && !inPop) setGifOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [gifOpen]);

  const toggleGif = () => {
    if (gifOpen) {
      setGifOpen(false);
      return;
    }
    const rect = gifBtnRef.current?.getBoundingClientRect();
    if (rect) {
      const top = rect.bottom + 6;
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - GIF_W - 8);
      setGifPos({ top, left });
    }
    setGifUrl("");
    setGifOpen(true);
    setTimeout(() => gifInputRef.current?.focus(), 0);
  };

  const confirmGif = () => {
    const url = gifUrl.trim();
    if (!url || !editor) return;
    editor.chain().focus().setImage({ src: url }).run();
    setGifUrl("");
    setGifOpen(false);
  };

  const insertEmoji = (emojiData) => {
    if (!editor) return;
    editor.chain().focus().insertContent(emojiData.emoji).run();
    setEmojiOpen(false);
  };

  if (!editor) return null;

  return (
    <div className="rte-wrap">
      <div className="rte-toolbar">
        <button type="button" className={`rte-btn ${editor.isActive("bold") ? "active" : ""}`} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito">
          <Bold size={14} />
        </button>
        <button type="button" className={`rte-btn ${editor.isActive("italic") ? "active" : ""}`} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico">
          <Italic size={14} />
        </button>
        <button type="button" className={`rte-btn ${editor.isActive("strike") ? "active" : ""}`} onClick={() => editor.chain().focus().toggleStrike().run()} title="Riscado">
          <Strikethrough size={14} />
        </button>
        <button type="button" className={`rte-btn ${editor.isActive("bulletList") ? "active" : ""}`} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista">
          <List size={14} />
        </button>
        <button type="button" className={`rte-btn ${editor.isActive("orderedList") ? "active" : ""}`} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada">
          <ListOrdered size={14} />
        </button>
        <button type="button" className={`rte-btn ${editor.isActive("link") ? "active" : ""}`} onClick={setLink} title="Link">
          <LinkIcon size={14} />
        </button>
        <button ref={emojiBtnRef} type="button" className={`rte-btn ${emojiOpen ? "active" : ""}`} onClick={toggleEmoji} title="Emoji">
          <Smile size={14} />
        </button>
        {emojiOpen &&
          createPortal(
            <div ref={emojiPopRef} className="rte-emoji-popover" style={{ top: emojiPos.top, left: emojiPos.left }}>
              <Suspense fallback={<div className="rte-emoji-loading">Carregando emojis...</div>}>
                <EmojiPicker
                  onEmojiClick={insertEmoji}
                  lazyLoadEmojis
                  theme={emojiTheme}
                  emojiStyle="native"
                  width={EMOJI_W}
                  height={EMOJI_H}
                  searchPlaceHolder="Pesquisar"
                  categories={EMOJI_CATEGORIES}
                  previewConfig={{ showPreview: false }}
                />
              </Suspense>
            </div>,
            document.body
          )}
        <button ref={gifBtnRef} type="button" className={`rte-btn ${gifOpen ? "active" : ""}`} onClick={toggleGif} title="Inserir GIF por URL">
          <Film size={14} />
        </button>
        {gifOpen &&
          createPortal(
            <div ref={gifPopRef} className="rte-gif-popover" style={{ top: gifPos.top, left: gifPos.left, width: GIF_W }}>
              <div className="rte-gif-label">URL do GIF</div>
              <input
                ref={gifInputRef}
                className="form-input rte-gif-input"
                type="url"
                placeholder="https://...gif"
                value={gifUrl}
                onChange={(e) => setGifUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    confirmGif();
                  } else if (e.key === "Escape") {
                    setGifOpen(false);
                  }
                }}
              />
              <div className="rte-gif-actions">
                <button type="button" className="btn-ghost" onClick={() => setGifOpen(false)}>Cancelar</button>
                <button type="button" className="btn-primary" onClick={confirmGif} disabled={!gifUrl.trim()}>Inserir</button>
              </div>
            </div>,
            document.body
          )}
        <div className="rte-spacer" />
        <button type="button" className="rte-btn" onClick={() => editor.chain().focus().undo().run()} title="Desfazer">
          <Undo2 size={14} />
        </button>
        <button type="button" className="rte-btn" onClick={() => editor.chain().focus().redo().run()} title="Refazer">
          <Redo2 size={14} />
        </button>
      </div>
      <EditorContent editor={editor} className="rte-editor" />
    </div>
  );
}
