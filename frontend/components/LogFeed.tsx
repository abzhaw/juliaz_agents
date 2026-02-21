"use client";

import { useEffect, useState } from "react";
import { Terminal, Database } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface LogEntry {
    id: number;
    level: string;
    source: string;
    message: string;
    timestamp: string;
}

export function LogFeed() {
    const [logs, setLogs] = useState<LogEntry[]>([]);

    const fetchLogs = async () => {
        try {
            const res = await fetch("http://localhost:3000/logs");
            if (res.ok) setLogs(await res.json());
        } catch (e) { }
    };

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 4000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="glass-panel p-4 flex flex-col h-full bg-black/40">
            <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2">
                <h3 className="font-mono text-xs flex items-center gap-2 text-white/60">
                    <Terminal className="w-4 h-4" />
                    SYSTEM_LOG
                </h3>
                <Database className="w-3 h-3 text-white/20" />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 font-mono scrollbar-hide">
                <AnimatePresence initial={false}>
                    {logs.map((log) => (
                        <motion.div
                            key={log.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-[11px] flex gap-3"
                        >
                            <span className="text-white/20 shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                            <span className={`shrink-0 ${levelColor(log.level)}`}>{log.level.toUpperCase()}</span>
                            <span className="text-blue-400 shrink-0">{log.source}:</span>
                            <span className="text-white/70 break-all">{log.message}</span>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}

function levelColor(level: string) {
    switch (level.toLowerCase()) {
        case 'error': return 'text-red-500';
        case 'warn': return 'text-yellow-500';
        default: return 'text-green-500';
    }
}
