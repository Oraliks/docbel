"use client";

import React from "react";
import { Editor } from "@tiptap/react";
import { X } from "lucide-react";

const GOOGLE_FONTS = [
  { name: "Plus Jakarta Sans", family: "'Plus Jakarta Sans', sans-serif" },
  { name: "Roboto", family: "'Roboto', sans-serif" },
  { name: "Open Sans", family: "'Open Sans', sans-serif" },
  { name: "Merriweather", family: "'Merriweather', serif" },
  { name: "Playfair Display", family: "'Playfair Display', serif" },
  { name: "Oswald", family: "'Oswald', sans-serif" },
  { name: "Lora", family: "'Lora', serif" },
  { name: "Poppins", family: "'Poppins', sans-serif" },
  { name: "Inter", family: "'Inter', sans-serif" },
  { name: "Ubuntu", family: "'Ubuntu', sans-serif" },
];

interface FontPickerProps {
  editor: Editor;
  onClose: () => void;
  position?: { top: number; left: number };
}

export function FontPicker({
  editor,
  onClose,
  position = { top: 100, left: 100 },
}: FontPickerProps) {
  const applyFont = (fontFamily: string) => {
    const { from, to } = editor.state.selection;
    if (from === to) {
      onClose();
      return;
    }

    (editor.chain().focus() as any)
      .setFontFamily(fontFamily)
      .run();

    onClose();
  };

  // Ajuster position si hors viewport
  let adjustedTop = position.top;
  let adjustedLeft = position.left;

  if (typeof window !== "undefined") {
    if (adjustedTop + 300 > window.innerHeight) {
      adjustedTop = Math.max(0, position.top - 310);
    }
    if (adjustedLeft + 220 > window.innerWidth) {
      adjustedLeft = Math.max(0, window.innerWidth - 230);
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
        zIndex: 10002,
        boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
        minWidth: 220,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text)" }}>
          FONTS
        </span>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--color-textMuted)",
            padding: 0,
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Font List */}
      <div style={{ maxHeight: 300, overflowY: "auto" }}>
        {GOOGLE_FONTS.map((font) => (
          <button
            key={font.name}
            onClick={() => applyFont(font.family)}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "none",
              backgroundColor: "transparent",
              color: "var(--color-text)",
              textAlign: "left",
              cursor: "pointer",
              fontSize: 13,
              fontFamily: font.family,
              borderBottom: "1px solid var(--color-border)",
              transition: "background 150ms",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                "var(--color-surface2)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                "transparent";
            }}
          >
            {font.name}
          </button>
        ))}
      </div>
    </div>
  );
}
