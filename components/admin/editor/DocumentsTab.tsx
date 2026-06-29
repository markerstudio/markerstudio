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

      <fieldset className="bg-white border border-neutral-200 rounded-xl p-6">
        <legend className="px-2 -ml-2 font-bold">Documents</legend>
        <p className="text-xs text-neutral-400 mb-3">Upload a PDF (or image) or paste a link — clients can open / download these.</p>
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
                {doc.url && <a href={doc.url} target="_blank" rel="noreferrer" className="text-xs font-medium text-neutral-600 hover:text-orange">Open ↗</a>}
              </div>
            </div>
          )} />
        <SaveButton onSave={() => saveSection(slug, { documents: data.documents })} />
      </fieldset>
    </div>
  );
}
