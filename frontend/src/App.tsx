import { useState } from 'react';
import { Button } from 'antd';
import { Route, Routes } from 'react-router-dom';
import AdminChat from './pages/AdminChat';
import InviteePage from './pages/InviteePage';

type Page = 'admin' | 'invitee';

const NAVY = '#1a2744';

function AdminLayout() {
  const [page, setPage] = useState<Page>('admin');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Tab bar */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #e8e8e8',
        display: 'flex',
        justifyContent: 'center',
        gap: 8,
        padding: '8px 16px',
        flexShrink: 0,
        zIndex: 10,
      }}>
        {(['admin', 'invitee'] as Page[]).map((p) => (
          <Button
            key={p}
            type={page === p ? 'primary' : 'default'}
            onClick={() => setPage(p)}
            style={page === p ? { background: NAVY, borderColor: NAVY } : {}}
            size="small"
          >
            {p === 'admin' ? 'Admin View' : 'Invitee View'}
          </Button>
        ))}
      </div>

      {/* Pages — both mounted, inactive one hidden via CSS to preserve state */}
      <div style={{ flex: 1, overflow: 'hidden', display: page === 'admin' ? 'flex' : 'none', flexDirection: 'column' }}>
        <AdminChat />
      </div>
      <div style={{ flex: 1, overflow: 'hidden', display: page === 'invitee' ? 'flex' : 'none', flexDirection: 'column' }}>
        <InviteePage />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/invite/:invitationId" element={<InviteePage />} />
      <Route path="*" element={<AdminLayout />} />
    </Routes>
  );
}
