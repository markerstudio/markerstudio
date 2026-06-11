"use client";

// Statement of account — a printable A4 document the client can download:
// every payment / invoice with dates and status, totals, and the current
// balance. PDF via print; CSV for raw data. Bilingual like the other docs.

import "./doc.css";
import { useCallback, useEffect, useRef, useState } from "react";

const LOGO_LIGHT = "/assets/logo-primary-transparent.png";

export type StatementRow = {
  date: string; // issue / pay date (ISO) — may be empty for undated history
  number?: string; // invoice number when it's a real invoice
  label: string;
  total: number;
  paid: number;
  status: "paid" | "partial" | "due" | "overdue" | "draft";
  dueDate?: string;
  amountLabel?: string; // original free-text amount when no numeric total
};

export type StatementSummary = {
  totalBilled: number;
  totalPaid: number;
  totalOpen: number;
  balance: string; // the combined "money left" figure (free text, e.g. "600 ILS")
  monthlyFee: string;
  currency: string;
};

const UI = {
  en: {
    eyebrow: "Statement of Account",
    title: "Payment\n*statement*.",
    confidential: "Confidential",
    backPortal: "← Portal",
    exportPdf: "Export PDF",
    exportCsv: "Download CSV",
    issued: "Issued",
    date: "Date",
    number: "Invoice",
    item: "Item",
    due: "Due",
    amount: "Amount",
    paid: "Paid",
    status: "Status",
    statuses: { paid: "Paid", partial: "Partial", due: "Due", overdue: "Overdue", draft: "Draft" },
    totalBilled: "Total billed",
    totalPaid: "Total paid",
    totalOpen: "Still open",
    balance: "Money left (balance)",
    monthlyFee: "Monthly fee",
    empty: "No payments recorded yet.",
    note: "This statement reflects the records held by Marker Studio® on the issue date. For questions: create@marker.ps · +970 568 08 14 08",
  },
  ar: {
    eyebrow: "كشف حساب",
    title: "كشف\n*المدفوعات*.",
    confidential: "سري",
    backPortal: "البوابة ←",
    exportPdf: "تصدير PDF",
    exportCsv: "تنزيل CSV",
    issued: "صدر في",
    date: "التاريخ",
    number: "الفاتورة",
    item: "البند",
    due: "الاستحقاق",
    amount: "المبلغ",
    paid: "المدفوع",
    status: "الحالة",
    statuses: { paid: "مدفوعة", partial: "جزئية", due: "مستحقة", overdue: "متأخرة", draft: "مسودة" },
    totalBilled: "إجمالي الفواتير",
    totalPaid: "إجمالي المدفوع",
    totalOpen: "المتبقي المفتوح",
    balance: "المبلغ المتبقي (الرصيد)",
    monthlyFee: "الاشتراك الشهري",
    empty: "لا مدفوعات مسجّلة بعد.",
    note: "يعكس هذا الكشف سجلات Marker Studio® بتاريخ الإصدار. للاستفسار: create@marker.ps · ‎+970 568 08 14 08",
  },
} as const;

