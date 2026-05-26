import axios from 'axios';
import { Alert, Button, Card, Form, Input, List, Spin, Typography } from 'antd';
import { useEffect, useState } from 'react';
import API_URL from '../config';

const { Text } = Typography;

// ---- types ---------------------------------------------------------------

export interface Lead {
  id: string;
  name: string;
  email: string;
  notes?: string;
}

const API = `${API_URL}/api/leads`;

// ---- component -----------------------------------------------------------

export default function LeadsPanel() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form] = Form.useForm<{ name: string; email: string; notes?: string }>();

  async function fetchLeads() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get<{ leads: Lead[] }>(API);
      setLeads(data.leads);
    } catch {
      setError('Failed to load leads.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchLeads(); }, []);

  async function handleAdd(values: { name: string; email: string; notes?: string }) {
    try {
      await axios.post(API, {
        name: values.name.trim(),
        email: values.email.trim(),
        notes: values.notes?.trim() || undefined,
      });
      form.resetFields();
      setAdding(false);
      await fetchLeads();
    } catch {
      setError('Failed to add lead.');
    }
  }

  async function handleDelete(id: string) {
    try {
      await axios.delete(`${API}/${id}`);
      await fetchLeads();
    } catch {
      setError('Failed to delete lead.');
    }
  }

  return (
    <Card
      title="Leads"
      size="small"
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      styles={{ body: { padding: 0, flex: 1, display: 'flex', flexDirection: 'column' } }}
    >
      {error && (
        <Alert
          type="error"
          message={error}
          closable
          onClose={() => setError(null)}
          style={{ margin: '8px 12px 0' }}
        />
      )}

      {/* Lead list */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
          <Spin size="small" />
        </div>
      ) : (
        <List
          dataSource={leads}
          locale={{ emptyText: 'No leads yet' }}
          style={{ flex: 1, overflowY: 'auto' }}
          renderItem={(lead) => (
            <List.Item
              style={{ padding: '8px 12px' }}
              actions={[
                <Button
                  key="delete"
                  type="text"
                  danger
                  size="small"
                  onClick={() => handleDelete(lead.id)}
                  style={{ padding: '0 4px', lineHeight: 1 }}
                >
                  ✕
                </Button>,
              ]}
            >
              <div style={{ minWidth: 0 }}>
                <Text strong style={{ display: 'block', fontSize: 13 }}>
                  {lead.name}
                </Text>
                <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                  {lead.email}
                </Text>
                {lead.notes && (
                  <Text type="secondary" style={{ display: 'block', fontSize: 11, fontStyle: 'italic' }}>
                    {lead.notes}
                  </Text>
                )}
              </div>
            </List.Item>
          )}
        />
      )}

      {/* Add lead form */}
      <div style={{ borderTop: '1px solid #f0f0f0', padding: '10px 12px' }}>
        {!adding ? (
          <Button type="dashed" block size="small" onClick={() => setAdding(true)}>
            + Add Lead
          </Button>
        ) : (
          <Form form={form} onFinish={handleAdd} layout="vertical" size="small" style={{ margin: 0 }}>
            <Form.Item
              name="name"
              rules={[{ required: true, message: 'Name is required' }]}
              style={{ marginBottom: 6 }}
            >
              <Input placeholder="Name" autoFocus />
            </Form.Item>
            <Form.Item
              name="email"
              rules={[
                { required: true, message: 'Email is required' },
                { type: 'email', message: 'Enter a valid email' },
              ]}
              style={{ marginBottom: 6 }}
            >
              <Input placeholder="Email" />
            </Form.Item>
            <Form.Item name="notes" style={{ marginBottom: 8 }}>
              <Input placeholder="e.g. First time buyer" />
            </Form.Item>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button type="primary" htmlType="submit" size="small" style={{ flex: 1 }}>
                Add Lead
              </Button>
              <Button size="small" onClick={() => { setAdding(false); form.resetFields(); }}>
                Cancel
              </Button>
            </div>
          </Form>
        )}
      </div>
    </Card>
  );
}
