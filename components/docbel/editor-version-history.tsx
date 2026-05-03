"use client";

import React from "react";
import { RotateCcw, X } from "lucide-react";

export interface EditorVersion {
  id: string;
  content: any; // JSON content from TipTap
  timestamp: Date;
  label: string;
}

interface EditorVersionHistoryProps {
  versions: EditorVersion[];
  onRestore: (version: EditorVersion) => void;
}

const VersionButton = ({
  onClick,
  children,
  variant = "secondary",
}: {
  onClick: () => void;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) => (
  <button
    onClick={onClick}
    style={{
      padding: "6px 12px",
      borderRadius: 6,
      border: `1px solid ${variant === "primary" ? "var(--color-accent)" : "var(--color-border)"}`,
      backgroundColor:
        variant === "primary" ? "var(--color-accent)" : "transparent",
      color: variant === "primary" ? "#ffffff" : "var(--color-text)",
      cursor: "pointer",
      fontSize: 13,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      fontWeight: 500,
      transition: "all 150ms ease",
      display: "flex",
      alignItems: "center",
      gap: 6,
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLButtonElement).style.opacity = "0.85";
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLButtonElement).style.opacity = "1";
    }}
  >
    {children}
  </button>
);

export function EditorVersionHistory({
  versions,
  onRestore,
}: EditorVersionHistoryProps) {
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  };

  return (
    <div
      style={{
        borderBottom: "1px solid var(--color-border)",
        backgroundColor: "var(--color-surface2)",
        padding: "12px 16px",
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--color-textMuted)",
            textTransform: "uppercase",
            letterSpacing: 0.5,
            marginBottom: 8,
          }}
        >
          Version History ({versions.length} versions)
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            maxHeight: 300,
            overflowY: "auto",
          }}
        >
          {versions.length === 0 ? (
            <div
              style={{
                fontSize: 13,
                color: "var(--color-textMuted)",
                fontStyle: "italic",
                padding: "8px 0",
              }}
            >
              No versions saved yet
            </div>
          ) : (
            [...versions].reverse().map((version, idx) => (
              <div
                key={version.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 10px",
                  borderRadius: 6,
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--color-text)",
                    }}
                  >
                    {version.label}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--color-textMuted)",
                      marginTop: 2,
                    }}
                  >
                    {formatTime(version.timestamp)}
                  </div>
                </div>

                <VersionButton
                  onClick={() => onRestore(version)}
                  variant="primary"
                >
                  <RotateCcw size={14} />
                  Restore
                </VersionButton>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
