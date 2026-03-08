import React, { useEffect, useState } from "react";
import { Coins, Database, Activity } from "lucide-react";

interface UsageRecord {
    id: number;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    timestamp: string;
}

interface ModelSummary {
    model: string;
    totalPrompt: number;
    totalCompletion: number;
    totalAll: number;
    lastUsed: string;
}

export function TokenMonitor() {
    const [summaries, setSummaries] = useState<ModelSummary[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchUsage = async () => {
        try {
            const res = await fetch("http://localhost:3000/usage");
            if (!res.ok) throw new Error("Failed to fetch usage");
            const data: UsageRecord[] = await res.json();

            // Aggregate by model
            const map = new Map<string, ModelSummary>();
            data.forEach((record) => {
                const existing = map.get(record.model) || {
                    model: record.model,
                    totalPrompt: 0,
                    totalCompletion: 0,
                    totalAll: 0,
                    lastUsed: record.timestamp,
                };

                existing.totalPrompt += record.promptTokens;
                existing.totalCompletion += record.completionTokens;
                existing.totalAll += record.totalTokens;
                if (new Date(record.timestamp) > new Date(existing.lastUsed)) {
                    existing.lastUsed = record.timestamp;
                }

                map.set(record.model, existing);
            });

            setSummaries(Array.from(map.values()));
        } catch (err) {
            console.error("TokenMonitor error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsage();
        const interval = setInterval(fetchUsage, 60000); // Poll every minute
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center border border-amber-500/20">
                        <Coins className="text-amber-500 w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold tracking-tight">Token Usage</h2>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Real-time stats</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
                    <Activity className="w-3 h-3 text-green-500 animate-pulse" />
                    <span className="text-[10px] font-medium uppercase tracking-tighter opacity-80">Updated every 1m</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {summaries.length === 0 && !loading && (
                    <div className="col-span-full py-8 text-center text-muted-foreground text-sm opacity-50 italic">
                        No token usage recorded yet...
                    </div>
                )}

                {summaries.map((summary) => (
                    <div key={summary.model} className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-amber-500/20 transition-all group">
                        <div className="flex justify-between items-start mb-3">
                            <p className="text-xs font-mono font-bold text-amber-500/80 truncate pr-2 uppercase">{summary.model}</p>
                            <Database className="w-3 h-3 text-muted-foreground opacity-30 group-hover:opacity-100 transition-opacity" />
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="text-muted-foreground">In (Prompt)</span>
                                <span className="font-mono tabular-nums">{summary.totalPrompt.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="text-muted-foreground">Out (Reply)</span>
                                <span className="font-mono tabular-nums">{summary.totalCompletion.toLocaleString()}</span>
                            </div>
                            <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                                <span className="text-xs font-semibold text-white/90">Total</span>
                                <span className="text-sm font-bold text-amber-500 font-mono tracking-tighter">{summary.totalAll.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
