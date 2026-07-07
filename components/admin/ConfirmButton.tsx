"use client";

/* Submit button that asks before letting the surrounding form action run.
   Two-step inline confirm instead of window.confirm(): browsers can suppress
   native dialogs entirely (which made every delete in the app look dead).
   First click arms the button and shows the question; a second click within
   4 seconds submits the form; waiting or clicking elsewhere disarms. */
import { useEffect, useRef, useState } from "react";

export default function ConfirmButton({
  message,
  confirmLabel,
  className = "",
  children,
}: {
  message: string;
  /** Short armed-state label; defaults to the message (keep messages short). */
  confirmLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [armed, setArmed] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    const away = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setArmed(false);
    };
    window.addEventListener("mousedown", away);
    return () => {
      clearTimeout(t);
      window.removeEventListener("mousedown", away);
    };
  }, [armed]);

  return (
    <button
      ref={ref}
      className={`${className} ${armed ? "!text-white !bg-rose-600 rounded-full px-2.5 animate-pulse" : ""}`}
      title={armed ? undefined : message}
      onClick={(e) => {
        if (!armed) {
          e.preventDefault();
          setArmed(true);
        }
        // armed: let the click submit the surrounding form action
      }}
    >
      {armed ? confirmLabel || "Sure? Tap again" : children}
    </button>
  );
}
