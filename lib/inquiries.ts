// Contact-form submissions ("inquiries"). Stored in the same Neon database the
// admin uses for projects/clients, and read back in /admin/inquiries.
import { getSql } from "@/lib/db";

export type Inquiry = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  brand: string | null;
  service: string | null;
  message: string | null;
  lang: string | null;
  created_at: string;
  read_at: string | null;
};

export async function ensureInquiriesTable(): Promise<void> {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS inquiries (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      brand TEXT,
      service TEXT,
      message TEXT,
      lang TEXT DEFAULT 'en',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      read_at TIMESTAMPTZ
    )
  `;
}

export async function createInquiry(i: {
  name: string;
  email: string;
  phone?: string;
  brand?: string;
  service?: string;
  message?: string;
  lang?: string;
}): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO inquiries (name, email, phone, brand, service, message, lang)
    VALUES (${i.name}, ${i.email}, ${i.phone || null}, ${i.brand || null},
            ${i.service || null}, ${i.message || null}, ${i.lang || "en"})
  `;
}

export async function listInquiries(): Promise<Inquiry[]> {
  const sql = getSql();
  return (await sql`
    SELECT id, name, email, phone, brand, service, message, lang, created_at, read_at
    FROM inquiries ORDER BY created_at DESC LIMIT 500
  `) as unknown as Inquiry[];
}

// Unread count for the admin nav badge. Swallows errors (e.g. table not created
// yet) so it never breaks the layout.
export async function countUnreadInquiries(): Promise<number> {
  try {
    const sql = getSql();
    const r = (await sql`SELECT count(*)::int AS n FROM inquiries WHERE read_at IS NULL`) as unknown as { n: number }[];
    return r[0]?.n ?? 0;
  } catch {
    return 0;
  }
}
