---
name: data-visualization
description: Charts, live graphs, agent activity timelines in Julia's dashboard. Use when adding visual data displays to the Next.js frontend.
---

# Data Visualization

## Recharts (React, lightweight)
```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { time: '06:00', messages: 2 },
  { time: '07:00', messages: 8 },
  { time: '08:00', messages: 15 },
];

<ResponsiveContainer width="100%" height={200}>
  <LineChart data={data}>
    <XAxis dataKey="time" stroke="#71717a" tick={{ fontSize: 12 }} />
    <YAxis stroke="#71717a" tick={{ fontSize: 12 }} />
    <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46' }} />
    <Line type="monotone" dataKey="messages" stroke="#22c55e" strokeWidth={2} dot={false} />
  </LineChart>
</ResponsiveContainer>
```

## Activity Timeline
```tsx
function ActivityTimeline({ events }: { events: { ts: number; label: string; type: 'info'|'warn'|'error' }[] }) {
  const colors = { info: 'bg-blue-500', warn: 'bg-amber-500', error: 'bg-red-500' };
  return (
    <div className="space-y-2">
      {events.map((e, i) => (
        <div key={i} className="flex items-start gap-3">
          <span className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${colors[e.type]}`} />
          <div>
            <p className="text-sm text-zinc-200">{e.label}</p>
            <p className="text-xs text-zinc-500">{new Date(e.ts).toLocaleTimeString()}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

## Real-Time Chart (polling)
```tsx
const [data, setData] = useState<DataPoint[]>([]);
useEffect(() => {
  const id = setInterval(async () => {
    const point = await fetch('/api/metrics').then(r => r.json());
    setData(prev => [...prev.slice(-30), point]);  // keep last 30 points
  }, 5000);
  return () => clearInterval(id);
}, []);
```
