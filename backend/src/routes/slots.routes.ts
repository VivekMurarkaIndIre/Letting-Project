import { Router, Request, Response } from 'express';
import { Lead, ParsedSlotsResponse, ViewingSlot } from '../models/schemas';
import { createInvitations, getInvitationsBySlot } from '../services/invitations';
import { COLLECTIONS, getDoc } from '../services/firebase';
import { createViewingSlots, parseNaturalLanguageSlots } from '../services/slots';

const router = Router();

/**
 * POST /api/slots/parse
 *
 * Sends the admin's natural-language input to the LLM for parsing.
 * If the model flags the request as ambiguous a clarifying question is
 * returned instead of slot data — the frontend should display it and
 * let the admin refine their input before re-submitting.
 */
router.post('/parse', async (req: Request, res: Response) => {
  try {
    const { input } = req.body as { input: string; leads: Lead[] };

    const todayDate = new Date().toISOString().split('T')[0];
    const response = await parseNaturalLanguageSlots(input, todayDate);

    if (response.ambiguous) {
      return res.status(200).json({ ambiguous: true, clarifyingQuestion: response.clarifyingQuestion });
    }

    return res.status(200).json({ ambiguous: false, parsed: response });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/slots/confirm
 *
 * Called once the admin is happy with the parsed slots. Creates the slot
 * documents in Firestore and fires off AI-drafted invitations for each lead.
 * All created slots and invitations are returned so the frontend can display
 * them immediately without a separate fetch.
 */
router.post('/confirm', async (req: Request, res: Response) => {
  try {
    const { parsed, leads } = req.body as { parsed: ParsedSlotsResponse; leads: Lead[] };

    const slots = await createViewingSlots(parsed);

    // Sequential — not Promise.all — to avoid saturating Gemini's rate limit.
    // Each slot's invitations involve multiple LLM calls (draft + judge per lead),
    // so parallelising across slots causes too many concurrent requests.
    const allInvitations: Awaited<ReturnType<typeof createInvitations>>[] = [];
    for (let i = 0; i < slots.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 2000));
      allInvitations.push(await createInvitations(slots[i], leads));
    }

    return res.status(201).json({ slots, invitations: allInvitations.flat() });
  } catch (error: any) {
    if (error.code === 'JUDGE_FAILED') {
      return res.status(422).json({ code: 'JUDGE_FAILED', friendlyMessage: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/slots/:slotId
 *
 * Fetches a single slot by ID.
 */
router.get('/:slotId', async (req: Request<{ slotId: string }>, res: Response) => {
  try {
    const { slotId } = req.params;
    const slot = await getDoc<ViewingSlot>(COLLECTIONS.SLOTS, slotId);
    return res.status(200).json({ slot });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/slots/:slotId/invitations
 *
 * Returns all invitations associated with a specific slot.
 */
router.get('/:slotId/invitations', async (req: Request<{ slotId: string }>, res: Response) => {
  try {
    const { slotId } = req.params;
    const invitations = await getInvitationsBySlot(slotId);
    return res.status(200).json({ invitations });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
