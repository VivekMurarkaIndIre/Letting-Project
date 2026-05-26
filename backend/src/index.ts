import dotenv from 'dotenv';
dotenv.config();

import cors from 'cors';
import express from 'express';
import invitationsRouter from './routes/invitations.routes';
import leadsRouter from './routes/leads.routes';
import slotsRouter from './routes/slots.routes';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use((req, _res, next) => { console.log('>>>', req.method, req.url); next(); });
app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/health', (_req, res) => { res.json({ status: 'ok' }); });
app.use('/api/slots', slotsRouter);
app.use('/api/invitations', invitationsRouter);
app.use('/api/leads', leadsRouter);
app.use((_req, res) => { res.status(404).json({ error: 'Not Found' }); });

app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });
