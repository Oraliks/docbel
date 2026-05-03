"use client";

import React, { useEffect, useState } from "react";
import { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Copy,
  Type,
} from "lucide-react";

interface FloatingToolbarProps {
  editor: Editor | null;
  onFontClick?: () => void;
}

export function FloatingToolbar({
  editor,
  onFontClick,
}: FloatingToolbarProps) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!editor) return;

    const handleSelectionChange = () => {
      const { from, to } = editor.state.selection;

      if (from === to) {
        setShow(false);
        return;
      }

      const isText = editor.isActive("paragraph") ||
        editor.isActive("heading") ||
        editor.isActive("listItem");

      if (!isText) {
        setShow(false);
        return;
      }

      try {
        const start = editor.view.coordsAtPos(from);
        setPosition({
          top: start.top - 50,
          left: start.left,
        });
        setShow(true);
      } catch {
        setShow(false);
      }
    };

    editor.on("selectionUpdate", handleSelectionChange);
    editor.on("update", handleSelectionChange);

    return () => {
      editor.off("selectionUpdate", handleSelectionChange);
      editor.off("update", handleSelectionChange);
    };
  }, [editor]);

  if (!show || !editor) return null;

  let adjustedTop = position.top;
  let adjustedLeft = position.left;

  if (typeof window !== "undefined") {
    if (adjustedTop < 0) {
      adjustedTop = 0;
    }
    if (adjustedLeft + 200 > window.innerWidth) {
      adjustedLeft = Math.max(0, window.innerWidth - 210);
    }
  }

  const FloatButton = ({
    icon: Icon,
    title,
    onClick,
    isActive,
  }: {
    icon: React.ReactNode;
    title: string;
    onClick: () => void;
    isActive?: boolean;
  }) => (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: "6px 8px",
        background: isActive ? "color-mix(in srgb, var(--color-accent) 40%, transparent)" : "transparent",
        border: "1px solid var(--color-border)",
        borderRadius: 4,
        color: isActive ? "var(--color-accent)" : "var(--color-text)",
        cursor: "pointer",
        fontSize: 14,
        transition: "all 150ms",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "color-mix(in srgb, var(--color-accent) 20%, transparent)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = isActive
          ? "color-mix(in srgb, var(--color-accent) 40%, transparent)"
          : "transparent";
      }}
    >
      {Icon}
    </button>
  );

  return (
    <div
      style={{
        position: "fixed",
        top: adjustedTop,
        left: adjustedLeft,
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        padding: "8px",
        display: "flex",
        gap: 6,
        zIndex: 10001,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        backdropFilter: "blur(10px)",
      }}
    >
      <FloatButton
        icon={<Bold size={16} />}
        title="Bold"
        isActive={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <FloatButton
        icon={<Italic size={16} />}
        title="Italic"
        isActive={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <FloatButton
        icon={<Underline size={16} />}
        title="Underline"
        isActive={editor.isActive("underline")}
        onClick={() => {
          if (editor.isActive("underline")) {
            editor.chain().focus().unsetMark("underline").run();
          } else {
            // TipTap doesn't have underline by default, use mark
            editor
              .chain()
              .focus()
              .setMark("textStyle", { textDecoration: "underline" })
              .run();
          }
        }}
      />
      <FloatButton
        icon={<Strikethrough size={16} />}
        title="Strikethrough"
        isActive={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <div style={{ width: 1, background: "var(--color-border)", margin: "0 4px" }} />
      {onFontClick && (
        <FloatButton
          icon={<Type size={16} />}
          title="Font"
          onClick={onFontClick}
        />
      )}
      <FloatButton
        icon={<Copy size={16} />}
        title="Copy as Plain Text"
        onClick={() => {
          const { from, to } = editor.state.selection;
          const text = editor.state.doc.textBetween(from, to, "\n");
          navigator.clipboard.writeText(text);
        }}
      />
    </div>
  );
}
