"use client";

import { useState, useEffect, useRef } from "react";
import { Send, User, Bot } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
    id: string;
    chatId: string;
    username: string;
    text: string;
    timestamp: string;
    status: string;
    reply?: string;
}

export function ChatWindow() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchMessages = async () => {
        try {
            const res = await fetch("http://localhost:3001/messages");
            if (res.ok) {
                const data: Message[] = await res.json();
                setMessages(data.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
            }
        } catch (e) { }
    };

    useEffect(() => {
        fetchMessages();
        const interval = setInterval(fetchMessages, 3000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages]);

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        try {
            const res = await fetch("http://localhost:3001/incoming", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chatId: "dashboard-v2",
                    username: "Raphael",
                    text: input
                })
            });
            if (res.ok) {
                setInput("");
                fetchMessages();
            }
        } catch (e) { }
    };

    return (
        <div className="glass-panel flex flex-col h-[500px]">
            <div className="p-4 border-b border-white/5 flex justify-between items-center">
                <h3 className="font-semibold">Direct Communication</h3>
                <span className="text-xs text-muted-foreground uppercase tracking-widest">Julia Bridge</span>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                <AnimatePresence initial={false}>
                    {messages.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                            Waiting for neural activity...
                        </div>
                    ) : (
                        messages.map((msg) => (
                            <div key={msg.id} className="space-y-4">
                                {/* User Message */}
                                {msg.text && (
                                    <motion.div
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="flex justify-end"
                                    >
                                        <div className="bg-blue-600/20 border border-blue-500/20 p-3 rounded-2xl rounded-tr-none max-w-[80%] text-sm">
                                            {msg.text}
                                            <div className="text-[10px] text-blue-400/60 mt-1 uppercase mt-2">Raphael • {new Date(msg.timestamp).toLocaleTimeString()}</div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Julia Reply */}
                                {msg.reply && (
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="flex justify-start"
                                    >
                                        <div className="bg-white/5 border border-white/5 p-3 rounded-2xl rounded-tl-none max-w-[80%] text-sm">
                                            {msg.reply}
                                            <div className="text-[10px] text-muted-foreground mt-1 uppercase mt-2">Julia • {new Date(msg.timestamp).toLocaleTimeString()}</div>
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        ))
                    )}
                </AnimatePresence>
            </div>

            <form onSubmit={sendMessage} className="p-4 bg-black/20">
                <div className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Relay a thought to Julia..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
                    />
                    <button type="submit" className="absolute right-2 top-2 p-1.5 bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors">
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </form>
        </div>
    );
}
