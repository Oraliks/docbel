"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from "@tiptap/react";
import React, { useCallback, useRef } from "react";
import { AlignLeft, AlignCenter, AlignRight } from "lucide-react";

function ResizableImageView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
  const { src, alt, width, align } = node.attrs;
  const imgRef = useRef<HTMLImageElement>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const [hovered, setHovered] = React.useState(false);

  // ── Resize ────────────────────────────────────────────────────────────────
  const makeResizeHandler = useCallback(
    (direction: "right" | "left") => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startX.current = e.clientX;
      startWidth.current = imgRef.current?.offsetWidth || (width ? parseInt(width) : 300);

      const onMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX.current;
        // right handle → drag right = bigger; left handle → drag left = bigger
        const newWidth = Math.max(40, startWidth.current + (direction === "right" ? delta : -delta));
        updateAttributes({ width: `${newWidth}px` });
      };
      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [updateAttributes, width]
  );

  // ── Custom drag — précision au caractère près ──────────────────────────────
  const handleDragMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const pos = typeof getPos === "function" ? getPos() : null;
      if (pos === null || !editor) return;

      const savedAttrs = { ...node.attrs };

      // Ghost visuel qui suit la souris
      if (imgRef.current) imgRef.current.style.cursor = "grabbing";

      const ghost = document.createElement("div");
      ghost.style.cssText = [
        "position:fixed",
        "pointer-events:none",
        "z-index:9999",
        "background:rgba(59,130,246,0.15)",
        "border:2px dashed #3b82f6",
        "border-radius:6px",
        "padding:6px 10px",
        "font-size:12px",
        "color:#3b82f6",
        "font-family:sans-serif",
        "white-space:nowrap",
        "box-shadow:0 4px 12px rgba(0,0,0,0.2)",
      ].join(";");
      ghost.textContent = "📷 Déplacer l'image…";
      document.body.appendChild(ghost);

      const onMouseMove = (ev: MouseEvent) => {
        ghost.style.left = ev.clientX + 14 + "px";
        ghost.style.top = ev.clientY - 16 + "px";
      };

      const onMouseUp = (ev: MouseEvent) => {
        document.body.removeChild(ghost);
        if (imgRef.current) imgRef.current.style.cursor = "grab";
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);

        // Position du caractère sous le curseur à l'emplâtrement
        let dropTiptapPos: number | null = null;
        try {
          const range =
            (document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null }).caretRangeFromPoint?.(ev.clientX, ev.clientY) ??
            (() => {
              const cp = (document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null }).caretPositionFromPoint?.(ev.clientX, ev.clientY);
              if (!cp) return null;
              const r = document.createRange();
              r.setStart(cp.offsetNode, cp.offset);
              return r;
            })();

          if (range) {
            dropTiptapPos = editor.view.posAtDOM(range.startContainer, range.startOffset);
          }
        } catch {
          dropTiptapPos = null;
        }

        if (dropTiptapPos === null || dropTiptapPos === pos) return;

        // Supprimer l'image de sa position actuelle, l'insérer à la destination
        const insertAt = dropTiptapPos > pos ? dropTiptapPos - node.nodeSize : dropTiptapPos;

        editor
          .chain()
          .deleteRange({ from: pos, to: pos + node.nodeSize })
          .insertContentAt(Math.max(0, insertAt), { type: "image", attrs: savedAttrs })
          .run();
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [editor, getPos, node]
  );

  // ── Styles ────────────────────────────────────────────────────────────────
  const floatStyle: React.CSSProperties =
    align === "left"
      ? { float: "left", margin: "2px 14px 6px 0" }
      : align === "right"
      ? { float: "right", margin: "2px 0 6px 14px" }
      : { margin: "2px 4px" };

  return (
    <NodeViewWrapper
      as="span"
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        position: "relative",
        ...floatStyle,
      }}
    >
      <span
        style={{ position: "relative", display: "inline-block" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Toolbar alignement */}
        {selected && (
          <span
            style={{
              position: "absolute",
              top: -40,
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: 2,
              background: "#1f2937",
              borderRadius: 7,
              padding: "4px 6px",
              boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
              zIndex: 1001,
              whiteSpace: "nowrap",
            }}
          >
            {(
              [
                { icon: <AlignLeft size={13} />, value: "left", label: "Flotter à gauche" },
                { icon: <AlignCenter size={13} />, value: "center", label: "Inline" },
                { icon: <AlignRight size={13} />, value: "right", label: "Flotter à droite" },
              ] as const
            ).map(({ icon, value, label }) => (
              <button
                key={value}
                onMouseDown={(e) => { e.preventDefault(); updateAttributes({ align: value }); }}
                title={label}
                style={{
                  background: align === value ? "#3b82f6" : "transparent",
                  border: "none",
                  borderRadius: 4,
                  color: "white",
                  cursor: "pointer",
                  padding: "3px 7px",
                  display: "flex",
                  alignItems: "center",
                  transition: "background 100ms",
                }}
              >
                {icon}
              </button>
            ))}
            <span style={{ display: "inline-block", width: 1, background: "rgba(255,255,255,0.2)", margin: "3px 2px" }} />
            <input
              type="number"
              min={40}
              max={2000}
              value={width ? parseInt(width) : ""}
              placeholder="auto"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                if (!isNaN(v) && v >= 40) updateAttributes({ width: `${v}px` });
              }}
              style={{
                width: 54,
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 4,
                color: "white",
                fontSize: 11,
                padding: "2px 5px",
                outline: "none",
                textAlign: "center",
              }}
            />
            <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, paddingRight: 2 }}>px</span>
          </span>
        )}

        {/* Image */}
        {/* Editor image nodes use arbitrary document sources and are intentionally rendered without next/image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt={alt || ""}
          onMouseDown={handleDragMouseDown}
          style={{
            width: width || "auto",
            maxWidth: "60vw",
            height: "auto",
            display: "block",
            borderRadius: 6,
            outline: selected
              ? "2px solid #3b82f6"
              : hovered
              ? "2px solid rgba(59,130,246,0.45)"
              : "2px solid transparent",
            outlineOffset: 2,
            userSelect: "none",
            transition: "outline 100ms",
            cursor: "grab",
          }}
          draggable={false}
        />

        {/* Poignée resize droite */}
        {selected && (
          <span
            onMouseDown={makeResizeHandler("right")}
            title="Redimensionner"
            style={{
              position: "absolute",
              bottom: -5,
              right: -5,
              display: "inline-block",
              width: 13,
              height: 13,
              background: "#3b82f6",
              border: "2px solid white",
              borderRadius: "50%",
              cursor: "se-resize",
              zIndex: 1001,
              boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
            }}
          />
        )}

        {/* Poignée resize gauche */}
        {selected && (
          <span
            onMouseDown={makeResizeHandler("left")}
            title="Redimensionner"
            style={{
              position: "absolute",
              bottom: -5,
              left: -5,
              display: "inline-block",
              width: 13,
              height: 13,
              background: "#3b82f6",
              border: "2px solid white",
              borderRadius: "50%",
              cursor: "sw-resize",
              zIndex: 1001,
              boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
            }}
          />
        )}
      </span>
    </NodeViewWrapper>
  );
}

