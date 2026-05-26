import { acceptInvitation } from '../services/invitations';
import { Invitation, ViewingSlot } from '../models/schemas';

// Mock firebase service
jest.mock('../services/firebase', () => ({
  COLLECTIONS: { INVITATIONS: 'invitations', SLOTS: 'slots', LEADS: 'leads' },
  getDoc: jest.fn(),
  updateDoc: jest.fn(),
  createDoc: jest.fn(),
  queryCollection: jest.fn(),
}));

// Mock slots service
jest.mock('../services/slots', () => ({
  getAvailableSlotsByProperty: jest.fn(),
}));

// Mock llm service so no real API calls are made
jest.mock('../services/llm', () => ({
  getModel: jest.fn(),
  generateObject: jest.fn(),
}));

import { getDoc, updateDoc } from '../services/firebase';
import { getAvailableSlotsByProperty } from '../services/slots';

const mockGetDoc = getDoc as jest.MockedFunction<typeof getDoc>;
const mockUpdateDoc = updateDoc as jest.MockedFunction<typeof updateDoc>;
const mockGetAvailableSlots = getAvailableSlotsByProperty as jest.MockedFunction<typeof getAvailableSlotsByProperty>;

const baseSlot: ViewingSlot = {
  id: 'slot-1',
  propertyAddress: '22 Maple Street, London, SW1A 1AA',
  date: '2026-06-01',
  time: '10:00',
  duration: 60,
  maxAttendees: 2,
  currentAttendees: 0,
  createdAt: new Date().toISOString(),
};

const baseInvitation: Invitation = {
  id: 'invite-1',
  slotId: 'slot-1',
  lead: { id: 'lead-1', name: 'Alice', email: 'alice@example.com' },
  status: 'pending',
  message: 'You are invited.',
  createdAt: new Date().toISOString(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateDoc.mockResolvedValue(undefined as any);
});

describe('acceptInvitation — capacity enforcement', () => {
  it('accepts when slot has capacity', async () => {
    mockGetDoc
      .mockResolvedValueOnce(baseInvitation as any)
      .mockResolvedValueOnce({ ...baseSlot, currentAttendees: 1, maxAttendees: 2 } as any);

    const result = await acceptInvitation('invite-1');

    expect(result.success).toBe(true);
    expect(result.invitation?.status).toBe('accepted');
    expect(mockUpdateDoc).toHaveBeenCalledTimes(2);
  });

  it('rejects when slot is exactly full', async () => {
    const fullSlot: ViewingSlot = { ...baseSlot, currentAttendees: 2, maxAttendees: 2 };
    const altSlot: ViewingSlot = { ...baseSlot, id: 'slot-2', date: '2026-06-02', currentAttendees: 0 };

    mockGetDoc
      .mockResolvedValueOnce(baseInvitation as any)
      .mockResolvedValueOnce(fullSlot as any);
    mockGetAvailableSlots.mockResolvedValue([altSlot]);

    const result = await acceptInvitation('invite-1');

    expect(result.success).toBe(false);
    expect(result.alternativeSlots).toHaveLength(1);
    expect(result.alternativeSlots![0].id).toBe('slot-2');
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('increments currentAttendees when accepted', async () => {
    const slotWith1 = { ...baseSlot, currentAttendees: 1, maxAttendees: 3 };

    mockGetDoc
      .mockResolvedValueOnce(baseInvitation as any)
      .mockResolvedValueOnce(slotWith1 as any);

    await acceptInvitation('invite-1');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'slots',
      'slot-1',
      { currentAttendees: 2 }
    );
  });

  it('returns empty alternativeSlots when slot is full and no alternatives exist', async () => {
    const fullSlot: ViewingSlot = { ...baseSlot, currentAttendees: 2, maxAttendees: 2 };

    mockGetDoc
      .mockResolvedValueOnce(baseInvitation as any)
      .mockResolvedValueOnce(fullSlot as any);
    mockGetAvailableSlots.mockResolvedValue([]);

    const result = await acceptInvitation('invite-1');

    expect(result.success).toBe(false);
    expect(result.alternativeSlots).toHaveLength(0);
  });

  it('does not update invitation status when slot is full', async () => {
    const fullSlot: ViewingSlot = { ...baseSlot, currentAttendees: 2, maxAttendees: 2 };

    mockGetDoc
      .mockResolvedValueOnce(baseInvitation as any)
      .mockResolvedValueOnce(fullSlot as any);
    mockGetAvailableSlots.mockResolvedValue([]);

    await acceptInvitation('invite-1');

    const invitationUpdateCalls = (mockUpdateDoc as jest.Mock).mock.calls.filter(
      ([, id]) => id === 'invite-1'
    );
    expect(invitationUpdateCalls).toHaveLength(0);
  });
});
