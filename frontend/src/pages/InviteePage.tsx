import axios from 'axios';
import { Alert, Button, Card, Divider, Input, Tag, Typography } from 'antd';
import { useState } from 'react';

const { Title, Text, Paragraph } = Typography;

// ---- local types ---------------------------------------------------------

interface Lead {
  id: string;
  name: string;
  email: string;
  notes?: string;
}

interface Slot {
  id: string;
  propertyAddress: string;
  date: string;
  time: string;
  duration: number;
  maxAttendees: number;
  currentAttendees: number;
  createdAt: string;
}

interface Invitation {
  id: string;
  slotId: string;
  lead: Lead;
  status: 'pending' | 'accepted' | 'declined';
  message: string;
  createdAt: string;
}

// ---- helpers -------------------------------------------------------------

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const NAVY = '#1a2744';

// ---- component -----------------------------------------------------------

export default function InviteePage() {
  const [inputId, setInputId] = useState('');
  const [invitationId, setInvitationId] = useState('');
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [alternativeSlots, setAlternativeSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLoad() {
    const id = inputId.trim();
    if (!id) return;

    setLoading(true);
    setError(null);
    setInvitation(null);
    setSlot(null);
    setAlternativeSlots([]);
    setInvitationId(id);

    try {
      const { data: invData } = await axios.get<{ invitation: Invitation }>(
        `http://localhost:3001/api/invitations/${id}`
      );
      const inv = invData.invitation;
      setInvitation(inv);

      // NOTE: GET /api/slots/:slotId does not exist yet — needs to be added
      // to slots.routes.ts before this call will succeed.
      const { data: slotData } = await axios.get<{ slot: Slot }>(
        `http://localhost:3001/api/slots/${inv.slotId}`
      );
      setSlot(slotData.slot);
    } catch (err: any) {
      setError(err.response?.data?.error ?? err.message ?? 'Failed to load invitation.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept() {
    if (!invitation) return;
    setAccepting(true);
    setError(null);
    setAlternativeSlots([]);

    try {
      const { data } = await axios.post<
        { success: true; invitation: Invitation } |
        { success: false; alternativeSlots: Slot[] }
      >(`http://localhost:3001/api/invitations/${invitationId}/accept`);

      if (data.success) {
        setInvitation(data.invitation);
      } else {
        setAlternativeSlots(data.alternativeSlots);
      }
    } catch (err: any) {
      setError(err.response?.data?.error ?? err.message ?? 'Failed to accept invitation.');
    } finally {
      setAccepting(false);
    }
  }

  const spotsRemaining = slot ? slot.maxAttendees - slot.currentAttendees : 0;
  const isFull = slot ? spotsRemaining <= 0 : false;
  const isAccepted = invitation?.status === 'accepted';

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      {/* Testing bar */}
      <div style={{ background: '#f5f5f5', borderBottom: '1px solid #e0e0e0', padding: '10px 16px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Text style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>
            Testing mode — paste an invitation ID:
          </Text>
          <Input
            value={inputId}
            onChange={(e) => setInputId(e.target.value)}
            onPressEnter={handleLoad}
            placeholder="e.g. a1b2c3d4-..."
            size="small"
            style={{ flex: 1 }}
          />
          <Button size="small" onClick={handleLoad} loading={loading} disabled={!inputId.trim()}>
            Load Invitation
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ padding: '32px 16px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>

          {/* Error state */}
          {error && (
            <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} closable onClose={() => setError(null)} />
          )}

          {/* Empty / initial state */}
          {!invitation && !loading && !error && (
            <Card style={{ textAlign: 'center', color: '#aaa' }}>
              <Text type="secondary">Enter an invitation ID above to view your invitation.</Text>
            </Card>
          )}

          {/* Main invitation card */}
          {invitation && slot && (
            <Card
              title={
                <Title level={4} style={{ color: NAVY, margin: 0 }}>
                  {slot.propertyAddress}
                </Title>
              }
              style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}
            >
              {/* Personalised message */}
              <blockquote style={{
                borderLeft: `4px solid ${NAVY}`,
                margin: '0 0 20px',
                padding: '8px 16px',
                background: '#f8f9fb',
                borderRadius: '0 8px 8px 0',
                fontStyle: 'italic',
                color: '#444',
                lineHeight: 1.7,
              }}>
                <Paragraph style={{ margin: 0 }}>{invitation.message}</Paragraph>
              </blockquote>

              <Divider />

              {/* Viewing details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Date</Text>
                  <Text strong>{formatDate(slot.date)}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Time</Text>
                  <Text strong>{slot.time}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Duration</Text>
                  <Text strong>{slot.duration} minutes</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary">Availability</Text>
                  <Tag color={isFull ? 'red' : 'green'}>
                    {isFull ? 'Slot full' : `${spotsRemaining} of ${slot.maxAttendees} spot${slot.maxAttendees !== 1 ? 's' : ''} remaining`}
                  </Tag>
                </div>
              </div>

              {/* Accepted confirmation */}
              {isAccepted && (
                <Alert
                  type="success"
                  message="You're confirmed! See you there."
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              )}

              {/* Accept button */}
              <Button
                type="primary"
                block
                size="large"
                onClick={handleAccept}
                loading={accepting}
                disabled={isAccepted || isFull}
                style={{ background: NAVY, borderColor: NAVY, borderRadius: 8, height: 48 }}
              >
                {isAccepted ? 'Already Accepted' : 'Accept Invitation'}
              </Button>
            </Card>
          )}

          {/* Alternative slots — shown when the accepted slot was full */}
          {alternativeSlots.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <Text strong style={{ display: 'block', marginBottom: 12, color: '#d4380d' }}>
                This slot is full — here are other available times:
              </Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {alternativeSlots.map((s) => {
                  const remaining = s.maxAttendees - s.currentAttendees;
                  return (
                    <Card key={s.id} size="small" style={{ borderRadius: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <Text strong>{formatDate(s.date)}</Text>
                          <Text type="secondary" style={{ marginLeft: 12 }}>{s.time}</Text>
                        </div>
                        <Tag color="green">
                          {remaining} spot{remaining !== 1 ? 's' : ''} left
                        </Tag>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
