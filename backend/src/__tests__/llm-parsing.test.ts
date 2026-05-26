import { ParsedSlotsResponseSchema, InvitationSchema, LeadSchema, ViewingSlotSchema } from '../models/schemas';

describe('ParsedSlotsResponseSchema — LLM response validation', () => {

  test('accepts a valid unambiguous response', () => {
    const valid = {
      slots: [
        {
          propertyAddress: '22 Maple Street',
          date: '2026-06-03',
          time: '14:00',
          duration: 30,
          maxAttendees: 2,
        }
      ],
      leadNames: ['John', 'Sarah'],
      ambiguous: false,
    }
    expect(() => ParsedSlotsResponseSchema.parse(valid)).not.toThrow()
  })

  test('accepts a valid ambiguous response with clarifying question', () => {
    const valid = {
      slots: [],
      leadNames: [],
      ambiguous: true,
      clarifyingQuestion: 'What time would you like the viewings?',
    }
    expect(() => ParsedSlotsResponseSchema.parse(valid)).not.toThrow()
  })

  test('rejects response with invalid date format', () => {
    const invalid = {
      slots: [
        {
          propertyAddress: '22 Maple Street',
          date: 'next Tuesday',  // should be YYYY-MM-DD
          time: '14:00',
          duration: 30,
          maxAttendees: 2,
        }
      ],
      leadNames: [],
      ambiguous: false,
    }
    expect(() => ParsedSlotsResponseSchema.parse(invalid)).toThrow()
  })

  test('rejects response with invalid time format', () => {
    const invalid = {
      slots: [
        {
          propertyAddress: '22 Maple Street',
          date: '2026-06-03',
          time: '2pm',  // should be HH:MM
          duration: 30,
          maxAttendees: 2,
        }
      ],
      leadNames: [],
      ambiguous: false,
    }
    expect(() => ParsedSlotsResponseSchema.parse(invalid)).toThrow()
  })

  test('rejects response with negative duration', () => {
    const invalid = {
      slots: [
        {
          propertyAddress: '22 Maple Street',
          date: '2026-06-03',
          time: '14:00',
          duration: -30,
          maxAttendees: 2,
        }
      ],
      leadNames: [],
      ambiguous: false,
    }
    expect(() => ParsedSlotsResponseSchema.parse(invalid)).toThrow()
  })

  test('rejects response missing required fields', () => {
    const invalid = {
      slots: [{ date: '2026-06-03' }],  // missing propertyAddress, time etc
      ambiguous: false,
    }
    expect(() => ParsedSlotsResponseSchema.parse(invalid)).toThrow()
  })

  test('rejects response with zero maxAttendees', () => {
    const invalid = {
      slots: [
        {
          propertyAddress: '22 Maple Street',
          date: '2026-06-03',
          time: '14:00',
          duration: 30,
          maxAttendees: 0,
        }
      ],
      leadNames: [],
      ambiguous: false,
    }
    expect(() => ParsedSlotsResponseSchema.parse(invalid)).toThrow()
  })
})

describe('LeadSchema — validation', () => {

  test('accepts valid lead', () => {
    const valid = { id: '1', name: 'John', email: 'john@example.com' }
    expect(() => LeadSchema.parse(valid)).not.toThrow()
  })

  test('accepts lead with optional notes', () => {
    const valid = { id: '1', name: 'John', email: 'john@example.com', notes: 'First time buyer' }
    expect(() => LeadSchema.parse(valid)).not.toThrow()
  })

  test('rejects lead with invalid email', () => {
    const invalid = { id: '1', name: 'John', email: 'not-an-email' }
    expect(() => LeadSchema.parse(invalid)).toThrow()
  })

  test('rejects lead missing name', () => {
    const invalid = { id: '1', email: 'john@example.com' }
    expect(() => LeadSchema.parse(invalid)).toThrow()
  })
})

describe('ViewingSlotSchema — validation', () => {

  const validSlot = {
    id: 'slot-1',
    propertyAddress: '22 Maple Street',
    date: '2026-06-03',
    time: '14:00',
    duration: 30,
    maxAttendees: 2,
    currentAttendees: 0,
    createdAt: new Date().toISOString(),
  }

  test('accepts valid slot', () => {
    expect(() => ViewingSlotSchema.parse(validSlot)).not.toThrow()
  })

  test('defaults currentAttendees to 0 when not provided', () => {
    const { currentAttendees, ...withoutAttendees } = validSlot
    const result = ViewingSlotSchema.parse(withoutAttendees)
    expect(result.currentAttendees).toBe(0)
  })

  test('rejects slot with invalid date format', () => {
    expect(() => ViewingSlotSchema.parse({
      ...validSlot, date: '03-06-2026'
    })).toThrow()
  })

  test('rejects slot with invalid time format', () => {
    expect(() => ViewingSlotSchema.parse({
      ...validSlot, time: '2:00pm'
    })).toThrow()
  })
})
