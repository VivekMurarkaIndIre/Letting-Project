import { google } from 'googleapis';
import { ViewingSlot } from '../models/schemas';
import { db } from './firebase';
import { getAuthenticatedClient } from './googleAuth';

async function getAdminTokens(): Promise<any | null> {
  const doc = await db.collection('admin').doc('tokens').get();
  if (!doc.exists) {
    console.warn('[calendar] No admin tokens found — skipping calendar event');
    return null;
  }
  return doc.data();
}

export async function addSlotToCalendar(slot: ViewingSlot): Promise<void> {
  const tokens = await getAdminTokens();
  if (!tokens) return;

  try {
    const client = getAuthenticatedClient(tokens);
    const calendar = google.calendar({ version: 'v3', auth: client });

    const [hours, minutes] = slot.time.split(':').map(Number);
    const startMs = new Date(`${slot.date}T${slot.time}:00`).getTime();
    const endMs = startMs + slot.duration * 60 * 1000;
    const endDate = new Date(endMs);
    const endDateTime = `${slot.date}T${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}:00`;

    await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: `Property Viewing — ${slot.propertyAddress}`,
        description: 'Viewing slot created via Lette Property Manager',
        start: {
          dateTime: `${slot.date}T${slot.time}:00`,
          timeZone: 'Europe/Dublin',
        },
        end: {
          dateTime: endDateTime,
          timeZone: 'Europe/Dublin',
        },
      },
    });

    console.log(`[calendar] Event added for ${slot.propertyAddress} on ${slot.date}`);
  } catch (err: any) {
    console.error('[calendar] Failed to add event:', err.message);
  }
}
