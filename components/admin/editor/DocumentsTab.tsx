"use client";

import type { ReactNode } from "react";
import FileUpload from "@/components/FileUpload";
import { saveSection } from "@/app/admin/clients/section-actions";
import { Text, Rows, SaveButton } from "./fields";
import type { ClientData, DocItem } from "@/lib/clients";

// Mirrors the portal's Documents tab: client-facing files, plus (server-rendered)
// the proposal & agreement builder cards passed in as a slot.
export default function DocumentsTab({ slug, data, patch, docsSlot }: { slug: string; data: ClientData; patch: (p: Partial<ClientData>) => void; docsSlot?: ReactNode }) {
  return (
    <div className="space-y-6">
      {docsSlot}

      <section className="lq-card p-5">
        <h2 className="font-display font-bold text-[16px] tracking-tight text-ink mb-1">Client files</h2>
        <p className="text-[12.5px] text-charcoal-60 mb-4">Upload a PDF (or image) or paste a link — clients can open / download these from their portal.</p>
        <Rows<DocItem> items={data.documents} onChange={(documents) => patch({ documents })} blank={{ title: "", type: "PDF", url: "" }} addLabel="Add document"
          render={(doc, set) => (
            <div className="pr-16">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Text label="Title" value={doc.title} onChange={(title) => set({ title })} placeholder="Proposal" />
                <Text label="Type" value={doc.type} onChange={(type) => set({ type })} placeholder="PDF" />
                <Text label="URL" value={doc.url} onChange={(url) => set({ url })} placeholder="https://…" />
              </div>
              <div className="mt-2 flex items-center gap-3 flex-wrap">
                <FileUpload accept="application/pdf,image/*" label="Upload PDF" compact
                  onUploaded={({ url, name, contentType }) => set({ url, title: doc.title || name.replace(/\.[^.]+$/, ""), type: contentType.includes("pdf") ? "PDF" : doc.type || "File" })} />
                {doc.url && <a href={doc.url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-charcoal-60 hover:text-orange-deep no-underline">Open ↗</a>}
              </div>
            </div>
          )} />
        <SaveButton onSave={() => saveSection(slug, { documents: data.documents })} />
      </fieldset>
    </div>
  );
}
