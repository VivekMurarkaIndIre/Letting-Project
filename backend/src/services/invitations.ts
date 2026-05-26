import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { Invitation, Lead, ViewingSlot } from '../models/schemas';
import { COLLECTIONS, createDoc, getDoc, queryCollection, updateDoc } from './firebase';
import { sendInvitationEmail, sendSlotFullEmail } from './email';
import { generateObject, getModel } from './llm';
import { getAvailableSlotsByProperty } from './slots';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ---- drafting -----------------------------------------------------------

/**
 * Asks the LLM to write a warm, personalised invitation email for a specific
 * lead and slot. Any notes stored on the lead are included so the model can
 * tailor the message (e.g. "John is relocating from abroad — mention flexible
 * viewing times").
 *
 * Optional `feedback` is injected when the judge rejected a previous attempt;
 * it tells the model specifically what to fix on the retry.
 */
export async function draftInvitationMessage(
  slot: ViewingSlot,
  lead: Lead,
  feedback?: string
): Promise<string> {
  const { object } = await generateObject({
    model: getModel(),
    schema: z.object({ message: z.string() }),
    prompt: `
You are a property manager's assistant writing a viewing invitation email.

Property details:
- Address: ${slot.propertyAddress}
- Date: ${slot.date}
- Time: ${slot.time}
- Duration: ${slot.duration} minutes

Prospective viewer:
- Name: ${lead.name}
- Email: ${lead.email}
${lead.notes ? `- Notes: ${lead.notes}` : ''}

Write a warm, professional invitation email addressed to ${lead.name}.
Guidelines:
- Keep it under 150 words.
- Use a friendly but professional tone.
- Include all the property and time details above.
- If notes about the viewer are provided, personalise the message accordingly.
- Do not invent any details that are not provided.
- Do not include a subject line — body text only.
${feedback ? `\nPrevious attempt was rejected because: ${feedback}. Fix this issue.` : ''}
    `.trim(),
  });

  return object.message;
}

/**
 * Uses the LLM as a judge to verify that a drafted message meets quality
 * standards. Checks factual correctness, personalisation, and tone.
 */
async function judgeInvitationMessage(
  message: string,
  slot: ViewingSlot,
  lead: Lead
): Promise<{ pass: boolean; reason: string }> {
  const { object } = await generateObject({
    model: getModel(),
    schema: z.object({ pass: z.boolean(), reason: z.string() }),
    prompt: `
You are a quality-control reviewer for property viewing invitation emails.

Allowed context the email may reference:
- Property address: "${slot.propertyAddress}"
- Date: "${slot.date}"
- Time: "${slot.time}"
- Duration: "${slot.duration} minutes"
- Lead name: "${lead.name}"
- Lead email: "${lead.email}"
${lead.notes ? `- Lead notes (may be referenced): "${lead.notes}"` : '- No additional lead notes provided'}

The email is allowed to mention any detail from the above list.

Evaluate the email below against ALL of these rules:
1. References the property address in a recognisable way. The drafter may reformat,
   clean up capitalisation, or reorder parts of the address — pass if the key
   components (street name, number, postcode) are present in any reasonable format.
   Fail only if a completely different or fabricated address appears.
2. Contains the correct date.
3. Contains the correct time.
4. Addresses the lead by their name (${lead.name}).
5. Does not contain unfilled template placeholders enclosed in square brackets,
   such as [Your Name], [Property Manager], or [Date]. Generic professional
   sign-offs such as "Property Management Team", "The Lettings Team", or
   "Kind regards" are NOT placeholders and must NOT be flagged.
6. Is professional and warm in tone.
7. Does not invent details NOT in the allowed context above — for example inventing
   a price, a specific room count, amenities, or neighbourhood details. General
   polite phrases about accessibility, comfort, or flexibility that are not
   contradicted by the context are acceptable.

Email to review:
"""
${message}
"""

Return pass: true only if ALL rules are satisfied. If any rule fails, return
pass: false and a short reason explaining exactly which rule failed.
    `.trim(),
  });

  return object;
}

/**
 * Translates a raw judge failure reason into a short, friendly clarification
 * question for the property manager. Strips all technical language so the
 * manager sees a plain-English prompt rather than an internal error message.
 */
async function humaniseJudgeFeedback(
  reason: string,
  slot: ViewingSlot,
  lead: Lead
): Promise<string> {
  const { object } = await generateObject({
    model: getModel(),
    schema: z.object({ friendlyMessage: z.string() }),
    prompt: `
You are a helpful assistant for a property management app.

A user asked to create a viewing invitation but the AI quality checker
found an issue with the generated message.

Raw issue detected: "${reason}"

Rephrase this as a SHORT, friendly clarification question addressed to
the property manager.

Rules:
- Never mention AI, LLM, judges, prompts, or any technical concepts
- Never mention that a message was "generated" or "drafted"
- Frame it as a simple clarification about the viewing details
- Maximum 1 sentence
- End with a question mark
- Example good output: "Could you double-check the property address? It looks like some details might be unclear."

Context (do not repeat this verbatim, just use it to make the question specific):
- Property: ${slot.propertyAddress}
- Lead: ${lead.name}

Return only friendlyMessage.
    `.trim(),
  });

  return object.friendlyMessage;
}

