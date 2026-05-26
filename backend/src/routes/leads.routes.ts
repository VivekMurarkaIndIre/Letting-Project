import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Lead } from '../models/schemas';
import { COLLECTIONS, createDoc, db } from '../services/firebase';

const router = Router();

/**
 * GET /api/leads
 * Returns all leads in the collection.
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const snap = await db.collection(COLLECTIONS.LEADS).get();
    const leads = snap.docs.map((doc) => doc.data() as Lead);
    return res.status(200).json({ leads });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/leads
 * Creates a new lead document. Validates that name and email are present.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, email, notes } = req.body as { name?: string; email?: string; notes?: string };

    if (!name?.trim() || !email?.trim()) {
      return res.status(400).json({ error: 'name and email are required' });
    }

    const lead: Lead = {
      id: uuidv4(),
      name: name.trim(),
      email: email.trim(),
      notes: notes?.trim() || undefined,
    };

    await createDoc<Lead>(COLLECTIONS.LEADS, lead);
    return res.status(201).json({ lead });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/leads/:leadId
 * Permanently removes a lead document.
 */
router.delete('/:leadId', async (req: Request<{ leadId: string }>, res: Response) => {
  try {
    const { leadId } = req.params;
    await db.collection(COLLECTIONS.LEADS).doc(leadId).delete();
    return res.status(200).json({ deleted: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
