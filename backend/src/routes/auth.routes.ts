import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import { db } from '../services/firebase';
import { getAuthenticatedClient, getAuthUrl, getTokensFromCode } from '../services/googleAuth';

const router = Router();

router.get('/google', (_req: Request, res: Response) => {
  res.redirect(getAuthUrl());
});

router.get('/google/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;

  if (!code) {
    return res.status(400).json({ error: 'Missing OAuth code' });
  }

  try {
    const tokens = await getTokensFromCode(code);
    const client = getAuthenticatedClient(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data } = await oauth2.userinfo.get();
    const userEmail = data.email;

    await db.collection('admin').doc('tokens').set({
      ...tokens,
      email: userEmail,
      connectedAt: new Date().toISOString(),
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}?google=connected`);
  } catch (err: any) {
    console.error('[auth] OAuth callback error:', err.message);
    return res.status(500).json({ error: 'OAuth exchange failed' });
  }
});

router.get('/status', async (_req: Request, res: Response) => {
  try {
    const doc = await db.collection('admin').doc('tokens').get();
    if (!doc.exists) {
      return res.status(200).json({ connected: false });
    }
    const data = doc.data();
    return res.status(200).json({ connected: true, email: data?.email });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