/**
 * Drafts an invitation message and runs it through the LLM judge.
 * If the first attempt fails, retries once with the judge's feedback.
 * If the retry also fails, surfaces a friendly error to the caller
 * rather than persisting a low-quality message.
 */
export async function draftWithJudge(
  slot: ViewingSlot,
  lead: Lead
): Promise<{ message: string; judgeResult: { pass: boolean; reason: string }; retried: boolean }> {
  const firstDraft = await draftInvitationMessage(slot, lead);
  const firstVerdict = await judgeInvitationMessage(firstDraft, slot, lead);

  if (firstVerdict.pass) {
    console.log(`Judge result for ${lead.name}: PASS`);
    return { message: firstDraft, judgeResult: firstVerdict, retried: false };
  }

  console.log(`Judge result for ${lead.name}: FAIL — ${firstVerdict.reason}, retrying...`);
  await delay(1000);

  const retryDraft = await draftInvitationMessage(slot, lead, firstVerdict.reason);
  const retryVerdict = await judgeInvitationMessage(retryDraft, slot, lead);

  console.log(`Final result after retry: ${retryVerdict.pass ? 'PASS' : 'FAIL'}`);

  if (!retryVerdict.pass) {
    const friendly = await humaniseJudgeFeedback(retryVerdict.reason, slot, lead);
    const err = new Error(friendly) as Error & { code: string };
    err.code = 'JUDGE_FAILED';
    throw err;
  }

  return { message: retryDraft, judgeResult: retryVerdict, retried: true };
}

// ---- CRUD ---------------------------------------------------------------

/**
 * Creates Invitation documents in Firestore for every lead passed in.
 *
 * Each invitation message is drafted and judged before being persisted.
 * Drafts are sequential with a 2-second gap between leads to stay within
 * Gemini's rate limits.
 */
export async function createInvitations(
  slot: ViewingSlot,
  leads: Lead[]
): Promise<Invitation[]> {
  const created: Invitation[] = [];

  for (const lead of leads) {
    if (created.length > 0) await delay(2000);

    const { message, judgeResult, retried } = await draftWithJudge(slot, lead);

    const invitation: Invitation = {
      id: uuidv4(),
      slotId: slot.id,
      lead,
      status: 'pending',
      message,
      createdAt: new Date().toISOString(),
      judgeResult: { ...judgeResult, retried },
    };

    await createDoc<Invitation>(COLLECTIONS.INVITATIONS, invitation);
    await sendInvitationEmail(invitation, slot);
    created.push(invitation);
  }

  return created;
}

/**
 * Attempts to confirm a lead's acceptance of their invitation.
 *
 * Capacity is re-checked at accept time (not just at invite time) because
 * another lead may have accepted the same slot in the interim.
 *
 * - If the slot still has capacity: marks the invitation "accepted" and
 *   increments the slot's attendee count.
 * - If the slot is full: returns success:false and a list of alternative
 *   available slots at the same property so the caller can offer them to
 *   the lead.
 */
export async function acceptInvitation(invitationId: string): Promise<{
  success: boolean;
  invitation?: Invitation;
  alternativeSlots?: ViewingSlot[];
}> {
  const invitation = await getDoc<Invitation>(COLLECTIONS.INVITATIONS, invitationId);
  const slot = await getDoc<ViewingSlot>(COLLECTIONS.SLOTS, invitation.slotId);

  if (slot.currentAttendees >= slot.maxAttendees) {
    const alternativeSlots = await getAvailableSlotsByProperty(slot.propertyAddress);
    await sendSlotFullEmail(invitation.lead, alternativeSlots ?? []);
    return { success: false, alternativeSlots };
  }

  await updateDoc<Invitation>(COLLECTIONS.INVITATIONS, invitationId, { status: 'accepted' });
  await updateDoc<ViewingSlot>(COLLECTIONS.SLOTS, slot.id, {
    currentAttendees: slot.currentAttendees + 1,
  });

  const updatedInvitation: Invitation = { ...invitation, status: 'accepted' };
  return { success: true, invitation: updatedInvitation };
}

/**
 * Returns all invitations associated with a given slot ID.
 * Useful for the slot detail view in the dashboard.
 */
export async function getInvitationsBySlot(slotId: string): Promise<Invitation[]> {
  return queryCollection<Invitation>(COLLECTIONS.INVITATIONS, 'slotId', '==', slotId);
}
