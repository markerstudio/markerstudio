"use client";

import { useEffect, useRef, useState } from "react";

/* Hand-drawn signature capture. A plain <canvas> driven by pointer events, so
   it works the same with a mouse, a finger, or an Apple Pencil. The drawing is
   exported as a PNG data URL into a hidden input (default name "signature")
   so it submits with any surrounding <form>. */
export default function SignaturePad({
  name = "signature",
  label,
  clearLabel,
  hint,
  onChange,
}: {
  name?: string;
  label?: string;
  clearLabel: string;
  hint: string;
  onChange?: (drawn: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);
  const [drawn, setDrawn] = useState(false);

  // Size the canvas to its container once on mount, scaled for the device
  // pixel ratio so strokes stay crisp on retina/iPad screens.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.25;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#1a1a1a";
    }
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    // A dot for taps, so a single touch still leaves a mark.
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas && inputRef.current) inputRef.current.value = canvas.toDataURL("image/png");
    if (!drawn) {
      setDrawn(true);
      onChange?.(true);
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    if (inputRef.current) inputRef.current.value = "";
    setDrawn(false);
    onChange?.(false);
  };

  return (
    <div>
      {label && (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-neutral-900">{label}</span>
          <button
            type="button"
            onClick={clear}
            className={`text-xs font-semibold ${drawn ? "text-orange hover:text-orange-deep" : "text-neutral-300"}`}
          >
            {clearLabel}
          </button>
        </div>
      )}
      <div className="relative overflow-hidden rounded-md border border-dashed border-neutral-300 bg-white">
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          className="block h-44 w-full cursor-crosshair"
          style={{ touchAction: "none" }}
        />
        {!drawn && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-neutral-300">
            {hint}
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-6 bottom-9 border-b border-neutral-200" />
      </div>
      <input ref={inputRef} type="hidden" name={name} />
    </div>
  );
}
