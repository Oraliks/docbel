"use client";

import React, { useState, useEffect } from "react";
import { Editor } from "@tiptap/react";
import {
  Heading1,
  Heading2,
  Heading3,
  Type,
  List,
  ListOrdered,
  Quote,
  Code2,
  Table,
  Image as ImageIcon,
  Minus,
} from "lucide-react";

interface SlashCommandsMenuProps {
  editor: Editor;
  position: { top: number; left: number };
  onClose: () => void;
}

const commands = [
  {
    label: "Heading 1",
    icon: Heading1,
    action: (editor: Editor) => {
      const { from } = editor.state.selection;
      return editor
        .chain()
        .focus()
        .deleteRange({ from: from - 1, to: from })
        .toggleHeading({ level: 1 })
        .run();
    },
  },
  {
    label: "Heading 2",
    icon: Heading2,
    action: (editor: Editor) =>
      editor.chain().focus().deleteRange({ from: editor.state.selection.from - 1, to: editor.state.selection.from }).toggleHeading({ level: 2 }).run(),
  },
  {
    label: "Heading 3",
    icon: Heading3,
    action: (editor: Editor) =>
      editor.chain().focus().deleteRange({ from: editor.state.selection.from - 1, to: editor.state.selection.from }).toggleHeading({ level: 3 }).run(),
  },
  {
    label: "Paragraph",
    icon: Type,
    action: (editor: Editor) =>
      editor.chain().focus().deleteRange({ from: editor.state.selection.from - 1, to: editor.state.selection.from }).setParagraph().run(),
  },
  {
    label: "Bullet List",
    icon: List,
    action: (editor: Editor) =>
      editor.chain().focus().deleteRange({ from: editor.state.selection.from - 1, to: editor.state.selection.from }).toggleBulletList().run(),
  },
  {
    label: "Numbered List",
    icon: ListOrdered,
    action: (editor: Editor) =>
      editor.chain().focus().deleteRange({ from: editor.state.selection.from - 1, to: editor.state.selection.from }).toggleOrderedList().run(),
  },
  {
    label: "Blockquote",
    icon: Quote,
    action: (editor: Editor) =>
      editor.chain().focus().deleteRange({ from: editor.state.selection.from - 1, to: editor.state.selection.from }).toggleBlockquote().run(),
  },
  {
    label: "Code Block",
    icon: Code2,
    action: (editor: Editor) =>
      editor.chain().focus().deleteRange({ from: editor.state.selection.from - 1, to: editor.state.selection.from }).toggleCodeBlock().run(),
  },
  {
    label: "Table",
    icon: Table,
    action: (editor: Editor) => {
      editor.chain().focus().deleteRange({ from: editor.state.selection.from - 1, to: editor.state.selection.from }).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    },
  },
  {
    label: "Image",
    icon: ImageIcon,
    action: (editor: Editor) => {
      const url = prompt("Enter image URL:");
      if (url) {
        editor
          .chain()
          .focus()
          .deleteRange({ from: editor.state.selection.from - 1, to: editor.state.selection.from })
          .insertContent({ type: "image", attrs: { src: url, alt: "", width: null, align: "center" } })
          .run();
      }
    },
  },
  {
    label: "Divider",
    icon: Minus,
    action: (editor: Editor) =>
      editor.chain().focus().deleteRange({ from: editor.state.selection.from - 1, to: editor.state.selection.from }).setHorizontalRule().run(),
  },
];

export function SlashCommandsMenu({
  editor,
  position,
  onClose,
}: SlashCommandsMenuProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        setSelectedIdx((i) => (i + 1) % commands.length);
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        setSelectedIdx((i) => (i - 1 + commands.length) % commands.length);
        e.preventDefault();
      } else if (e.key === "Enter") {
        commands[selectedIdx].action(editor);
        onClose();
        e.preventDefault();
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIdx, editor, onClose]);

  // Ajuster position si hors viewport
  let adjustedTop = position.top + 30;
  let adjustedLeft = position.left;

  if (typeof window !== "undefined") {
    if (adjustedTop + 400 > window.innerHeight) {
      adjustedTop = Math.max(0, position.top - 410);
    }
    if (adjustedLeft + 250 > window.innerWidth) {
      adjustedLeft = Math.max(0, window.innerWidth - 260);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        top: adjustedTop,
        left: adjustedLeft,
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
        zIndex: 10000,
        maxWidth: 250,
        maxHeight: 400,
        overflowY: "auto",
      }}
    >
      {commands.map((cmd, idx) => {
        const Icon = cmd.icon;
        return (
          <button
            key={cmd.label}
            onClick={() => {
              cmd.action(editor);
              onClose();
            }}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "none",
              backgroundColor:
                idx === selectedIdx ? "color-mix(in srgb, var(--color-accent) 20%, transparent)" : "transparent",
              color: idx === selectedIdx ? "var(--color-accent)" : "var(--color-text)",
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              transition: "all 150ms ease",
            }}
            onMouseEnter={() => setSelectedIdx(idx)}
          >
            <Icon size={16} />
            {cmd.label}
          </button>
        );
      })}
    </div>
  );
}
