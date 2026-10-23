import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef } from "react";

export function NotesEditor({ value, onSave }: { value: string; onSave: (html: string) => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<string | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    if (pending.current !== null) onSaveRef.current(pending.current);
    pending.current = null;
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Escreva suas anotações, impressões ou dicas… (atalhos markdown: # título, - lista, > citação)" }),
    ],
    content: value || "",
    editorProps: { attributes: { class: "tiptap prose prose-neutral dark:prose-invert max-w-none prose-p:my-1.5" } },
    onUpdate: ({ editor }) => {
      pending.current = editor.isEmpty ? "" : editor.getHTML();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 600);
    },
    onBlur: flush,
  });

  // Save unsaved edits when leaving the page.
  useEffect(() => () => flush(), []);

  return <EditorContent editor={editor} />;
}
