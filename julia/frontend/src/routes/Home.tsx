import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatWindow } from "@/components/ChatWindow";

export default function Home() {
    const [isChatOpen, setIsChatOpen] = useState(false);

    return (
        <main className="min-h-screen bg-black flex items-center justify-center overflow-hidden relative">

            {/* Ambient Background Energy when Chat is Open */}
            <AnimatePresence>
                {isChatOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 pointer-events-none"
                    >
                        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px]" />
                        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px]" />
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="relative z-10 w-full max-w-4xl flex flex-col items-center justify-center">

                {/* Floating Energy Chatbot Entity */}
                <motion.div
                    layout
                    onClick={() => setIsChatOpen(!isChatOpen)}
                    className="relative flex items-center justify-center cursor-pointer group z-20 mx-auto"
                    animate={{
                        width: isChatOpen ? 100 : 280,
                        height: isChatOpen ? 100 : 280,
                        marginBottom: isChatOpen ? 16 : 0
                    }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                >
                    {/* Core Energy Pulse */}
                    <motion.div
                        className="absolute inset-0 m-auto bg-cyan-400 rounded-full opacity-60 blur-3xl"
                        animate={{
                            scale: isChatOpen ? 1.5 : [1, 1.2, 1],
                            opacity: isChatOpen ? 0.3 : [0.6, 0.8, 0.6]
                        }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    />

                    {/* Orbiting Elements */}
                    <div className="absolute inset-0 animate-[spin_10s_linear_infinite]">
                        <div className="absolute top-1/4 left-1/4 w-1/4 h-1/4 bg-blue-500 rounded-full opacity-40 blur-xl animate-[pulse_2s_ease-in-out_infinite]" />
                        <div className="absolute bottom-1/4 right-1/4 w-1/3 h-1/3 bg-purple-500 rounded-full opacity-30 blur-2xl animate-[pulse_4s_ease-in-out_infinite]" />
                    </div>

                    {/* Inner Core */}
                    <div className="absolute inset-0 m-auto w-[45%] h-[45%] bg-white/10 rounded-full backdrop-blur-md shadow-[0_0_40px_rgba(255,255,255,0.2)] animate-[pulse_2s_ease-in-out_infinite] border border-white/20 group-hover:bg-white/20 transition-colors" />

                    {/* Interaction Hint */}
                    {!isChatOpen && (
                        <div className="absolute -bottom-10 md:-bottom-12 opacity-80 md:opacity-0 group-hover:opacity-100 transition-opacity text-white/50 text-[10px] md:text-xs tracking-widest font-mono">
                            TAP TO INITIATE
                        </div>
                    )}
                </motion.div>

                {/* Chat Interface — always mounted, animated show/hide */}
                <motion.div
                    initial={false}
                    animate={{
                        opacity: isChatOpen ? 1 : 0,
                        y: isChatOpen ? 0 : 40,
                        scale: isChatOpen ? 1 : 0.95,
                    }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    className={`w-full max-w-2xl px-2 md:px-4 ${
                        !isChatOpen ? "h-0 overflow-hidden pointer-events-none" : ""
                    }`}
                    aria-hidden={!isChatOpen}
                >
                    <ChatWindow className="flex flex-col h-[60vh] md:h-[500px] bg-white/5 md:bg-white/5 bg-black/40 border border-white/10 rounded-2xl md:rounded-3xl overflow-hidden shadow-[0_0_100px_rgba(0,100,255,0.1)] backdrop-blur-xl" />
                </motion.div>

            </div>

            <AnimatePresence>
                {!isChatOpen && (
                    <motion.div
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute bottom-10 text-white/40 text-sm font-mono tracking-widest text-center w-full"
                    >
                        SYSTEM AWAKE
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
}
