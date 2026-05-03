"use client";

import React, { useCallback, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorToolbar } from "./editor-toolbar";
import { EditorVersionHistory, EditorVersion } from "./editor-version-history";
import { SlashCommandsMenu } from "./editor-slash-commands";
import { FloatingToolbar } from "./floating-toolbar";
import { FontPicker } from "./font-picker";
import { FileEmbed } from "./file-embed";
import { FontFamily } from "./font-extension";
import { ResizableImage } from "./resizable-image-extension";

interface RichTextEditorProps {
  value?: string;
  onChange?: (content: string, json: any) => void;
  placeholder?: string;
  readOnly?: boolean;
  showVersionHistory?: boolean;
}

export function RichTextEditor({
  value = "",
  onChange,
  placeholder = "Start typing...",
  readOnly = false,
  showVersionHistory = true,
}: RichTextEditorProps) {
  const [versions, setVersions] = useState<EditorVersion[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuPos, setSlashMenuPos] = useState({ top: 0, left: 0 });
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [fontPickerPos, setFontPickerPos] = useState({ top: 0, left: 0 });
  const [embedFiles, setEmbedFiles] = useState<any[]>([]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: {
          languageClassPrefix: "language-",
        },
      }),
      Link.configure({
        openOnClick: true,
        autolink: true,
      }),
      ResizableImage,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      FontFamily,
      Placeholder.configure({
        placeholder,
        emptyNodeClass:
          "is-editor-empty:first:before:content-[attr(data-placeholder)] is-editor-empty:first:before:float-left is-editor-empty:first:before:pointer-events-none is-editor-empty:first:before:h-0",
      }),
    ],
    content: value || "",
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const json = editor.getJSON();
      const text = editor.getText();

      // Update character and word count
      setCharCount(text.length);
      setWordCount(text.split(/\s+/).filter(w => w).length);
      setLastSaved(new Date());

      if (onChange) {
        onChange(html, json);
      }

      // Auto-save version
      if (showVersionHistory) {
        saveVersion(json);
      }

      // Check for slash command trigger
      const lastChar = text[text.length - 1];
      if (lastChar === "/" && editor.isActive("paragraph")) {
        const { from } = editor.state.selection;
        const coords = editor.view.coordsAtPos(from);
        setSlashMenuPos({ top: coords.top, left: coords.left });
        setSlashMenuOpen(true);
      } else if (slashMenuOpen && lastChar !== "/") {
        setSlashMenuOpen(false);
      }
    },
    immediatelyRender: false,
  });

  const saveVersion = useCallback(
    (json: any) => {
      const newVersion: EditorVersion = {
        id: Date.now().toString(),
        content: json,
        timestamp: new Date(),
        label: `Version ${versions.length + 1}`,
      };

      setVersions((prev) => {
        const updated = [...prev, newVersion];
        return updated.slice(-10); // Keep only last 10 versions
      });
    },
    [versions.length, showVersionHistory]
  );

  const restoreVersion = (version: EditorVersion) => {
    if (editor && version.content) {
      editor.commands.setContent(version.content);
      setShowHistory(false);
    }
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    const fileId = Date.now().toString();

    if (file.type.startsWith("image/")) {
      // Insert directly into the TipTap content as a resizable node
      reader.onload = (e) => {
        const src = e.target?.result as string;
        editor?.chain().focus().insertContent({
          type: "image",
          attrs: { src, alt: file.name, width: null, align: "center" },
        }).run();
      };
      reader.readAsDataURL(file);
      return;
    }

    // Non-image files: embed below the editor
    const fileType = file.type.includes("pdf")
      ? "pdf"
      : file.type.includes("sheet") || file.name.endsWith(".xlsx")
        ? "excel"
        : "document";

    reader.onload = (e) => {
      const data = e.target?.result as string;
      setEmbedFiles((prev) => [
        ...prev,
        { id: fileId, name: file.name, type: fileType, data, mimeType: file.type },
      ]);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFile = (id: string) => {
    setEmbedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  if (!editor) {
    return null;
  }

  return (
    <div
      className="flex flex-col gap-0"
      style={{
        borderRadius: fullscreen ? 0 : 10,
        border: fullscreen ? "none" : "1px solid var(--color-border)",
        backgroundColor: "var(--color-surface)",
        overflow: "hidden",
        position: fullscreen ? "fixed" : "relative",
        top: fullscreen ? 0 : "auto",
        left: fullscreen ? 0 : "auto",
        right: fullscreen ? 0 : "auto",
        bottom: fullscreen ? 0 : "auto",
        zIndex: fullscreen ? 9999 : "auto",
        width: fullscreen ? "100vw" : "auto",
        height: fullscreen ? "100vh" : "auto",
      }}
    >
      {/* Toolbar */}
      <EditorToolbar
        editor={editor}
        onVersionsClick={() => setShowHistory(!showHistory)}
        hasVersions={versions.length > 0}
        isReadOnly={readOnly}
        onFullscreen={() => setFullscreen(!fullscreen)}
        isFullscreen={fullscreen}
        charCount={charCount}
        wordCount={wordCount}
        lastSaved={lastSaved}
        onFileUpload={(files) => {
          Array.from(files).forEach(handleFileUpload);
        }}
      />

      {/* Version History Panel */}
      {showVersionHistory && showHistory && (
        <EditorVersionHistory
          versions={versions}
          onRestore={restoreVersion}
        />
      )}

      {/* Slash Commands Menu */}
      {slashMenuOpen && (
        <SlashCommandsMenu
          editor={editor}
          position={slashMenuPos}
          onClose={() => setSlashMenuOpen(false)}
        />
      )}

      {/* Editor Content */}
      <div
        className="flex-1 overflow-auto p-5"
        style={{
          padding: "16px 20px",
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--color-accent) 10%, transparent)";
        }}
        onDragLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.style.backgroundColor = "transparent";
          const files = Array.from(e.dataTransfer.files);
          files.forEach(handleFileUpload);
        }}
      >
        <EditorContent
          editor={editor}
          style={{
            color: "var(--color-text)",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        />

        {/* Embedded Files */}
        {embedFiles.length > 0 && (
          <div style={{ marginTop: 20 }}>
            {embedFiles.map((file) => (
              <FileEmbed
                key={file.id}
                file={file}
                onRemove={handleRemoveFile}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating Toolbar */}
      {editor && (
        <FloatingToolbar
          editor={editor}
          onFontClick={() => {
            const selection = editor.state.selection;
            if (selection.from !== selection.to) {
              const start = editor.view.coordsAtPos(selection.from);
              setFontPickerPos({ top: start.top - 120, left: start.left });
              setShowFontPicker(true);
            }
          }}
        />
      )}

      {/* Font Picker */}
      {showFontPicker && editor && (
        <FontPicker
          editor={editor}
          position={fontPickerPos}
          onClose={() => setShowFontPicker(false)}
        />
      )}


      {/* CSS for Editor Styling */}
      <style jsx global>{`
        .ProseMirror {
          outline: none;
          color: inherit;
        }

        .ProseMirror > * + * {
          margin-top: 0.75em;
        }

        .ProseMirror h1 {
          font-size: 2em;
          font-weight: 700;
          line-height: 1.2;
        }

        .ProseMirror h2 {
          font-size: 1.5em;
          font-weight: 700;
          line-height: 1.2;
        }

        .ProseMirror h3 {
          font-size: 1.25em;
          font-weight: 600;
          line-height: 1.2;
        }

        .ProseMirror h4,
        .ProseMirror h5,
        .ProseMirror h6 {
          font-weight: 600;
          line-height: 1.3;
        }

        .ProseMirror ul,
        .ProseMirror ol {
          padding-left: 1.5em;
        }

        .ProseMirror ul li {
          list-style-type: disc;
        }

        .ProseMirror ol li {
          list-style-type: decimal;
        }

        .ProseMirror li > p {
          margin: 0;
        }

        .ProseMirror blockquote {
          padding-left: 1rem;
          border-left: 3px solid;
          font-style: italic;
          opacity: 0.8;
          margin: 1rem 0;
        }

        .ProseMirror code {
          font-family: 'Courier New', monospace;
          font-size: 0.9em;
          padding: 2px 6px;
          border-radius: 4px;
          background: rgba(0, 0, 0, 0.1);
        }

        .ProseMirror pre {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 8px;
          padding: 1rem;
          overflow-x: auto;
          margin: 1rem 0;
        }

        .ProseMirror pre code {
          background: none;
          color: inherit;
          padding: 0;
        }

        .ProseMirror a {
          color: #0066cc;
          text-decoration: underline;
          cursor: pointer;
        }

        .ProseMirror a:hover {
          opacity: 0.8;
        }

        .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 6px;
        }

        /* Resizable image node wrapper */
        .ProseMirror [data-node-view-wrapper] {
          line-height: 0;
        }

        /* Clearfix after floated images */
        .ProseMirror p,
        .ProseMirror h1, .ProseMirror h2, .ProseMirror h3 {
          overflow: hidden;
        }

        .ProseMirror table {
          border-collapse: collapse;
          margin: 1rem 0;
          width: 100%;
        }

        .ProseMirror table td,
        .ProseMirror table th {
          border: 1px solid rgba(0, 0, 0, 0.1);
          padding: 8px 12px;
          text-align: left;
        }

        .ProseMirror table th {
          background: rgba(0, 0, 0, 0.05);
          font-weight: 600;
        }

        .ProseMirror hr {
          border: none;
          border-top: 2px solid rgba(0, 0, 0, 0.1);
          margin: 2rem 0;
        }

        .ProseMirror .is-editor-empty:first-child::before {
          color: rgba(0, 0, 0, 0.4);
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
