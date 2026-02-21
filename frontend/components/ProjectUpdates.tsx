"use client";

import React, { useEffect, useState } from "react";
import { Megaphone, Calendar, ChevronRight, Sparkles, TrendingUp } from "lucide-react";

interface UpdateRecord {
    id: number;
    title: string;
    content: string;
    type: "PROGRESS" | "ANNOUNCEMENT" | "MILESTONE";
    timestamp: string;
}

export function ProjectUpdates() {
    const [updates, setUpdates] = useState<UpdateRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchUpdates = async () => {
        try {
            const res = await fetch("http://localhost:3000/updates");
            if (!res.ok) throw new Error("Failed to fetch updates");
            const data = await res.json();
            setUpdates(data);
        } catch (err) {
            console.error("ProjectUpdates error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUpdates();
        const interval = setInterval(fetchUpdates, 60000);
        return () => clearInterval(interval);
    }, []);

    const getTypeStyles = (type: string) => {
        switch (type) {
            case "MILESTONE":
                return "bg-purple-500/10 text-purple-400 border-purple-500/20";
            case "ANNOUNCEMENT":
                return "bg-blue-500/10 text-blue-400 border-blue-500/20";
            default:
                return "bg-green-500/10 text-green-400 border-green-500/20";
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case "MILESTONE":
                return <Sparkles className="w-3 h-3" />;
            case "ANNOUNCEMENT":
                return <Megaphone className="w-3 h-3" />;
            default:
                return <TrendingUp className="w-3 h-3" />;
        }
    };

    return (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center border border-purple-500/20">
                    <Megaphone className="text-purple-500 w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold tracking-tight">Project Updates</h2>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Progress & News</p>
                </div>
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {updates.length === 0 && !loading && (
                    <div className="py-8 text-center text-muted-foreground text-sm opacity-50 italic">
                        No updates posted yet...
                    </div>
                )}

                {updates.map((update) => (
                    <div key={update.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-purple-500/20 transition-all group relative overflow-hidden">
                        <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tight border flex items-center gap-1.5 ${getTypeStyles(update.type)}`}>
                                {getTypeIcon(update.type)}
                                {update.type}
                            </span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(update.timestamp).toLocaleDateString()}
                            </span>
                        </div>

                        <h3 className="text-sm font-bold text-white/90 mb-1 group-hover:text-purple-400 transition-colors">{update.title}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{update.content}</p>

                        <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-purple-500/80 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                            Read More <ChevronRight className="w-3 h-3" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
