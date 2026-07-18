"use server";

// Snoozing an agenda item — the agenda stays derived (lib/agenda.ts), this
// only records "don't show this signal again until <date>" in studio_state.
// Real resolutions (paying the invoice, unpinning the note, posting the post)
// still clear items for good; a snooze just buys quiet in the meantime.

import { revalidatePath } from "next/cache";
import { getSession, isPartnerOnly } from "@/lib/auth";
import { saveAgendaSnooze } from "@/lib/studio";
import { agendaToday, agendaAddDays } from "@/lib/agenda";

type Result = { ok: boolean; error?: string };

export async function snoozeAgendaItem(id: string, days: number): Promise<Result> {
  const user = await getSession();
  if (!user || isPartnerOnly(user)) return { ok: false, error: "No access." };
  if (typeof id !== "string" || !id || id.length > 300) return { ok: false, error: "Bad item." };
  const today = agendaToday();
  const until = agendaAddDays(today, days === 7 ? 7 : 1);
  try {
    const ok = await saveAgendaSnooze(id, until, today);
    revalidatePath("/admin/agenda");
    revalidatePath("/admin");
    return { ok };
  } catch {
    return { ok: false, error: "Couldn't save the snooze." };
  }
}
