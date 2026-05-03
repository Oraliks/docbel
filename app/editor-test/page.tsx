"use client";

import React, { useState, useEffect } from "react";
import { RichTextEditor } from "@/components/docbel/rich-text-editor";
import { DARK_COLORS, LIGHT_COLORS } from "@/lib/colors";

const TEMPLATES = {
  blog: `<h1>Article Title</h1><p><strong>Publish date:</strong> ${new Date().toLocaleDateString()}</p><h2>Introduction</h2><p>Start your article here...</p><h2>Main Section</h2><p>Add your main content here.</p><h2>Conclusion</h2><p>Wrap up your thoughts.</p>`,
  tutorial: `<h1>How to...</h1><h2>Step 1: First Step</h2><p>Explain the first step in detail.</p><h2>Step 2: Second Step</h2><p>Explain the second step.</p><h2>Step 3: Final Step</h2><p>Complete the tutorial.</p><blockquote>💡 Pro tip: Add helpful tips in blockquotes.</blockquote>`,
  doc: `<h1>Documentation Title</h1><h2>Overview</h2><p>Brief overview of the topic.</p><h2>Prerequisites</h2><ul><li>Item 1</li><li>Item 2</li></ul><h2>Installation</h2><pre><code>npm install package-name</code></pre><h2>Usage</h2><p>Describe how to use it.</p>`,
};

