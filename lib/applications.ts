// Careers / "work with us" applications. Stored in the same Neon database the
// admin uses, and read back in /admin/applications.
import { getSql } from "@/lib/db";

export type Application = {
  id: number;
  first_name: string;
  last_name: string;
  gender: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  talent: string | null;
  rate_session: string | null; // expected rate per session (modeling only)
  rate: string | null; // rate per project / per hour
  instagram: string | null;
  work_url: string | null; // "show your work" — portfolio link
  lang: string | null;
  created_at: string;
  read_at: string | null;
};

export async function ensureApplicationsTable(): Promise<void> {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS applications (
      id SERIAL PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      gender TEXT,
      email TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      talent TEXT,
      rate_session TEXT,
      rate TEXT,
      instagram TEXT,
      work_url TEXT,
      lang TEXT DEFAULT 'en',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      read_at TIMESTAMPTZ
    )
  `;
}

export async function createApplication(a: {
  firstName: string;
  lastName: string;
  gender?: string;
  email: string;
  phone?: string;
  address?: string;
  talent?: string;
  rateSession?: string;
  rate?: string;
  instagram?: string;
  workUrl?: string;
  lang?: string;
}): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO applications (first_name, last_name, gender, email, phone, address, talent, rate_session, rate, instagram, work_url, lang)
    VALUES (${a.firstName}, ${a.lastName}, ${a.gender || null}, ${a.email}, ${a.phone || null}, ${a.address || null},
            ${a.talent || null}, ${a.rateSession || null}, ${a.rate || null}, ${a.instagram || null}, ${a.workUrl || null}, ${a.lang || "en"})
  `;
}

export async function listApplications(): Promise<Application[]> {
  const sql = getSql();
  return (await sql`
    SELECT id, first_name, last_name, gender, email, phone, address, talent, rate_session, rate, instagram, work_url, lang, created_at, read_at
    FROM applications ORDER BY created_at DESC LIMIT 500
  `) as unknown as Application[];
}

// Unread count for the admin nav badge. Swallows errors (e.g. table not created
// yet) so it never breaks the layout.
export async function countUnreadApplications(): Promise<number> {
  try {
    const sql = getSql();
    const r = (await sql`SELECT count(*)::int AS n FROM applications WHERE read_at IS NULL`) as unknown as { n: number }[];
    return r[0]?.n ?? 0;
  } catch {
    return 0;
  }
}
