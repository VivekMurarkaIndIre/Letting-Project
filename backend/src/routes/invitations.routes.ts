import { Router, Request, Response } from 'express';
import { Invitation } from '../models/schemas';
import { acceptInvitation } from '../services/invitations';
import { COLLECTIONS, getDoc, updateDoc } from '../services/firebase';

const router = Router();

/**
 * GET /api/invitations/:invitationId
 *
 * Fetches a single invitation by ID. Used by the lead-facing accept page
 * to render the invitation details before the lead confirms.
 */
router.get('/:invitationId', async (req: Request<{ invitationId: string }>, res: Response) => {
  try {
    const { invitationId } = req.params;
    const invitation = await getDoc<Invitation>(COLLECTIONS.INVITATIONS, invitationId);
    return res.status(200).json({ invitation });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/invitations/:invitationId/accept
 *
 * Attempts to confirm the lead's acceptance. Re-checks slot capacity at
 * accept time to handle the case where another lead filled the slot after
 * the invitation was sent. When the slot is full, alternative available
 * slots at the same property are returned instead.
 */
router.post('/:invitationId/accept', async (req: Request<{ invitationId: string }>, res: Response) => {
  try {
    const { invitationId } = req.params;
    const result = await acceptInvitation(invitationId);

    if (result.success) {
      return res.status(200).json({ success: true, invitation: result.invitation });
    }

    return res.status(200).json({ success: false, alternativeSlots: result.alternativeSlots });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/invitations/:invitationId/message
 *
 * Lets the admin edit the AI-drafted invitation message before it is sent.
 * Only the message field is updated; all other invitation fields are preserved.
 */
router.patch('/:invitationId/message', async (req: Request<{ invitationId: string }>, res: Response) => {
  try {
    const { invitationId } = req.params;
    const { message } = req.body as { message: string };

    await updateDoc<Invitation>(COLLECTIONS.INVITATIONS, invitationId, { message });
    return res.status(200).json({ updated: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
