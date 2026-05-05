"use client";

import React, { useState } from "react";
import { Download, X, Eye, Loader } from "lucide-react";

const accent = "var(--color-accent)";
const colors = {
  border: "var(--color-border)",
  surface: "var(--color-surface)",
};

interface FileEmbedProps {
  file: {
    id: string;
    name: string;
    type: "image" | "pdf" | "excel" | "document";
    data: string; // base64 or URL
    mimeType: string;
  };
  onRemove?: (id: string) => void;
}

export function FileEmbed({
  file,
  onRemove,
}: FileEmbedProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [excelData, setExcelData] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = file.data;
    link.download = file.name;
    link.click();
  };

  const handlePreviewExcel = async () => {
    setLoading(true);
    try {
      const response = await fetch(file.data);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      // Dynamic import of xlsx
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(new Uint8Array(arrayBuffer), {
        type: "array",
      });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      setExcelData(data as string[][]);
      setShowPreview(true);
    } catch (error) {
      console.error("Failed to parse Excel:", error);
    }
    setLoading(false);
  };

  if (file.type === "image") {
    return (
      <div
        style={{
          position: "relative",
          display: "inline-block",
          margin: "12px 0",
        }}
      >
        {/* Embedded image data is user-provided content and is rendered directly on purpose. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={file.data}
          alt={file.name}
          style={{
            maxWidth: "100%",
            maxHeight: 400,
            borderRadius: 8,
            border: "1px solid var(--color-border)",
          }}
        />
        <button
          onClick={() => onRemove?.(file.id)}
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            background: "rgba(0,0,0,0.5)",
            border: "none",
            borderRadius: 4,
            color: "white",
            cursor: "pointer",
            padding: "4px 6px",
          }}
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  if (file.type === "pdf") {
    return (
      <div
        style={{
          padding: "12px",
          border: "2px dashed var(--color-border)",
          borderRadius: 8,
          backgroundColor: "var(--color-surface2)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          margin: "12px 0",
        }}
      >
        <div>
          <div style={{ fontWeight: 600, color: "var(--color-text)", fontSize: 13 }}>
            📄 {file.name}
          </div>
          <div style={{ fontSize: 11, color: "var(--color-textMuted)", marginTop: 4 }}>
            PDF Document
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleDownload}
            style={{
              padding: "6px 12px",
              border: "1px solid var(--color-accent)",
              background: "color-mix(in srgb, var(--color-accent) 20%, transparent)",
              color: "var(--color-accent)",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
              display: "flex",
              gap: 4,
              alignItems: "center",
            }}
          >
            <Download size={12} /> Download
          </button>
          {onRemove && (
            <button
              onClick={() => onRemove(file.id)}
              style={{
                padding: "6px 8px",
                border: "none",
                background: "transparent",
                color: "var(--color-textMuted)",
                cursor: "pointer",
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    );
  }

  if (file.type === "excel") {
    return (
      <div
        style={{
          padding: "12px",
          border: "2px dashed var(--color-border)",
          borderRadius: 8,
          backgroundColor: "var(--color-surface2)",
          margin: "12px 0",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: showPreview ? 12 : 0,
          }}
        >
          <div>
            <div style={{ fontWeight: 600, color: "var(--color-text)", fontSize: 13 }}>
              📊 {file.name}
            </div>
            <div style={{ fontSize: 11, color: "var(--color-textMuted)", marginTop: 4 }}>
              Excel Spreadsheet
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handlePreviewExcel}
              disabled={loading}
              style={{
                padding: "6px 12px",
                border: `1px solid ${accent}`,
                background: `${accent}20`,
                color: accent,
                borderRadius: 4,
                cursor: loading ? "wait" : "pointer",
                fontSize: 12,
                display: "flex",
                gap: 4,
                alignItems: "center",
              }}
            >
              {loading ? (
                <Loader size={12} />
              ) : (
                <Eye size={12} />
              )}{" "}
              Preview
            </button>
            <button
              onClick={handleDownload}
              style={{
                padding: "6px 12px",
                border: "1px solid var(--color-border)",
                background: "transparent",
                color: "var(--color-text)",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12,
                display: "flex",
                gap: 4,
                alignItems: "center",
              }}
            >
              <Download size={12} /> Download
            </button>
            {onRemove && (
              <button
                onClick={() => onRemove(file.id)}
                style={{
                  padding: "6px 8px",
                  border: "none",
                  background: "transparent",
                  color: "var(--color-textMuted)",
                  cursor: "pointer",
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {showPreview && excelData.length > 0 && (
          <div
            style={{
              overflowX: "auto",
              borderTop: `1px solid ${colors.border}`,
              paddingTop: 12,
            }}
          >
            <table
              style={{
                borderCollapse: "collapse",
                width: "100%",
                fontSize: 12,
              }}
            >
              <tbody>
                {excelData.slice(0, 20).map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    {row.map((cell, cellIdx) => (
                      <td
                        key={cellIdx}
                        style={{
                          border: "1px solid var(--color-border)",
                          padding: "6px 8px",
                          backgroundColor:
                            rowIdx === 0 ? colors.surface : "transparent",
                          fontWeight: rowIdx === 0 ? 600 : 400,
                        }}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {excelData.length > 20 && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  color: "var(--color-textMuted)",
                  fontStyle: "italic",
                }}
              >
                Showing 20 of {excelData.length} rows
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Document (PDF, DOCX, PPTX)
  return (
    <div
      style={{
        padding: "12px",
        border: "2px dashed var(--color-border)",
        borderRadius: 8,
        backgroundColor: "var(--color-surface2)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        margin: "12px 0",
      }}
    >
      <div>
        <div style={{ fontWeight: 600, color: "var(--color-text)", fontSize: 13 }}>
          📎 {file.name}
        </div>
        <div style={{ fontSize: 11, color: "var(--color-textMuted)", marginTop: 4 }}>
          Document
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={handleDownload}
          style={{
            padding: "6px 12px",
            border: `1px solid ${accent}`,
            background: `${accent}20`,
            color: accent,
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12,
            display: "flex",
            gap: 4,
            alignItems: "center",
          }}
        >
          <Download size={12} /> Download
        </button>
        {onRemove && (
          <button
            onClick={() => onRemove(file.id)}
            style={{
              padding: "6px 8px",
              border: "none",
              background: "transparent",
              color: "var(--color-textMuted)",
              cursor: "pointer",
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
