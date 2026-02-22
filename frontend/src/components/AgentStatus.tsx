import { useEffect, useState, useCallback } from "react";
import { Activity, Shield, Cpu, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";

interface BridgeHealth {
    ok: boolean;
    heartbeats: {
        julia: string | null;
        openclaw: string | null;
    };
    counts: {
        pending: number;
        processing: number;
        replied: number;
    };
}

export function AgentStatus() {
    const [health, setHealth] = useState<BridgeHealth | null>(null);
    const [now, setNow] = useState(() => Date.now());

    const fetchHealth = useCallback(async () => {
        try {
            const res = await fetch("http://localhost:3001/health");
            if (res.ok) {
                const data = await res.json();
                setHealth(data);
            }
        } catch {
            // Error logged silently in UI by null health state
        }
    }, []);

    useEffect(() => {
        let mounted = true;
        const load = () => { if (mounted) fetchHealth(); };
        load();
        const fetchInterval = setInterval(load, 3000);
        const timeInterval = setInterval(() => { if (mounted) setNow(Date.now()); }, 1000);
        return () => {
            mounted = false;
            clearInterval(fetchInterval);
            clearInterval(timeInterval);
        };
    }, [fetchHealth]);

    const isJuliaAlive = health?.heartbeats.julia ? (now - new Date(health.heartbeats.julia).getTime() < 30000) : false;
    const isOpenClawAlive = health?.heartbeats.openclaw ? (now - new Date(health.heartbeats.openclaw).getTime() < 30000) : false;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatusCard
                title="Bridge Status"
                status={health?.ok ? "ACTIVE" : "OFFLINE"}
                icon={<Activity className="w-5 h-5 text-blue-400" />}
                isActive={health?.ok ?? false}
            />
            <StatusCard
                title="Julia Mind"
                status={isJuliaAlive ? "THINKING" : "IDLE"}
                icon={<Cpu className="w-5 h-5 text-purple-400" />}
                isActive={isJuliaAlive}
            />
            <StatusCard
                title="OpenClaw"
                status={isOpenClawAlive ? "LISTENING" : "SLEEPING"}
                icon={<Shield className="w-5 h-5 text-green-400" />}
                isActive={isOpenClawAlive}
            />
            <StatusCard
                title="Messages"
                status={`${health?.counts.replied ?? 0} relayed`}
                icon={<MessageSquare className="w-5 h-5 text-orange-400" />}
                isActive={true}
            />
        </div>
    );
}

function StatusCard({ title, status, icon, isActive }: { title: string, status: string, icon: React.ReactNode, isActive: boolean }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel p-4 flex items-center space-x-4"
        >
            <div className="p-3 bg-white/5 rounded-xl">
                {icon}
            </div>
            <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{title}</p>
                <div className="flex items-center space-x-2">
                    {isActive && <span className="status-pulse" />}
                    <p className="font-semibold text-sm">{status}</p>
                </div>
            </div>
        </motion.div>
    );
}
