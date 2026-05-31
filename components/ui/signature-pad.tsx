"use client";

import { useEffect, useRef, useState } from "react";
import { EraserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SignaturePadProps {
  /// Data URL PNG (data:image/png;base64,...) ou "" si pas signé.
  value: string;
  onChange: (dataUrl: string) => void;
  /// Hauteur en pixels du canvas. Largeur = 100% du parent.
  height?: number;
  disabled?: boolean;
  ariaInvalid?: boolean;
  ariaLabel?: string;
}

/// Pad de signature dessinable au doigt (tablette/téléphone) ou à la souris (PC).
/// La signature est exportée en PNG transparent (data URL) et rendue ensuite
/// dans le PDF généré comme image embarquée sur le widget correspondant.
export function SignaturePad({
  value,
  onChange,
  height = 160,
  disabled = false,
  ariaInvalid,
  ariaLabel,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(!!value);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  // Redimensionne le canvas à la taille du conteneur (CSS), x device pixel ratio
  // pour rester net en HiDPI.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ratio = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#0f172a"; // slate-900

    // Si une valeur PNG est déjà fournie, on la restaure dans le canvas.
    if (value && value.startsWith("data:image")) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio);
        ctx.drawImage(img, 0, 0, canvas.width / ratio, canvas.height / ratio);
      };
      img.src = value;
    }
  }, [height, value]);

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    setDrawing(true);
    lastPoint.current = pointFromEvent(e);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const p = pointFromEvent(e);
    const last = lastPoint.current ?? p;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPoint.current = p;
    if (!hasInk) setHasInk(true);
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    setDrawing(false);
    lastPoint.current = null;
    try {
      (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    // Export en PNG transparent.
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange("");
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-md border bg-white"
        style={{ height }}
        data-invalid={ariaInvalid || undefined}
      >
        <canvas
          ref={canvasRef}
          aria-label={ariaLabel ?? "Zone de signature"}
          aria-invalid={ariaInvalid}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          // touch-action: none → désactive le scroll/zoom natif tactile
          // pendant qu'on dessine. Sinon, sur mobile, scroll vertical au lieu
          // de dessiner.
          className="block h-full w-full touch-none"
          style={{ cursor: disabled ? "not-allowed" : "crosshair" }}
        />
        {!hasInk && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            Signez ici avec le doigt, le stylet ou la souris
          </div>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {hasInk ? "Signature enregistrée." : "Aucune signature."}
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={clear}
          disabled={disabled || !hasInk}
        >
          <EraserIcon className="size-3.5" />
          Effacer
        </Button>
      </div>
    </div>
  );
}
