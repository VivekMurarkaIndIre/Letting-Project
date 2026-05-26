import axios from 'axios';
import { Button, Input, Spin, Typography } from 'antd';
import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import ConfirmationCard from '../components/ConfirmationCard';
import LeadsPanel, { Lead } from '../components/LeadsPanel';
import API_URL from '../config';

const { TextArea } = Input;
const { Text } = Typography;

// ---- local types (mirror backend schemas) --------------------------------

interface ParsedSlotsResponse {
  slots: Array<{
    propertyAddress: string;
    date: string;
    time: string;
    duration: number;
    maxAttendees: number;
  }>;
  leadNames: string[];
  ambiguous: boolean;
  clarifyingQuestion?: string;
}

interface Message {
  role: 'admin' | 'assistant';
  content: string;
  isLoading?: boolean;
  showConfirmation?: boolean;
}

// ---- constants -----------------------------------------------------------

const NAVY = '#1a2744';
const LOADING_MSG: Message = { role: 'assistant', content: 'Thinking...', isLoading: true };

// ---- styles (kept inline to stay self-contained) -------------------------

const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100vh',
    background: '#f0f2f5',
  },
  header: {
    background: NAVY,
    padding: '14px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
  },
  chatArea: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '20px 16px',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  chatInner: {
    maxWidth: 800,
    width: '100%',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  },
  inputArea: {
    background: 'white',
    borderTop: '1px solid #e8e8e8',
    padding: '12px 16px',
    flexShrink: 0,
  },
  inputInner: {
    maxWidth: 800,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  inputRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'flex-end',
  },
};

function bubbleStyle(role: 'admin' | 'assistant'): React.CSSProperties {
  const isAdmin = role === 'admin';
  return {
    maxWidth: '70%',
    padding: '10px 14px',
    borderRadius: isAdmin ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
    background: isAdmin ? NAVY : 'white',
    color: isAdmin ? 'white' : '#1a1a1a',
    alignSelf: isAdmin ? 'flex-end' : 'flex-start',
    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
    fontSize: 14,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  };
}

// ---- component -----------------------------------------------------------

