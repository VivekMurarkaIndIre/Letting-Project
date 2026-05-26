import { v4 as uuidv4 } from 'uuid';
import { ParsedSlotsResponse, ParsedSlotsResponseSchema, ViewingSlot } from '../models/schemas';
import { COLLECTIONS, createDoc, queryCollection } from './firebase';
import { generateObject, getModel } from './llm';

/**
 * Sends a natural-language scheduling request to the LLM and returns a
 * structured ParsedSlotsResponse.
 *
 * todayDate (YYYY-MM-DD) is injected into the prompt so the model can resolve
 * relative expressions like "next Tuesday" or "this weekend" correctly.
 *
 * When the input is genuinely ambiguous the model is instructed to set
 * ambiguous:true and populate clarifyingQuestion — the caller should surface
 * that question to the admin rather than proceeding to slot creation.
 */
export async function parseNaturalLanguageSlots(
  input: string,
  todayDate: string
): Promise<ParsedSlotsResponse> {
  const { object } = await generateObject({
    model: getModel(),
    schema: ParsedSlotsResponseSchema,
    prompt: `
You are a property-viewing scheduling assistant.
Today's date is ${todayDate}.

Parse the admin's request below and return a structured response.

Rules:
- Resolve relative dates ("next Tuesday", "this Friday") using today's date.
- Return all dates as YYYY-MM-DD and all times as HH:MM (24-hour clock).
- "morning" means the first slot starts at 09:00.
- "afternoon" means the first slot starts at 13:00.
- Space multiple slots evenly through the stated period when a count is given
  (e.g. "3 viewings in the afternoon" → 13:00, 14:00, 15:00).
- Default slot duration is 60 minutes unless the admin specifies otherwise.
- Default maxAttendees is 1 unless the admin specifies otherwise.
- Extract every person's name mentioned as a prospective viewer into leadNames.
- If the request is clear, set ambiguous to false and omit clarifyingQuestion.
- If critical information is missing or contradictory (e.g. no property address,
  no date, impossible time range), set ambiguous to true and populate
  clarifyingQuestion with a single, specific question that would resolve the
  ambiguity.

Admin request:
"${input}"
    `.trim(),
  });

  return object;
}

/**
 * Persists a set of confirmed viewing slots to Firestore.
 *
 * Each slot from the LLM response is enriched with a uuid, a zero attendee
 * count, and a creation timestamp before being written. The full ViewingSlot
 * objects are returned so the caller can pass them downstream (e.g. to the
 * invitation service) without a second read.
 */
export async function createViewingSlots(
  parsedSlots: ParsedSlotsResponse
): Promise<ViewingSlot[]> {
  const created: ViewingSlot[] = [];

  for (const slot of parsedSlots.slots) {
    const viewingSlot: ViewingSlot = {
      ...slot,
      id: uuidv4(),
      currentAttendees: 0,
      createdAt: new Date().toISOString(),
    };

    await createDoc<ViewingSlot>(COLLECTIONS.SLOTS, viewingSlot);
    created.push(viewingSlot);
  }

  return created;
}

/**
 * Returns all viewing slots for a given property address.
 * Includes full slots regardless of availability.
 */
export async function getSlotsByProperty(propertyAddress: string): Promise<ViewingSlot[]> {
  return queryCollection<ViewingSlot>(COLLECTIONS.SLOTS, 'propertyAddress', '==', propertyAddress);
}

/**
 * Returns only slots that still have capacity (currentAttendees < maxAttendees).
 *
 * Filtering is done in application code rather than Firestore because a
 * compound index would be required for a server-side inequality query on
 * a different field than the equality filter, and this collection is expected
 * to remain small per property.
 */
export async function getAvailableSlotsByProperty(propertyAddress: string): Promise<ViewingSlot[]> {
  const slots = await getSlotsByProperty(propertyAddress);
  return slots.filter((slot) => slot.currentAttendees < slot.maxAttendees);
}
