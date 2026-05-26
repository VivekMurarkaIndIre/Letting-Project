// Single source of truth for all data shapes in the app.
// Zod schemas are used for runtime validation; inferred TypeScript types are
// used throughout the codebase so the two never drift apart.
import { z } from 'zod';

export const LeadSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  notes: z.string().optional(),
});

export const ViewingSlotSchema = z.object({
  id: z.string(),
  propertyAddress: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Expected HH:MM'),
  duration: z.number().int().positive(),
  maxAttendees: z.number().int().positive(),
  currentAttendees: z.number().int().min(0).default(0),
  createdAt: z.string().datetime(),
});

export const InvitationSchema = z.object({
  id: z.string(),
  slotId: z.string(),
  lead: LeadSchema,
  status: z.enum(['pending', 'accepted', 'declined']),
  message: z.string(),
  createdAt: z.string().datetime(),
  judgeResult: z.object({
    pass: z.boolean(),
    reason: z.string(),
    retried: z.boolean(),
  }).optional(),
});

// Shape the LLM must return when interpreting a natural-language scheduling request.
export const ParsedSlotsResponseSchema = z.object({
  slots: z.array(
    z.object({
      propertyAddress: z.string(),
      date: z.string().describe('YYYY-MM-DD'),
      time: z.string().describe('HH:MM'),
      duration: z.number().int().positive().describe('Duration in minutes'),
      maxAttendees: z.number().int().positive(),
    })
  ),
  leadNames: z.array(z.string()).describe('Names of people mentioned by the admin'),
  ambiguous: z.boolean(),
  clarifyingQuestion: z
    .string()
    .optional()
    .describe('Only present when ambiguous is true'),
});

export type Lead = z.infer<typeof LeadSchema>;
export type ViewingSlot = z.infer<typeof ViewingSlotSchema>;
export type Invitation = z.infer<typeof InvitationSchema>;
export type ParsedSlotsResponse = z.infer<typeof ParsedSlotsResponseSchema>;
