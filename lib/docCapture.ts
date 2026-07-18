"use client";

// Client-side capture of the page's document node ([data-doc], falling back
// to <main>) → a PNG snapshot or a paginated A4 PDF. Works the same in the
// browser and the desktop app: the DMG saves through the native panel via
// the bridge's saveFile; browsers get a normal download. The heavy libraries
// (html2canvas, jspdf) load on first click so document pages stay light.

type Bridge = {
  __MARKER_DESKTOP__?: boolean;
  __MARKER_NATIVE__?: {
    saveFile?: (filename: string, base64: string) => Promise<boolean>;
  };
};

function docNode(): HTMLElement {
  return (
    (document.querySelector("[data-doc]") as HTMLElement | null) ||
    (document.querySelector("main") as HTMLElement | null) ||
    document.body
  );
}

async function capture(): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import("html2canvas");
  return html2canvas(docNode(), {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("capture failed"))), type, quality)
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function safeName(basename: string, ext: string): string {
  const clean = basename.replace(/[\\/:*?"<>|]/g, "-").trim().slice(0, 120) || "document";
  return `${clean}.${ext}`;
}

/** True when the file was handed to the user; false when the caller should
 *  fall back (a pre-0.5.1 desktop app without the saveFile bridge). */
async function deliver(filename: string, blob: Blob): Promise<boolean> {
  const w = window as Bridge;
  if (w.__MARKER_DESKTOP__) {
    if (!w.__MARKER_NATIVE__?.saveFile) return false;
    await w.__MARKER_NATIVE__.saveFile(filename, await blobToBase64(blob));
    return true;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}

export async function downloadDocImage(basename: string): Promise<boolean> {
  const canvas = await capture();
  const blob = await canvasToBlob(canvas, "image/png");
  return deliver(safeName(basename, "png"), blob);
}

export async function downloadDocPdf(basename: string): Promise<boolean> {
  const canvas = await capture();
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  // A4 with a small owned margin; tall documents slice into extra pages.
  const pageW = 210;
  const pageH = 297;
  const margin = 8;
  const innerW = pageW - margin * 2;
  const innerH = pageH - margin * 2;
  const pxPerMm = canvas.width / innerW;
  const pagePx = Math.max(1, Math.floor(innerH * pxPerMm));
  let y = 0;
  let first = true;
  while (y < canvas.height) {
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = Math.min(pagePx, canvas.height - y);
    const ctx = slice.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, y, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
    if (!first) pdf.addPage();
    pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, innerW, slice.height / pxPerMm);
    first = false;
    y += pagePx;
  }
  return deliver(safeName(basename, "pdf"), pdf.output("blob"));
}
