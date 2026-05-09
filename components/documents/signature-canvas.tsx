"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, Type, Pen, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type SignatureMethod = "drawn" | "typed" | "uploaded";

export interface SignatureResult {
  /** Data URL (PNG, transparent background) */
  dataUrl: string;
  method: SignatureMethod;
}

interface SignatureCanvasProps {
  /** Hauteur du canvas (largeur = 100% du parent) */
  height?: number;
  /** Couleur du trait (par défaut noir) */
  color?: string;
  /** Épaisseur du trait */
  lineWidth?: number;
  /** Fonction appelée quand la signature change (vide ou non) */
  onChange?: (result: SignatureResult | null) => void;
  /** Désactive le canvas */
  disabled?: boolean;
}

/**
 * Composant de signature électronique par dessin (canvas tactile/souris).
 * Supporte 3 modes : dessin, texte (police cursive), upload image.
 * Sortie : data URL PNG sur fond transparent.
 */
export function SignatureCanvas({
  height = 200,
  color = "#000000",
  lineWidth = 2,
  onChange,
  disabled = false,
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [empty, setEmpty] = useState(true);
  const [mode, setMode] = useState<SignatureMethod>("drawn");
  const [typedText, setTypedText] = useState("");
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // Setup canvas (HiDPI scaling + initial transparent background)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
  }, [color, lineWidth, height]);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    setDrawing(true);
    lastPos.current = getPos(e);
  }

  function draw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing || disabled) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !lastPos.current) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    if (empty) {
      setEmpty(false);
      emitChange("drawn");
    }
  }

  function endDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    e.preventDefault();
    canvasRef.current?.releasePointerCapture(e.pointerId);
    setDrawing(false);
    lastPos.current = null;
    if (!empty) emitChange("drawn");
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
    setTypedText("");
    onChange?.(null);
  }

  function emitChange(method: SignatureMethod) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    onChange?.({ dataUrl, method });
  }

  function renderTyped(text: string) {
    setTypedText(text);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!text.trim()) {
      setEmpty(true);
      onChange?.(null);
      return;
    }
    // Police "manuscrite" — fallback si non installée
    ctx.font = `italic 42px "Brush Script MT", "Lucida Handwriting", "Comic Sans MS", cursive`;
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(text, w / 2, h / 2, w * 0.95);
    setEmpty(false);
    emitChange("typed");
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.width / dpr;
        const h = canvas.height / dpr;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Fit image dans le canvas en gardant l'aspect ratio
        const ratio = Math.min(w / img.width, h / img.height);
        const drawW = img.width * ratio;
        const drawH = img.height * ratio;
        ctx.drawImage(img, (w - drawW) / 2, (h - drawH) / 2, drawW, drawH);
        setEmpty(false);
        emitChange("uploaded");
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 items-center">
        <Button
          type="button"
          variant={mode === "drawn" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setMode("drawn");
            clear();
          }}
          disabled={disabled}
        >
          <Pen className="w-4 h-4 mr-1" />
          Dessiner
        </Button>
        <Button
          type="button"
          variant={mode === "typed" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setMode("typed");
            clear();
          }}
          disabled={disabled}
        >
          <Type className="w-4 h-4 mr-1" />
          Taper
        </Button>
        <Button
          type="button"
          variant={mode === "uploaded" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setMode("uploaded");
            clear();
          }}
          disabled={disabled}
        >
          <Upload className="w-4 h-4 mr-1" />
          Importer
        </Button>
        <span className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clear}
          disabled={disabled || empty}
        >
          <Eraser className="w-4 h-4 mr-1" />
          Effacer
        </Button>
      </div>

      {mode === "typed" && (
        <Input
          value={typedText}
          onChange={(e) => renderTyped(e.target.value)}
          placeholder="Tapez votre nom complet"
          disabled={disabled}
          className="text-base"
          maxLength={80}
        />
      )}

      {mode === "uploaded" && (
        <Input
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          onChange={handleUpload}
          disabled={disabled}
          className="text-sm"
        />
      )}

      <div
        className="border-2 border-dashed rounded-md bg-white relative"
        style={{ height: `${height}px` }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={mode === "drawn" ? startDraw : undefined}
          onPointerMove={mode === "drawn" ? draw : undefined}
          onPointerUp={mode === "drawn" ? endDraw : undefined}
          onPointerLeave={mode === "drawn" ? endDraw : undefined}
          className={`w-full h-full ${mode === "drawn" ? "cursor-crosshair touch-none" : "pointer-events-none"}`}
          style={{ touchAction: "none" }}
        />
        {empty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-muted-foreground text-sm">
            {mode === "drawn"
              ? "Signez ici"
              : mode === "typed"
              ? "Tapez votre nom dans le champ ci-dessus"
              : "Sélectionnez une image"}
          </div>
        )}
      </div>
    </div>
  );
}