export const ResizableImage = Node.create({
  name: "image",
  group: "inline",
  inline: true,
  atom: true,
  draggable: false, // On gère le drag manuellement
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: { default: null },
      align: { default: "center" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "img[src]",
        getAttrs: (el) => {
          const img = el as HTMLImageElement;
          const style = img.getAttribute("style") || "";
          let align: "left" | "center" | "right" = "center";
          if (style.includes("float: left")) align = "left";
          else if (style.includes("float: right")) align = "right";
          const widthMatch = style.match(/width:\s*([^;]+)/);
          return {
            src: img.getAttribute("src"),
            alt: img.getAttribute("alt"),
            title: img.getAttribute("title"),
            width: widthMatch ? widthMatch[1].trim() : null,
            align,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { align, width, src, alt, title } = HTMLAttributes;
    const floatStyle =
      align === "left"
        ? "float:left;margin:2px 14px 6px 0;"
        : align === "right"
        ? "float:right;margin:2px 0 6px 14px;"
        : "display:inline-block;vertical-align:middle;margin:2px 4px;";
    const style = `${floatStyle}${width ? `width:${width};` : ""}height:auto;border-radius:6px;`;
    return ["img", mergeAttributes({ src, alt: alt || "", title: title || "", style, draggable: "false" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});
