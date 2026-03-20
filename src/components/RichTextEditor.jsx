import { useMemo } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Strikethrough, Undo2, Redo2 } from "lucide-react";

export function RichTextEditor({ value = "", onChange, placeholder = "Escreva aqui..." }) {
  const content = useMemo(() => (value && String(value).trim() ? value : "<p></p>"), [value]);

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
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor: instance }) => {
      onChange?.(instance.getHTML());
    },
  });

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