export default function EditorTestPage() {
  const [dark, setDark] = useState(false);
  const [editorContent, setEditorContent] = useState("");
  const [editorJson, setEditorJson] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewTab, setPreviewTab] = useState<"html" | "json">("html");
  const [isMounted, setIsMounted] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const colors = dark ? DARK_COLORS : LIGHT_COLORS;
  const accent = "#C8102E";

  const handleEditorChange = (html: string, json: any) => {
    setEditorContent(html);
    setEditorJson(json);
  };

  const handleSave = () => {
    const data = {
      html: editorContent,
      json: editorJson,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem("editor_content", JSON.stringify(data));
    alert("Content saved to localStorage!");
  };

  const handleLoad = () => {
    const saved = localStorage.getItem("editor_content");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setEditorContent(data.html);
        setEditorJson(data.json);
        alert("Content loaded from localStorage!");
      } catch (e) {
        alert("Failed to load content");
      }
    } else {
      alert("No saved content found");
    }
  };

  const handleClear = () => {
    if (confirm("Clear all content?")) {
      setEditorContent("");
      setEditorJson(null);
    }
  };

  const loadTemplate = (template: string) => {
    setEditorContent(TEMPLATES[template as keyof typeof TEMPLATES]);
    setShowTemplates(false);
  };

  const handleExportJson = () => {
    const dataStr = JSON.stringify(editorJson, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `article_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportHtml = () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Article</title>
  <style>
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
    }
    h1 { font-size: 2em; font-weight: 700; }
    h2 { font-size: 1.5em; font-weight: 700; }
    h3 { font-size: 1.25em; font-weight: 600; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; }
    pre { background: #f4f4f4; padding: 1rem; border-radius: 8px; overflow-x: auto; }
    blockquote { border-left: 3px solid #C8102E; padding-left: 1rem; font-style: italic; opacity: 0.8; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    table td, table th { border: 1px solid #ddd; padding: 8px 12px; }
    table th { background: #f4f4f4; font-weight: 600; }
    img { max-width: 100%; height: auto; border-radius: 8px; margin: 1rem 0; }
  </style>
</head>
<body>
${editorContent}
</body>
</html>`;
    const dataBlob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `article_${Date.now()}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!isMounted) return null;

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "20px",
        backgroundColor: colors.bg,
        color: colors.text,
        transition: "background-color 0.3s ease",
      }}
    >
      {/* Header */}
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ margin: "0 0 4px 0", fontSize: 28, fontWeight: 800 }}>
            📝 Rich Text Editor Test
          </h1>
          <p style={{ margin: 0, color: colors.textMuted, fontSize: 14 }}>
            Notion-like editor with TipTap, JSON storage & version history
          </p>
        </div>

        <button
          onClick={() => setDark(!dark)}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: `1px solid ${colors.border}`,
            backgroundColor: colors.surface,
            color: colors.text,
            cursor: "pointer",
            fontWeight: 500,
            transition: "all 150ms ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              colors.surface2;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              colors.surface;
          }}
        >
          {dark ? "☀️ Light" : "🌙 Dark"}
        </button>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", gap: 20 }}>
        {/* Editor Section */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: 16 }}>
            <RichTextEditor
              value={editorContent}
              onChange={handleEditorChange}
              colors={colors}
              accent={accent}
              placeholder="Start typing... Try heading (# or ##), lists (*), code (```), and more!"
              showVersionHistory={true}
            />
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: 8,
              position: "relative",
            }}
          >
            <ActionButton
              label="💾 Save"
              onClick={handleSave}
              colors={colors}
              accent={accent}
            />
            <ActionButton
              label="📂 Load"
              onClick={handleLoad}
              colors={colors}
              accent={accent}
            />
            <ActionButton
              label="🗑️ Clear"
              onClick={handleClear}
              colors={colors}
              accent={accent}
              danger
            />
            <div style={{ position: "relative" }}>
              <ActionButton
                label="📋 Templates"
                onClick={() => setShowTemplates(!showTemplates)}
                colors={colors}
                accent={accent}
              />
              {showTemplates && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    marginTop: 4,
                    backgroundColor: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 6,
                    minWidth: 120,
                    zIndex: 100,
                  }}
                >
                  {Object.entries(TEMPLATES).map(([key]) => (
                    <button
                      key={key}
                      onClick={() => loadTemplate(key)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: "none",
                        backgroundColor: "transparent",
                        color: colors.text,
                        cursor: "pointer",
                        textAlign: "left",
                        fontSize: 12,
                        borderBottom: `1px solid ${colors.border}`,
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                          colors.surface2;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                          "transparent";
                      }}
                    >
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <ActionButton
              label="📄 HTML"
              onClick={handleExportHtml}
              colors={colors}
              accent={accent}
              disabled={!editorContent}
            />
            <ActionButton
              label="📋 JSON"
              onClick={handleExportJson}
              colors={colors}
              accent={accent}
              disabled={!editorJson}
            />
            <ActionButton
              label={showPreview ? "Hide Preview" : "Show Preview"}
              onClick={() => {
                setShowPreview(!showPreview);
                if (!showPreview) {
                  setPreviewTab("html");
                }
              }}
              colors={colors}
              accent={accent}
            />
          </div>
        </div>

        {/* Preview Panel */}
        {showPreview && (
          <div
            style={{
              width: 350,
              borderRadius: 10,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surface,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Tabs */}
            <div
              style={{
                display: "flex",
                gap: 0,
                borderBottom: `1px solid ${colors.border}`,
                backgroundColor: colors.surface2,
              }}
            >
              <button
                onClick={() => setPreviewTab("html")}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  border: "none",
                  backgroundColor: "transparent",
                  color: colors.text,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 500,
                  borderBottom:
                    previewTab === "html"
                      ? `2px solid ${accent}`
                      : "transparent",
                }}
              >
                HTML
              </button>
              <button
                onClick={() => setPreviewTab("json")}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  border: "none",
                  backgroundColor: "transparent",
                  color: colors.text,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 500,
                  borderBottom:
                    previewTab === "json"
                      ? `2px solid ${accent}`
                      : "transparent",
                }}
              >
                JSON
              </button>
            </div>

            {/* Content */}
            <div
              style={{
                flex: 1,
                overflow: "auto",
                padding: "12px",
                fontFamily: "'Courier New', monospace",
                fontSize: 11,
              }}
            >
              {previewTab === "json" ? (
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    color: colors.text,
                  }}
                >
                  {editorJson ? JSON.stringify(editorJson, null, 2) : "No content yet"}
                </pre>
              ) : (
                <div
                  style={{
                    color: colors.textMuted,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                  dangerouslySetInnerHTML={{
                    __html: editorContent || "<em>No content yet</em>"
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tips */}
      <div
        style={{
          maxWidth: 1200,
          margin: "40px auto 0",
          padding: "16px",
          borderRadius: 10,
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          fontSize: 13,
          color: colors.textMuted,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 8, color: colors.text }}>
          💡 Features & Tips:
        </div>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li><strong>Markdown shortcuts:</strong> <code style={{ background: colors.inputBg, padding: "2px 4px" }}>###</code> for H3, <code style={{ background: colors.inputBg, padding: "2px 4px" }}>*</code> for lists, <code style={{ background: colors.inputBg, padding: "2px 4px" }}>```</code> for code</li>
          <li><strong>Slash commands:</strong> Type <code style={{ background: colors.inputBg, padding: "2px 4px" }}>/</code> at start of line to see all options</li>
          <li><strong>Live stats:</strong> Character & word count updates in real-time</li>
          <li><strong>Auto-versioning:</strong> Last 10 versions saved automatically</li>
          <li><strong>Full-screen mode:</strong> Click expand icon for distraction-free writing</li>
          <li><strong>Copy to clipboard:</strong> Copy button exports HTML instantly</li>
          <li><strong>Templates:</strong> Start with Blog, Tutorial, or Documentation templates</li>
          <li><strong>Export:</strong> Download as HTML or JSON for your blog system</li>
        </ul>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  colors,
  accent,
  danger = false,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  colors: any;
  accent: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 12px",
        borderRadius: 8,
        border: `1px solid ${danger ? "#ff6b6b" : accent}`,
        backgroundColor: danger
          ? "#ff6b6b20"
          : disabled
            ? colors.surface2
            : `${accent}20`,
        color: danger ? "#ff6b6b" : accent,
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 12,
        fontWeight: 600,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        opacity: disabled ? 0.5 : 1,
        transition: "all 150ms ease",
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.opacity = "0.85";
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.opacity = "1";
        }
      }}
    >
      {label}
    </button>
  );
}
