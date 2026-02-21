"use client";

import Link from "next/link";
import { Share2, Network, ChevronLeft } from "lucide-react";
import { ArchitectureDiagramProvider } from "@/components/ArchitectureDiagram";
import { SkillPalette } from "@/components/SkillPalette";

export default function ArchitecturePage() {
    return (
        <main className="min-h-screen p-4 md:p-8 lg:p-12 max-w-7xl mx-auto">
            {/* Header */}
            <header className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-6">
                    <Link
                        href="/"
                        className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors group"
                    >
                        <ChevronLeft className="w-5 h-5 text-muted-foreground group-hover:text-white transition-colors" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <Network className="text-blue-500 w-5 h-5" />
                            <h1 className="text-2xl font-bold tracking-tight">System Architecture</h1>
                        </div>
                        <p className="text-xs text-muted-foreground uppercase tracking-[0.2em]">Julia Agentic Neural Map</p>
                    </div>
                </div>

                <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-600/20">
                    <Share2 className="w-4 h-4" />
                    Export Schema
                </button>
            </header>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <aside className="lg:col-span-1">
                    <SkillPalette />
                </aside>

                <section className="lg:col-span-3">
                    <ArchitectureDiagramProvider />
                </section>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
                <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-blue-400 mb-4">01. Interaction</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Users communicate via Telegram or the Dashboard. OpenClaw processes the native protocol and sends it to the Bridge.
                    </p>
                </div>
                <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-purple-400 mb-4">02. Orchestration</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        The orchestrator receives filtered messages, selects relevant skills from the library, and generates high-level decisions.
                    </p>
                </div>
                <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-green-400 mb-4">03. Execution</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Actions are committed to the Backend API and persisted in PostgreSQL, creating a permanent memory log of all agentic behavior.
                    </p>
                </div>
            </div>

            <footer className="mt-12 text-center text-muted-foreground text-[10px] uppercase tracking-[0.2em] opacity-40">
                System Overview v2.0 · Refreshed Real-time
            </footer>
        </main>
    );
}