export default function StatementDocument({
  clientName,
  clientSlug,
  rows,
  summary,
  initialLang = "en",
}: {
  clientName: string;
  clientSlug: string;
  rows: StatementRow[];
  summary: StatementSummary;
  initialLang?: "en" | "ar";
}) {
  const [lang, setLang] = useState<"en" | "ar">(initialLang);
  const t = UI[lang];

  // fit-to-width scaling (same approach as the other documents)
  const viewportRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const vp = viewportRef.current;
    const dc = docRef.current;
    if (!vp || !dc) return;
    const probe = document.createElement("div");
    probe.style.cssText = "width:210mm;position:absolute;visibility:hidden";
    document.body.appendChild(probe);
    const nat = probe.offsetWidth;
    probe.remove();
    const fit = () => {
      if (window.innerWidth <= 760) {
        dc.style.transform = "none";
        return;
      }
      dc.style.transform = `scale(${Math.min(1, (vp.clientWidth - 36) / nat)})`;
    };
    fit();
    const t1 = setTimeout(fit, 150);
    window.addEventListener("resize", fit);
    const before = () => (dc.style.transform = "none");
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", fit);
    return () => {
      clearTimeout(t1);
      window.removeEventListener("resize", fit);
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", fit);
    };
  }, []);

  const fmt = (n: number) => `${Math.round(n).toLocaleString("en-US")} ${summary.currency}`;
  const fmtDate = useCallback(
    (iso?: string) => (iso ? new Date(iso).toLocaleDateString(lang === "ar" ? "ar" : "en-GB") : "—"),
    [lang]
  );
  const today = new Date().toLocaleDateString(lang === "ar" ? "ar" : "en-GB");

  function downloadCsv() {
    const head = ["Date", "Invoice", "Item", "Due", "Total", "Paid", "Status"];
    const lines = rows.map((r) =>
      [r.date || "", r.number || "", `"${(r.label || "").replace(/"/g, '""')}"`, r.dueDate || "", r.total || r.amountLabel || "", r.paid, r.status].join(",")
    );
    const totals = ["", "", "Totals", "", summary.totalBilled, summary.totalPaid, `balance: ${summary.balance || "0"}`].join(",");
    const blob = new Blob(["﻿" + [head.join(","), ...lines, totals].join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${clientSlug}-statement-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const pill = (s: StatementRow["status"]) => (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        fontSize: 8,
        fontWeight: 800,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        background: s === "paid" ? "rgba(43,182,115,.15)" : s === "overdue" ? "rgba(215,38,61,.12)" : s === "partial" ? "#FFE3BF" : "#EEE",
        color: s === "paid" ? "#1f9d63" : s === "overdue" ? "#c94b4b" : s === "partial" ? "#E07E00" : "#757575",
        borderRadius: 999,
        whiteSpace: "nowrap",
      }}
    >
      {t.statuses[s]}
    </span>
  );

  return (
    <div className="mdoc" data-cover="paper" data-accent="orange" data-display="bold" data-nums="solid" data-brush="on" data-lang={lang} dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="mdoc-viewport" ref={viewportRef}>
        <div className="mdoc-doc" ref={docRef}>
          <section className="page white flow">
            <header className="ph">
              <div className="pl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={LOGO_LIGHT} alt="" />
                <span>{t.eyebrow}</span>
              </div>
              <div className="phr">{clientName} · Marker Studio®</div>
            </header>
            <div className="pbody">
              <div className="head">
                <div className="num">₪</div>
                <div className="ttl">
                  <div className="kicker">{t.eyebrow}</div>
                  <h2 className="title">
                    {t.title.split("\n").map((line, i) => (
                      <span key={i}>
                        {i > 0 && <br />}
                        {line.startsWith("*") ? <em>{line.replace(/\*/g, "")}</em> : line.replace(/\*/g, "")}
                      </span>
                    ))}
                  </h2>
                </div>
                <div className="pager">
                  {t.issued}
                  <b style={{ fontSize: 13, letterSpacing: 0 }}>{today}</b>
                </div>
              </div>

              {/* summary boxes */}
              <div className="tl-foot" style={{ marginTop: 0, marginBottom: 22, gridTemplateColumns: "repeat(4, 1fr)" }}>
                <div className="tf">
                  <div className="tfl">{t.totalBilled}</div>
                  <div className="tfv">{fmt(summary.totalBilled)}</div>
                </div>
                <div className="tf">
                  <div className="tfl">{t.totalPaid}</div>
                  <div className="tfv" style={{ color: "#1f9d63" }}>{fmt(summary.totalPaid)}</div>
                </div>
                <div className="tf">
                  <div className="tfl">{t.totalOpen}</div>
                  <div className="tfv" style={{ color: summary.totalOpen > 0 ? "#E07E00" : undefined }}>
                    {summary.totalOpen > 0 ? fmt(summary.totalOpen) : "—"}
                  </div>
                </div>
                <div className="tf" style={{ background: "#1A1A1A" }}>
                  <div className="tfl" style={{ color: "rgba(255,255,255,.6)" }}>{t.balance}</div>
                  <div className="tfv" style={{ color: "#FF9100" }}>{summary.balance || "0"}</div>
                </div>
              </div>

              {/* rows */}
              {rows.length === 0 ? (
                <p className="lead">{t.empty}</p>
              ) : (
                <table className="tl" style={{ marginTop: 4 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "start", width: "14%" }}>{t.date}</th>
                      <th style={{ textAlign: "start", width: "15%" }}>{t.number}</th>
                      <th style={{ textAlign: "start" }}>{t.item}</th>
                      <th style={{ textAlign: "end", width: "13%" }}>{t.amount}</th>
                      <th style={{ textAlign: "end", width: "13%" }}>{t.paid}</th>
                      <th style={{ textAlign: "center", width: "12%" }}>{t.status}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontSize: 10.5, color: "#555", whiteSpace: "nowrap" }}>{fmtDate(r.date)}</td>
                        <td style={{ fontSize: 10.5, fontFamily: "monospace", color: "#555" }}>{r.number || "—"}</td>
                        <td className="phase" style={{ fontSize: 11.5 }}>
                          {r.label}
                          {r.dueDate && (
                            <span style={{ fontFamily: "inherit", direction: "inherit", fontSize: 9.5 }}>
                              {t.due} {fmtDate(r.dueDate)}
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: "end", fontSize: 11.5, fontWeight: 700, color: "#1A1A1A", whiteSpace: "nowrap" }}>
                          {r.total ? fmt(r.total) : r.amountLabel || "—"}
                        </td>
                        <td style={{ textAlign: "end", fontSize: 11, color: r.paid ? "#1f9d63" : "#A8A8A8", whiteSpace: "nowrap" }}>
                          {r.paid ? fmt(r.paid) : "—"}
                        </td>
                        <td style={{ textAlign: "center" }}>{pill(r.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {summary.monthlyFee && (
                <p className="pricing-note" style={{ marginTop: 16 }}>
                  {t.monthlyFee}: {summary.monthlyFee}
                </p>
              )}
              <p className="pricing-note" style={{ marginTop: 6 }}>{t.note}</p>
            </div>
            <footer className="pf">
              <div className="pl2">{t.confidential} · marker.ps</div>
              <div className="pg">
                <b>01</b> / 01
              </div>
            </footer>
          </section>
        </div>
      </div>

      <a className="mdoc-back" href={`/portal/${clientSlug}`}>
        {t.backPortal}
      </a>
      <div className="mdoc-langchip" role="group" aria-label="Language">
        <button type="button" className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>EN</button>
        <button type="button" className={lang === "ar" ? "active" : ""} onClick={() => setLang("ar")}>AR</button>
      </div>
      <button type="button" className="mdoc-pdfbtn" onClick={() => window.print()}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" />
        </svg>
        {t.exportPdf}
      </button>
      <button
        type="button"
        className="mdoc-pdfbtn"
        style={{ left: "auto", right: 22, bottom: 80, background: "#1A1A1A", boxShadow: "0 16px 40px rgba(0,0,0,.3)" }}
        onClick={downloadCsv}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
        {t.exportCsv}
      </button>
    </div>
  );
}
