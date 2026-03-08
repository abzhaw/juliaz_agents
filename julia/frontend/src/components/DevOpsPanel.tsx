import { useEffect, useState, useCallback } from "react";
import { Server, Play, Square, RefreshCw, Cpu, HardDrive, Clock } from "lucide-react";
import { motion } from "framer-motion";
import clsx from "clsx";

interface Process {
    id: number;
    name: string;
    status: "online" | "stopping" | "stopped" | "launching" | "errored" | string;
    memory: number; // bytes
    cpu: number; // percentage
    uptime: number; // timestamp
    restarts: number;
}

export function DevOpsPanel() {
    const [processes, setProcesses] = useState<Process[]>([]);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    const fetchProcesses = useCallback(async () => {
        try {
            const res = await fetch("/api/devops");
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    setProcesses(data.processes);
                }
            }
        } catch {
            // Ignore
        }
    }, []);

    useEffect(() => {
        fetchProcesses();
        const interval = setInterval(fetchProcesses, 3000);
        return () => clearInterval(interval);
    }, [fetchProcesses]);

    const handleAction = async (processName: string, action: "start" | "stop" | "restart") => {
        setLoadingAction(`${action}-${processName}`);
        try {
            const res = await fetch("/api/devops", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, processName })
            });
            if (res.ok) {
                await fetchProcesses();
            }
        } finally {
            setLoadingAction(null);
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const formatUptime = (timestamp: number) => {
        if (!timestamp) return "0s";
        const diff = Math.floor((Date.now() - timestamp) / 1000);
        if (diff < 60) return `${diff}s`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m`;
        return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
    };

    return (
        <div className="glass-panel p-6 flex flex-col h-full border border-white/10 relative overflow-hidden group">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/10 rounded-xl">
                        <Server className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold tracking-tight">DevOps & Control Hub</h2>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">PM2 Process Manager</p>
                    </div>
                </div>
            </div>

            <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                {processes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                        <RefreshCw className="w-6 h-6 animate-spin mb-3 opacity-50" />
                        <p className="text-sm">Fetching PM2 state...</p>
                        <p className="text-xs mt-1">Make sure `pm2` is running.</p>
                    </div>
                ) : (
                    processes.map((proc) => (
                        <motion.div
                            key={proc.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white/5 border border-white/5 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={clsx(
                                        "w-2 h-2 rounded-full",
                                        proc.status === "online" ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-red-500"
                                    )} />
                                    <span className="font-semibold text-sm">{proc.name}</span>
                                    <span className={clsx(
                                        "text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border",
                                        proc.status === "online" ? "border-green-500/30 text-green-400 bg-green-500/10" : "border-red-500/30 text-red-400 bg-red-500/10"
                                    )}>
                                        {proc.status}
                                    </span>
                                </div>

                                {proc.status === "online" && (
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
                                        <div className="flex items-center gap-1.5"><Cpu className="w-3 h-3" /> {proc.cpu}%</div>
                                        <div className="flex items-center gap-1.5"><HardDrive className="w-3 h-3" /> {formatBytes(proc.memory)}</div>
                                        <div className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {formatUptime(proc.uptime)} ({proc.restarts}R)</div>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                {proc.status === "online" ? (
                                    <>
                                        <button
                                            title="Restart"
                                            onClick={() => handleAction(proc.name, "restart")}
                                            disabled={loadingAction !== null}
                                            className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            <RefreshCw className={clsx("w-4 h-4 text-orange-400", loadingAction === `restart-${proc.name}` && "animate-spin")} />
                                        </button>
                                        <button
                                            title="Stop"
                                            onClick={() => handleAction(proc.name, "stop")}
                                            disabled={loadingAction !== null}
                                            className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            <Square className="w-4 h-4 fill-red-400 text-red-400" />
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        title="Start"
                                        onClick={() => handleAction(proc.name, "start")}
                                        disabled={loadingAction !== null}
                                        className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 pr-4 bg-green-500/10 text-green-400 border border-green-500/20"
                                    >
                                        <Play className="w-4 h-4 fill-green-400" />
                                        <span className="text-xs font-semibold tracking-wider">START</span>
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
}
