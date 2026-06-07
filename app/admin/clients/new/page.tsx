import Link from "next/link";
import ClientForm from "@/components/admin/ClientForm";

export const dynamic = "force-dynamic";

export default function NewClientPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">New client</h1>
        <Link href="/admin/clients" className="text-sm text-neutral-500 hover:text-neutral-900">← Back</Link>
      </div>
      <ClientForm />
    </div>
  );
}