export default function AdminChat() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hi! Tell me which viewing slots you'd like to set up. For example: \"Set up 3 viewings for 22 Maple Street next Tuesday, invite John and Sarah\"." },
  ]);
  const [parsedSlots, setParsedSlots] = useState<ParsedSlotsResponse | null>(null);
  const [matchedLeads, setMatchedLeads] = useState<Lead[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const todayLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  async function fetchAuthStatus() {
    try {
      const { data } = await axios.get<{ connected: boolean; email?: string }>(
        `${API_URL}/auth/status`
      );
      setGoogleConnected(data.connected);
      setAdminEmail(data.email ?? null);
    } catch {
      // silently ignore — banner will show as disconnected
    }
  }

  // Check Google connection on mount; clean up the ?google=connected redirect param.
  useEffect(() => {
    if (window.location.search.includes('google=connected')) {
      window.history.replaceState({}, '', '/');
    }
    fetchAuthStatus();
  }, []);

  // Scroll to the newest message whenever messages change.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    // Add admin message and show loading bubble.
    setMessages((prev) => [...prev, { role: 'admin', content: trimmed }, LOADING_MSG]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await axios.post<
        { ambiguous: true; clarifyingQuestion: string } |
        { ambiguous: false; parsed: ParsedSlotsResponse }
      >(`${API_URL}/api/slots/parse`, { input: trimmed });

      if (!data.ambiguous) {
        try {
          const { data: leadsData } = await axios.get<{ leads: Lead[] }>(
            `${API_URL}/api/leads`
          );
          const allLeads = leadsData.leads;
          const matched = allLeads.filter((lead: Lead) =>
            data.parsed.leadNames.some(
              (name: string) =>
                lead.name.toLowerCase().includes(name.toLowerCase()) ||
                name.toLowerCase().includes(lead.name.toLowerCase().split(' ')[0])
            )
          );
          setMatchedLeads(matched.length > 0 ? matched : allLeads);
        } catch {
          setMatchedLeads([]);
        }
        setParsedSlots(data.parsed);
      }

      // Remove loading bubble, then add the real assistant reply.
      setMessages((prev) => {
        const withoutLoading = prev.filter((m) => !m.isLoading);

        if (data.ambiguous) {
          return [
            ...withoutLoading,
            { role: 'assistant', content: data.clarifyingQuestion },
          ];
        }

        return [
          ...withoutLoading,
          {
            role: 'assistant',
            content: 'Got it! Here\'s what I understood:',
            showConfirmation: true,
          },
        ];
      });
    } catch {
      setMessages((prev) => [
        ...prev.filter((m) => !m.isLoading),
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!parsedSlots) return;
    setConfirmLoading(true);
    try {
      const leadsToInvite = matchedLeads.length > 0 ? matchedLeads : [];

      await axios.post(`${API_URL}/api/slots/confirm`, {
        parsed: parsedSlots,
        leads: leadsToInvite,
      });

      const nameList = leadsToInvite.map((l) => l.name).join(' and ');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Done! I've created the slots and drafted personalised invitations for ${nameList}. They're ready for your review.`,
        },
      ]);
    } catch (err: any) {
      const status = err.response?.status;
      const code = err.response?.data?.code;
      const message = err.response?.data?.friendlyMessage;

      if (code === 'JUDGE_FAILED' && message) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Sorry, I wasn't able to create the invitations. ${message}`,
          },
        ]);
      } else if (!status || status >= 500) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Something went wrong on our end. Please try again in a moment.',
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Something went wrong. Please check your input and try again.',
          },
        ]);
      }
    } finally {
      setConfirmLoading(false);
      setParsedSlots(null);
      // Hide the confirmation card on the message that triggered it.
      setMessages((prev) =>
        prev.map((m) => (m.showConfirmation ? { ...m, showConfirmation: false } : m))
      );
    }
  }

  function handleCancel() {
    setParsedSlots(null);
    setMessages((prev) => [
      ...prev.map((m) => (m.showConfirmation ? { ...m, showConfirmation: false } : m)),
      { role: 'assistant', content: "No problem, let me know if you'd like to make changes." },
    ]);
  }

  // Send on Enter; allow Shift+Enter for newlines.
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div style={styles.root}>
      {/* Header — full width */}
      <div style={styles.header}>
        <Text style={{ color: 'white', fontSize: 18, fontWeight: 700, letterSpacing: 0.5 }}>
          Lette Admin
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>{todayLabel}</Text>
      </div>

      {/* Google connection banner */}
      {googleConnected ? (
        <div style={{ background: '#f6ffed', borderBottom: '1px solid #b7eb8f', padding: '8px 24px' }}>
          <Text style={{ fontSize: 13, color: '#52c41a' }}>
            ✓ Google connected · Sending emails as {adminEmail}
          </Text>
        </div>
      ) : (
        <div style={{ background: '#fffbe6', borderBottom: '1px solid #ffe58f', padding: '8px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 13 }}>
            ⚠️ Connect Google to enable email sending and calendar sync
          </Text>
          <Button
            size="small"
            onClick={() => { window.location.href = `${API_URL}/auth/google`; }}
          >
            Connect Google
          </Button>
        </div>
      )}

      {/* Body — two columns */}
      <div style={{ display: 'flex', flexDirection: 'row', flex: 1, overflow: 'hidden' }}>

        {/* Left: chat column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Chat area */}
          <div style={styles.chatArea}>
            <div style={styles.chatInner}>
              {messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'admin' ? 'flex-end' : 'flex-start' }}>
                  <div style={bubbleStyle(msg.role)}>
                    {msg.isLoading ? (
                      <Spin size="small" style={{ marginRight: 8 }} />
                    ) : null}
                    {msg.content}
                  </div>

                  {/* ConfirmationCard — shown below the assistant bubble until confirmed or cancelled */}
                  {msg.showConfirmation && parsedSlots && (
                    <div style={{ alignSelf: 'flex-start', marginTop: 8, width: '100%', maxWidth: '70%' }}>
                      <ConfirmationCard
                        parsed={parsedSlots}
                        leads={matchedLeads}
                        onConfirm={handleConfirm}
                        onCancel={handleCancel}
                        loading={confirmLoading}
                      />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input area */}
          <div style={styles.inputArea}>
            <div style={styles.inputInner}>
              <div style={styles.inputRow}>
                <TextArea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder='e.g. "Set up 3 viewings for 22 Maple Street next Tuesday"'
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  disabled={loading}
                  style={{ flex: 1, borderRadius: 20, resize: 'none', paddingTop: 8, paddingBottom: 8 }}
                />
                <Button
                  type="primary"
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  style={{ background: NAVY, borderColor: NAVY, borderRadius: 20, height: 38, paddingInline: 20 }}
                >
                  Send
                </Button>
              </div>
              <Text style={{ fontSize: 12, color: '#aaa', textAlign: 'center' }}>
                Describe the viewing slots you want to create · Shift+Enter for new line
              </Text>
            </div>
          </div>
        </div>

        {/* Right: leads panel */}
        <div style={{ width: 300, borderLeft: '1px solid #e8e8e8', overflow: 'auto', padding: 12, background: 'white' }}>
          <LeadsPanel />
        </div>

      </div>
    </div>
  );
}
