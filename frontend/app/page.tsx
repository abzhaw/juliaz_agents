import { AgentStatus } from "@/components/AgentStatus";
import { ChatWindow } from "@/components/ChatWindow";
import { TaskBoard } from "@/components/TaskBoard";
import { LogFeed } from "@/components/LogFeed";
import { Zap } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen p-4 md:p-8 lg:p-12 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Zap className="text-white w-6 h-6 fill-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Julia Agentic</h1>
          </div>
          <p className="text-muted-foreground text-sm">Multi-agent command & control interface v2.0</p>
        </div>

        <div className="flex items-center gap-4 bg-white/5 border border-white/5 px-4 py-2 rounded-2xl">
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Active Runtime</p>
            <p className="text-xs font-mono">NODE_MAC_OS_ARM64</p>
          </div>
        </div>
      </header>

      {/* Grid Layout */}
      <div className="space-y-8">
        {/* Top Row: Quick Stats */}
        <AgentStatus />

        {/* Middle Row: Chat & Tasks */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <ChatWindow />
          </div>
          <div className="lg:col-span-1">
            <TaskBoard />
          </div>
        </div>

        {/* Bottom Row: Logs */}
        <div className="h-[250px]">
          <LogFeed />
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 text-center text-muted-foreground text-[10px] uppercase tracking-[0.2em] opacity-40">
        Engineered by Antigravity · Powered by Gemini & GPT-4o
      </footer>
    </main>
  );
}
