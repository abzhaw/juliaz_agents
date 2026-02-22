import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  Send,
  Loader2,
  Sparkles,
  RotateCcw,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  loadMessages,
  saveMessages,
  clearMessages,
  loadModel,
  saveModel,
  MODEL_LABELS,
  type ModelId,
} from "@/lib/chat-persistence";
import { contextPercent } from "@/lib/token-estimate";

/**
 * ChatWindow — Streaming AI chatbot powered by Vercel AI SDK.
 *
 * Features:
 * - localStorage persistence (survives refresh + orb toggle)
 * - Model selector (GPT-4o / Claude Sonnet)
 * - Context usage % indicator
 * - "New Chat" reset button
 */
export function ChatWindow({
  className = "glass-panel flex flex-col h-[500px]",
}: {
  className?: string;
}) {
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState<ModelId>(() =>
    loadModel()
  );
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load persisted messages on mount (client-only lazy initializer)
  const [initialMessages] = useState(() => loadMessages());

  const { messages, sendMessage, setMessages, regenerate, status, error } =
    useChat({
      messages: initialMessages,
      transport: new DefaultChatTransport({
        api: "/api/chat",
      }),
    });

  const isLoading = status === "streaming" || status === "submitted";

  // Persist messages when a response completes
  useEffect(() => {
    if (messages.length > 0 && status === "ready") {
      saveMessages(messages);
    }
  }, [messages, status]);

  // Auto-scroll on new messages / streaming tokens
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsModelDropdownOpen(false);
      }
    }
    if (isModelDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isModelDropdownOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input }, { body: { model: selectedModel } });
    setInput("");
  };

  const handleNewChat = () => {
    setMessages([]);
    clearMessages();
  };

  const handleModelChange = (model: ModelId) => {
    setSelectedModel(model);
    saveModel(model);
    setIsModelDropdownOpen(false);
  };

  const ctxPercent = contextPercent(messages, selectedModel);

  return (
    <div className={className}>
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex justify-between items-center gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <h3 className="font-semibold text-sm md:text-base truncate">
            JuliaFrontEnd
          </h3>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Context usage indicator */}
          <div
            className="flex items-center gap-1.5"
            title={`~${ctxPercent}% context used`}
          >
            <div className="w-12 md:w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  ctxPercent > 80
                    ? "bg-red-500"
                    : ctxPercent > 50
                      ? "bg-yellow-500"
                      : "bg-blue-500"
                }`}
                style={{ width: `${Math.max(ctxPercent, 1)}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums w-7 text-right">
              {ctxPercent}%
            </span>
          </div>

          {/* Model selector dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors bg-white/5 px-2 py-1 rounded-lg border border-white/10"
            >
              <span className="hidden md:inline">
                {MODEL_LABELS[selectedModel]}
              </span>
              <span className="md:hidden text-[10px]">
                {selectedModel === "gpt-4o" ? "GPT" : "Claude"}
              </span>
              <ChevronDown className="w-3 h-3" />
            </button>
            <AnimatePresence>
              {isModelDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.1 }}
                  className="absolute right-0 top-full mt-1 bg-neutral-900 border border-white/10 rounded-lg shadow-xl z-50 min-w-[140px] overflow-hidden"
                >
                  {(
                    Object.entries(MODEL_LABELS) as [ModelId, string][]
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => handleModelChange(id)}
                      className={`block w-full text-left px-3 py-2 text-xs hover:bg-white/10 transition-colors ${
                        id === selectedModel
                          ? "text-blue-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* New Chat button */}
          <button
            onClick={handleNewChat}
            disabled={isLoading || messages.length === 0}
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 p-1"
            title="New Chat"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide"
      >
        <AnimatePresence initial={false}>
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              Ask JuliaFrontEnd anything...
            </div>
          ) : (
            messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] text-sm ${
                    msg.role === "user"
                      ? "bg-blue-600/20 border border-blue-500/20 p-3 rounded-2xl rounded-tr-none"
                      : "bg-white/5 border border-white/5 p-3 rounded-2xl rounded-tl-none"
                  }`}
                >
                  {msg.parts.map((part, i) => {
                    // Text parts — render markdown for assistant, plain text for user
                    if (part.type === "text") {
                      return msg.role === "assistant" ? (
                        <div
                          key={i}
                          className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-pre:my-2 prose-ul:my-1 prose-ol:my-1 prose-headings:my-2"
                        >
                          <Markdown remarkPlugins={[remarkGfm]}>
                            {part.text}
                          </Markdown>
                        </div>
                      ) : (
                        <span key={i}>{part.text}</span>
                      );
                    }

                    // Tool parts — v5 flattens properties directly on the part
                    if ("toolCallId" in part) {
                      const toolName = part.type.replace(
                        /^(tool-|dynamic-tool)/,
                        ""
                      );
                      const isRunning =
                        part.state === "input-streaming" ||
                        part.state === "input-available" ||
                        part.state === "approval-requested" ||
                        part.state === "approval-responded";
                      const isDone = part.state === "output-available";
                      const isError =
                        part.state === "output-error" ||
                        part.state === "output-denied";
                      return (
                        <div
                          key={i}
                          className="text-xs text-blue-400/60 bg-blue-500/5 border border-blue-500/10 rounded-lg px-2 py-1 my-1 font-mono"
                        >
                          {isRunning && (
                            <span className="flex items-center gap-1.5">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Calling {toolName}...
                            </span>
                          )}
                          {isDone && <span>{toolName} done</span>}
                          {isError && (
                            <span className="text-red-400/60">
                              {toolName} failed
                            </span>
                          )}
                        </div>
                      );
                    }

                    return null;
                  })}

                  {/* Role label */}
                  <div
                    className={`text-[10px] mt-2 uppercase ${
                      msg.role === "user"
                        ? "text-blue-400/60"
                        : "text-muted-foreground"
                    }`}
                  >
                    {msg.role === "user" ? "You" : "JuliaFrontEnd"}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>

        {/* Streaming indicator */}
        {status === "submitted" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="text-[10px] text-blue-400/40 animate-pulse uppercase tracking-widest pl-2 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              JuliaFrontEnd is thinking...
            </div>
          </motion.div>
        )}

        {/* Error display */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-center"
          >
            <div className="text-xs text-red-400/80 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
              <span>Something went wrong.</span>
              <button
                onClick={() => regenerate()}
                className="text-red-300 hover:text-red-200 transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Retry
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 bg-black/20">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask JuliaFrontEnd anything..."
            disabled={isLoading}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-12 text-base md:text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 top-2 p-1.5 bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-30 disabled:hover:bg-blue-600"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
