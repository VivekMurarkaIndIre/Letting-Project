import { Button, Card, Space, Table, Tag, Typography } from 'antd';

const { Text, Title } = Typography;

// ---- local types (mirror backend schemas) --------------------------------

interface Lead {
  id: string;
  name: string;
  email: string;
  notes?: string;
}

interface SlotPreview {
  propertyAddress: string;
  date: string;
  time: string;
  duration: number;
  maxAttendees: number;
}

interface ParsedSlotsResponse {
  slots: SlotPreview[];
  leadNames: string[];
  ambiguous: boolean;
  clarifyingQuestion?: string;
}

// ---- props ---------------------------------------------------------------

interface Props {
  parsed: ParsedSlotsResponse;
  leads: Lead[];
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

// ---- helpers -------------------------------------------------------------

// Append T00:00:00 to force local-time parsing; without it Date() treats
// YYYY-MM-DD as UTC midnight, which shifts the day backwards in UTC+ zones.
function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ---- table columns -------------------------------------------------------

const columns = [
  {
    title: 'Date',
    dataIndex: 'date',
    key: 'date',
    render: (d: string) => formatDate(d),
  },
  {
    title: 'Time',
    dataIndex: 'time',
    key: 'time',
  },
  {
    title: 'Duration',
    dataIndex: 'duration',
    key: 'duration',
    render: (d: number) => `${d} mins`,
  },
  {
    title: 'Max Attendees',
    dataIndex: 'maxAttendees',
    key: 'maxAttendees',
    render: (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`,
  },
];

// ---- component -----------------------------------------------------------

const NAVY = '#1a2744';

export default function ConfirmationCard({ parsed, leads, onConfirm, onCancel, loading }: Props) {
  const firstSlot = parsed.slots[0];
  const tableData = parsed.slots.map((slot, i) => ({ ...slot, key: i }));

  return (
    <Card
      size="small"
      style={{
        border: `1.5px solid ${NAVY}`,
        borderRadius: 12,
        marginTop: 4,
        width: '100%',
      }}
      styles={{ body: { padding: '14px 16px' } }}
    >
      {/* Title */}
      <Title level={5} style={{ margin: '0 0 12px', color: NAVY }}>
        Proposed Viewing Slots
      </Title>

      {/* Summary */}
      <div style={{ marginBottom: 12, lineHeight: 1.8 }}>
        {firstSlot && (
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>Property</Text>
            <br />
            <Text strong>{firstSlot.propertyAddress}</Text>
          </div>
        )}
        {parsed.leadNames.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Inviting</Text>
            <br />
            <Text strong>{parsed.leadNames.join(', ')}</Text>
          </div>
        )}
      </div>

      {/* Slots table */}
      <Table
        dataSource={tableData}
        columns={columns}
        pagination={false}
        size="small"
        style={{ marginBottom: 14 }}
      />

      {/* Invitees tags */}
      <div style={{ marginBottom: 14 }}>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
          Invitees
        </Text>
        <Space wrap>
          {leads.map((lead) => (
            <Tag
              key={lead.id}
              color={NAVY}
              style={{ borderRadius: 20, padding: '2px 10px', fontSize: 12 }}
            >
              {lead.name} · {lead.email}
            </Tag>
          ))}
        </Space>
      </div>

      {/* Action buttons */}
      <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          type="primary"
          loading={loading}
          onClick={onConfirm}
          style={{ background: NAVY, borderColor: NAVY }}
        >
          Confirm &amp; Create
        </Button>
      </Space>

      {/* Footer note */}
      <Text style={{ display: 'block', marginTop: 10, fontSize: 11, color: '#aaa', textAlign: 'center' }}>
        AI will draft personalised invitation messages for each invitee
      </Text>
    </Card>
  );
}
