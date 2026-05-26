import axios from 'axios';
import { Alert, Button, Card, Spin, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import API_URL from '../config';

const { Title, Text } = Typography;

const NAVY = '#1a2744';

// ---- local types ---------------------------------------------------------

interface Lead {
  id: string;
  name: string;
  email: string;
}

interface Slot {
  id: string;
  propertyAddress: string;
  date: string;
  time: string;
  duration: number;
  maxAttendees: number;
  currentAttendees: number;
}

interface Invitation {
  id: string;
  lead: Lead;
  status: 'pending' | 'accepted' | 'declined';
}

interface DashboardEntry {
  slot: Slot;
  invitations: Invitation[];
}

// ---- helpers -------------------------------------------------------------

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const STATUS_TAG: Record<Invitation['status'], { color: string; label: string }> = {
  accepted: { color: 'green', label: 'Accepted' },
  pending:  { color: 'orange', label: 'Pending' },
  declined: { color: 'red', label: 'Declined' },
};

// ---- component -----------------------------------------------------------

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchDashboard() {
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await axios.get<{ dashboard: DashboardEntry[] }>(
        `${API_URL}/api/slots/admin/dashboard`
      );
      const sorted = [...res.dashboard].sort((a, b) =>
        a.slot.date.localeCompare(b.slot.date)
      );
      setData(sorted);
    } catch (err: any) {
      setError(err.response?.data?.error ?? err.message ?? 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchDashboard(); }, []);

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#f0f2f5', padding: '24px 16px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ color: NAVY, margin: 0 }}>Viewing Dashboard</Title>
          <Button onClick={fetchDashboard} loading={loading} size="small">
            Refresh
          </Button>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin size="large" />
          </div>
        )}

        {/* Error */}
        {error && (
          <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} closable onClose={() => setError(null)} />
        )}

        {/* Empty state */}
        {!loading && !error && data.length === 0 && (
          <Card style={{ textAlign: 'center' }}>
            <Text type="secondary">No viewing slots yet. Create one from the Admin View.</Text>
          </Card>
        )}

        {/* Slot cards */}
        {!loading && data.map(({ slot, invitations }) => {
          const filled = slot.currentAttendees;
          const total = slot.maxAttendees;
          const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
          const isFull = filled >= total;

          return (
            <Card
              key={slot.id}
              style={{ marginBottom: 16, borderRadius: 10 }}
              title={
                <div>
                  <Text strong style={{ fontSize: 16, color: NAVY }}>{slot.propertyAddress}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
                    {formatDate(slot.date)} · {slot.time} · {slot.duration} min
                  </Text>
                </div>
              }
              extra={
                <Tag color={isFull ? 'red' : 'blue'}>
                  {filled} / {total} spots filled
                </Tag>
              }
            >
              {/* Capacity bar */}
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  height: 6,
                  borderRadius: 3,
                  background: '#f0f0f0',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: isFull ? '#ff4d4f' : NAVY,
                    borderRadius: 3,
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>

              {/* Invitations */}
              {invitations.length === 0 ? (
                <Text type="secondary" style={{ fontSize: 13 }}>No invitations sent yet.</Text>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {invitations.map((inv) => {
                    const tag = STATUS_TAG[inv.status];
                    return (
                      <div
                        key={inv.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 12px',
                          background: '#fafafa',
                          borderRadius: 6,
                          border: '1px solid #f0f0f0',
                        }}
                      >
                        <div>
                          <Text strong style={{ fontSize: 14 }}>{inv.lead.name}</Text>
                          <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>{inv.lead.email}</Text>
                        </div>
                        <Tag color={tag.color}>{tag.label}</Tag>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}

      </div>
    </div>
  );
}
