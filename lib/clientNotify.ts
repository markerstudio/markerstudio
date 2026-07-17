// Best-effort push nudges to a client's subscribed devices — fired when the
// studio does something the client should act on (proposal/agreement sent,
// invoice issued, post awaiting approval). Never throws and never blocks the
// action that triggered it: where push isn't configured or the client never
// tapped "Get updates", this quietly does nothing.
import { isPushConfigured, sendPushTo, type PushPayload } from "@/lib/push";

export async function notifyClientDevices(clientId: number, payload: PushPayload): Promise<void> {
  try {
    if (!isPushConfigured()) return;
    await sendPushTo({ kind: "client", clientId }, payload);
  } catch {
    /* courtesy only — the triggering action already succeeded */
  }
}
