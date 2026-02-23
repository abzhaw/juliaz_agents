---
name: dashboard-design
description: Command center UIs, real-time data display, status panels for agent systems. Use when designing or improving Julia's Next.js dashboard.
---

# Dashboard Design

## Layout Pattern (Agent Command Center)
```tsx
// Sidebar + Main + Details panel
<div className="flex h-screen bg-zinc-950">
  {/* Sidebar — navigation + agent status */}
  <aside className="w-64 border-r border-zinc-800 flex flex-col">
    <AgentStatusList />
    <NavMenu />
  </aside>

  {/* Main panel — primary content */}
  <main className="flex-1 overflow-auto p-6">
    <MessageFeed />
  </main>

  {/* Detail panel — context/logs */}
  <aside className="w-80 border-l border-zinc-800">
    <SystemLogs />
  </aside>
</div>
```

## Status Indicator Component
```tsx
type Status = 'online' | 'offline' | 'error' | 'pending';
const statusConfig: Record<Status, { color: string; label: string }> = {
  online:  { color: 'bg-emerald-500', label: 'Online' },
  offline: { color: 'bg-zinc-500',    label: 'Offline' },
  error:   { color: 'bg-red-500',     label: 'Error' },
  pending: { color: 'bg-amber-500',   label: 'Starting...' },
};

function StatusDot({ status }: { status: Status }) {
  const { color, label } = statusConfig[status];
  return (
    <span className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${color} ${status === 'online' ? 'animate-pulse' : ''}`} />
      <span className="text-sm text-zinc-400">{label}</span>
    </span>
  );
}
```

## Real-Time Data Polling
```tsx
function usePollData<T>(url: string, intervalMs = 3000) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    const fetch_data = () => fetch(url).then(r => r.json()).then(setData).catch(console.error);
    fetch_data();
    const id = setInterval(fetch_data, intervalMs);
    return () => clearInterval(id);
  }, [url, intervalMs]);
  return data;
}
```

## Julia Dashboard Services' Health Display
| Service | Health URL | Poll interval |
|---------|-----------|---------------|
| Bridge | `/health` on :3001 | 5s |
| Backend | `/health` on :3000 | 5s |
| cowork-mcp | `/health` on :3003 | 10s |
