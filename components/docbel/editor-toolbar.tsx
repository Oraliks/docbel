"use client";

import React, { useRef } from "react";
import { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Image as ImageIcon,
  Link2,
  Undo2,
  Redo2,
  Trash2,
  Table,
  Clock,
  Maximize2,
  Minimize2,
  Copy,
  Upload,
} from "lucide-react";

interface EditorToolbarProps {
  editor: Editor;
  onVersionsClick?: () => void;
  hasVersions?: boolean;
  isReadOnly?: boolean;
  onFullscreen?: () => void;
  isFullscreen?: boolean;
  charCount?: number;
  wordCount?: number;
  lastSaved?: Date | null;
  onFileUpload?: (files: FileList) => void;
}

const ToolbarButton = ({
  onClick,
  isActive,
  title,
  children,
  disabled,
}: {
  onClick: () => void;
  isActive?: boolean;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}) => (
  <button
    onClick={onClick}
    title={title}
    disabled={disabled}
    style={{
      padding: "8px 10px",
      borderRadius: 6,
      border: isActive ? "2px solid var(--color-accent)" : "1px solid var(--color-border)",
      backgroundColor: isActive ? "color-mix(in srgb, var(--color-accent) 20%, transparent)" : "var(--color-surface2)",
      color: isActive ? "var(--color-accent)" : "var(--color-text)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "all 150ms ease",
      fontSize: 16,
    }}
    onMouseEnter={(e) => {
      if (!disabled && !isActive) {
        (e.currentTarget as HTMLButtonElement).style.backgroundColor =
          "var(--color-surface2)";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-accent)";
      }
    }}
    onMouseLeave={(e) => {
      if (!disabled && !isActive) {
        (e.currentTarget as HTMLButtonElement).style.backgroundColor =
          "var(--color-surface2)";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-border)";
      }
    }}
  >
    {children}
  </button>
);

const Separator = () => (
  <div
    style={{
      width: 1,
      height: 24,
      backgroundColor: "var(--color-border)",
      margin: "0 4px",
    }}
  />
);

export function EditorToolbar({
  editor,
  onVersionsClick,
  hasVersions,
  isReadOnly,
  onFullscreen,
  isFullscreen,
  charCount,
  wordCount,
  lastSaved,
  onFileUpload,
}: EditorToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleAddLink = () => {
    const url = prompt("Enter link URL:");
    if (url) {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && onFileUpload) {
      onFileUpload(files);
      editor.chain().focus().run();
    }
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && onFileUpload) {
      onFileUpload(files);
      editor.chain().focus().run();
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAddTable = () => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  };

  return (
    <div
      className="flex gap-2 p-3 flex-wrap items-center"
      style={{
        borderBottom: "1px solid var(--color-border)",
        backgroundColor: "var(--color-surface2)",
      }}
    >
      {/* Undo / Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        title="Undo"
        disabled={!editor.can().undo() || isReadOnly}
      >
        <Undo2 size={18} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        title="Redo"
        disabled={!editor.can().redo() || isReadOnly}
      >
        <Redo2 size={18} />
      </ToolbarButton>

      <Separator />

      {/* Text Formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title="Bold (Ctrl+B)"
        disabled={isReadOnly}
      >
        <Bold size={18} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="Italic (Ctrl+I)"
        disabled={isReadOnly}
      >
        <Italic size={18} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        title="Strikethrough"
        disabled={isReadOnly}
      >
        <Strikethrough size={18} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive("code")}
        title="Inline Code"
        disabled={isReadOnly}
      >
        <Code size={18} />
      </ToolbarButton>

      <Separator />

      {/* Block Formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive("heading", { level: 1 })}
        title="Heading 1"
        disabled={isReadOnly}
      >
        <Heading1 size={18} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive("heading", { level: 2 })}
        title="Heading 2"
        disabled={isReadOnly}
      >
        <Heading2 size={18} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive("heading", { level: 3 })}
        title="Heading 3"
        disabled={isReadOnly}
      >
        <Heading3 size={18} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        title="Bullet List"
        disabled={isReadOnly}
      >
        <List size={18} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        title="Numbered List"
        disabled={isReadOnly}
      >
        <ListOrdered size={18} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
        title="Blockquote"
        disabled={isReadOnly}
      >
        <Quote size={18} />
      </ToolbarButton>

      <Separator />

      {/* Media & Links */}
      <ToolbarButton
        onClick={handleAddLink}
        isActive={editor.isActive("link")}
        title="Add Link"
        disabled={isReadOnly}
      >
        <Link2 size={18} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => imageInputRef.current?.click()}
        title="Upload Image"
        disabled={isReadOnly}
      >
        <ImageIcon size={18} />
      </ToolbarButton>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleImageUpload}
      />

      <ToolbarButton
        onClick={handleAddTable}
        title="Insert Table"
        disabled={isReadOnly}
      >
        <Table size={18} />
      </ToolbarButton>

      <Separator />

      {/* Clear & Upload */}
      <ToolbarButton
        onClick={() => editor.chain().focus().clearContent().run()}
        title="Clear All"
        disabled={isReadOnly}
      >
        <Trash2 size={18} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => fileInputRef.current?.click()}
        title="Upload Files (PDF, Excel, Docs)"
        disabled={isReadOnly}
      >
        <Upload size={18} />
      </ToolbarButton>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.xlsx,.xls,.doc,.docx,.ppt,.pptx"
        style={{ display: "none" }}
        onChange={handleFileUpload}
      />

      {onVersionsClick && (
        <ToolbarButton
          onClick={onVersionsClick}
          isActive={hasVersions}
          title="Version History"
        >
          <Clock size={18} />
        </ToolbarButton>
      )}

      <ToolbarButton
        onClick={() => {
          const text = editor.getText();
          navigator.clipboard.writeText(text);
        }}
        title="Copy as Plain Text"
      >
        <Copy size={18} />
      </ToolbarButton>

      {onFullscreen && (
        <ToolbarButton
          onClick={onFullscreen}
          isActive={isFullscreen}
          title="Fullscreen"
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </ToolbarButton>
      )}

      {/* Stats */}
      <Separator />
      <div
        className="flex gap-3 ml-auto text-xs pr-1"
        style={{
          color: "var(--color-textMuted)",
        }}
      >
        {charCount !== undefined && (
          <div title="Characters">
            📝 {charCount}
          </div>
        )}
        {wordCount !== undefined && (
          <div title="Words">
            📄 {wordCount}
          </div>
        )}
        {lastSaved && (
          <div title="Last saved" style={{ color: "var(--color-textFaint)" }}>
            ✓ {lastSaved.toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}
      </div>
    </div>
  );
}
