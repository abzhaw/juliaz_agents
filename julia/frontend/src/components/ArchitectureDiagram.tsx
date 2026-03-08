import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    Handle,
    Position,
    NodeProps,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Edge,
    ReactFlowProvider,
    Node,
} from "reactflow";
import "reactflow/dist/style.css";
import {
    User, MessageSquare, Link as LinkIcon, Cpu, Database, Brain, Zap,
    Monitor, BrainCircuit, HeartPulse, Shield, FileText, ListTodo,
    Sparkles, Network, Radio, Bot, LucideIcon,
} from "lucide-react";

// ── Architecture data imports ────────────────────────────────────────────
import architectureDocs from "../lib/architectureData.json";

// Try loading dynamic graph — falls back to static if not generated yet
let dynamicGraph: GraphData | null = null;
try {
    dynamicGraph = require("../lib/architectureGraph.json");
} catch {
    dynamicGraph = null;
}

// ── Types ────────────────────────────────────────────────────────────────

interface GraphNode {
    id: string;
    label: string;
    title: string;
    icon: string;
    category: "core" | "agent" | "skill" | "infrastructure";
    position: { x: number; y: number };
    health?: "healthy" | "degraded" | "unknown";
    port?: string | null;
    schedule?: string;
    owner?: string;
}

interface GraphEdge {
    id: string;
    source: string;
    target: string;
    type: "data_flow" | "api_call" | "delegation" | "skill_injection" | "agent_comm";
    animated?: boolean;
    label?: string;
}

interface GraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
    metadata?: {
        generated_at: string;
        pm2_process_count: number;
        agent_count: number;
        skill_count: number;
        active_incidents: string[];
    };
}

interface NodeData {
    label: string;
    title?: string;
    icon?: LucideIcon | React.ElementType;
    active?: boolean;
    description?: string;
    health?: string;
    category?: string;
    port?: string | null;
    schedule?: string;
}

// ── Icon resolver ────────────────────────────────────────────────────────

const ICON_REGISTRY: Record<string, LucideIcon> = {
    User, MessageSquare, Link: LinkIcon, Cpu, Database, Brain, Zap,
    Monitor, BrainCircuit, HeartPulse, Shield, FileText, ListTodo,
    Sparkles, Network, Radio, Bot,
};

function resolveIcon(iconName: string): LucideIcon {
    return ICON_REGISTRY[iconName] || Bot;
}

// ── Health indicator ─────────────────────────────────────────────────────

function HealthDot({ health }: { health?: string }) {
    if (!health || health === "unknown") return null;
    const color = health === "healthy"
        ? "bg-emerald-500 shadow-emerald-500/50"
        : "bg-red-500 shadow-red-500/50 animate-pulse";
    return (
        <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${color} shadow-lg z-30 border-2 border-black`} />
    );
}

// ── Custom Node Components ───────────────────────────────────────────────

const SystemNode = ({ data }: NodeProps<NodeData>) => {
    const Icon = data.icon;
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className="relative"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.02, boxShadow: "0 0 20px rgba(59, 130, 246, 0.3)" }}
                className={`p-4 rounded-2xl border backdrop-blur-xl transition-all relative group z-20 ${data.active ? 'bg-blue-500/10 border-blue-500/50 shadow-blue-500/10' : 'bg-white/5 border-white/10 opacity-80'}`}
            >
                {data.active && (
                    <div className="absolute -inset-[1px] bg-gradient-to-r from-blue-500/40 to-cyan-500/40 rounded-2xl blur-sm opacity-50 group-hover:opacity-100 transition-opacity" />
                )}

                <HealthDot health={data.health} />
                <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-blue-500 !border-2 !border-black" />
                <div className="flex items-center gap-3 relative z-10">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner ${data.active ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/10 text-muted-foreground'}`}>
                        {Icon && <Icon className="w-6 h-6" />}
                    </div>
                    <div>
                        <p className="text-[10px] text-blue-400/70 uppercase tracking-widest font-bold mb-0.5">{data.label}</p>
                        <p className="text-sm font-bold text-white/90">{data.title}</p>
                        {data.port && (
                            <p className="text-[9px] text-blue-400/40 font-mono">:{data.port}</p>
                        )}
                    </div>
                </div>
                <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-blue-500 !border-2 !border-black" />
            </motion.div>

            <AnimatePresence>
                {isHovered && data.description && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 top-full mt-3 w-64 p-4 bg-[#0a0a0a] border border-white/20 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[100] pointer-events-none"
                    >
                        <p className="text-xs text-white/80 leading-relaxed font-medium">
                            {data.description}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const AgentNode = ({ data }: NodeProps<NodeData>) => {
    const Icon = data.icon;
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className="relative"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                whileHover={{ scale: 1.03, boxShadow: "0 0 15px rgba(16, 185, 129, 0.2)" }}
                className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 relative group shadow-lg shadow-emerald-500/5"
            >
                <div className="absolute -inset-[1px] bg-emerald-500/20 rounded-2xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
                <HealthDot health={data.health} />
                <Handle type="target" position={Position.Top} className="!bg-emerald-500 !w-2.5 !h-2.5 !border-2 !border-black" />
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center relative z-10">
                    {Icon && <Icon className="w-4 h-4 text-emerald-400" />}
                </div>
                <div className="relative z-10">
                    <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-tight block">{data.title}</span>
                    {data.schedule && (
                        <span className="text-[8px] text-emerald-400/50 font-mono">every {data.schedule}</span>
                    )}
                </div>
                <Handle type="source" position={Position.Bottom} className="!bg-emerald-500 !w-2.5 !h-2.5 !border-2 !border-black" />
            </motion.div>

            <AnimatePresence>
                {isHovered && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 top-full mt-2 w-56 p-3 bg-[#0a0a0a] border border-emerald-500/30 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[100] pointer-events-none"
                    >
                        <p className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider mb-1">Ambient Agent</p>
                        {data.description ? (
                            <p className="text-xs text-white/80 leading-relaxed">{data.description}</p>
                        ) : (
                            <p className="text-[9px] text-white/50">{data.label}</p>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const InfraNode = ({ data }: NodeProps<NodeData>) => {
    const Icon = data.icon;
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className="relative"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.05 }}
                className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 relative group shadow-lg shadow-amber-500/5"
            >
                <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-2 !h-2" />
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    {Icon && <Icon className="w-3.5 h-3.5 text-amber-400" />}
                </div>
                <span className="text-[10px] font-bold text-amber-200 uppercase tracking-tight relative z-10">{data.title}</span>
                <Handle type="source" position={Position.Bottom} className="!bg-amber-500 !w-2 !h-2" />
            </motion.div>

            <AnimatePresence>
                {isHovered && data.description && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 top-full mt-2 w-56 p-3 bg-[#0a0a0a] border border-amber-500/30 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[100] pointer-events-none"
                    >
                        <p className="text-[10px] text-amber-300 font-bold uppercase tracking-wider mb-1">Infrastructure</p>
                        <p className="text-xs text-white/80 leading-relaxed">{data.description}</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const SkillNode = ({ data }: NodeProps<NodeData>) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className="relative"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                whileHover={{ scale: 1.05 }}
                className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center gap-2 relative group shadow-lg shadow-purple-500/5"
            >
                <div className="absolute -inset-[1px] bg-purple-500/20 rounded-xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
                <Handle type="target" position={Position.Top} className="!bg-purple-500 !w-2 !h-2" />
                <Brain className="w-3.5 h-3.5 text-purple-400 relative z-10" />
                <span className="text-[10px] font-mono text-purple-200 uppercase tracking-tighter relative z-10">{data.label}</span>
                <Handle type="source" position={Position.Bottom} className="!bg-purple-500 !w-2 !h-2" />
            </motion.div>

            <AnimatePresence>
                {isHovered && data.description && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 top-full mt-2 w-56 p-3 bg-[#0a0a0a] border border-purple-500/30 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[100] pointer-events-none"
                    >
                        <p className="text-[10px] text-purple-300 font-bold uppercase tracking-wider mb-1">Skill</p>
                        <p className="text-xs text-white/80 leading-relaxed">{data.description}</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const nodeTypes = {
    system: SystemNode,
    skill: SkillNode,
    agent: AgentNode,
    infrastructure: InfraNode,
};

// ── Edge style resolver ──────────────────────────────────────────────────

function resolveEdgeStyle(edgeType: string) {
    switch (edgeType) {
        case "data_flow":
            return { strokeWidth: 2, stroke: "#3b82f6" };
        case "api_call":
            return { stroke: "#6366f1" };
        case "delegation":
            return { strokeWidth: 2, stroke: "#8b5cf6" };
        case "skill_injection":
            return { stroke: "#a855f7", strokeDasharray: "5 5", opacity: 0.4 };
        case "agent_comm":
            return { stroke: "#10b981", strokeDasharray: "4 4", opacity: 0.3 };
        default:
            return { stroke: "#444" };
    }
}

// ── Graph builder (static fallback + dynamic) ────────────────────────────

function buildNodes(graph: GraphData | null): Node<NodeData>[] {
    if (!graph) return buildStaticNodes();

    const docDescriptions = architectureDocs as Record<string, { description?: string } | string>;

    return graph.nodes.map((n) => ({
        id: n.id,
        type: n.category === "core" ? "system" :
              n.category === "agent" ? "agent" :
              n.category === "infrastructure" ? "infrastructure" : "skill",
        position: n.position,
        data: {
            label: n.label,
            title: n.title,
            icon: resolveIcon(n.icon),
            active: true,
            health: n.health,
            description: (() => {
                const key = n.id.replace("agent-", "").replace("skill-", "");
                const doc = docDescriptions[key];
                if (doc && typeof doc === "object" && "description" in doc) return doc.description;
                if (typeof doc === "string") return doc;
                return undefined;
            })(),
            port: n.port,
            schedule: n.schedule,
            category: n.category,
        },
    }));
}

function buildEdges(graph: GraphData | null): Edge[] {
    if (!graph) return buildStaticEdges();

    return graph.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: "smoothstep",
        animated: e.animated ?? false,
        label: e.label,
        style: resolveEdgeStyle(e.type),
    }));
}

// ── Static fallback (original hardcoded layout) ──────────────────────────

function buildStaticNodes(): Node<NodeData>[] {
    const docs = architectureDocs as Record<string, { description?: string }>;
    return [
        // Core system nodes
        { id: "user", type: "system", position: { x: 0, y: 300 }, data: { label: "User Interface", title: "Human Input", icon: User, active: true, description: docs.user?.description } },
        { id: "openclaw", type: "system", position: { x: 400, y: 300 }, data: { label: "Messaging Gateway", title: "OpenClaw", icon: MessageSquare, active: true, description: docs.openclaw?.description } },
        { id: "bridge", type: "system", position: { x: 800, y: 300 }, data: { label: "The Glue", title: "MCP Bridge (Sync)", icon: LinkIcon, active: true, description: docs.bridge?.description } },
        { id: "orchestrator", type: "system", position: { x: 1200, y: 300 }, data: { label: "Intelligence", title: "Julia-Orchestrator", icon: Cpu, active: true, description: docs.orchestrator?.description } },
        { id: "frontend", type: "system", position: { x: 0, y: 500 }, data: { label: "Web Dashboard", title: "Julia-Web", icon: Monitor, active: true, description: docs.frontend?.description } },
        { id: "cowork", type: "system", position: { x: 800, y: 500 }, data: { label: "AI Delegation", title: "Cowork-MCP", icon: BrainCircuit, active: true, description: docs.cowork?.description } },
        { id: "backend", type: "system", position: { x: 1650, y: 150 }, data: { label: "Application Layer", title: "REST API (Docker)", icon: Zap, active: true, description: docs.backend?.description } },
        { id: "database", type: "system", position: { x: 1650, y: 450 }, data: { label: "Persistence", title: "PostgreSQL / Memory", icon: Database, active: true, description: docs.database?.description } },
        // OpenClaw skills
        { id: "oc-skill-1", type: "skill", position: { x: 350, y: 120 }, data: { label: "julia-relay", title: "Bridge", active: true, description: docs["julia-relay"]?.description } },
        { id: "oc-skill-2", type: "skill", position: { x: 460, y: 120 }, data: { label: "bash-linux", title: "Shell", active: true, description: docs["bash-linux"]?.description } },
        // Orchestrator skills
        { id: "skill-1", type: "skill", position: { x: 1150, y: 120 }, data: { label: "openclaw-expert", title: "Core", active: true, description: docs["openclaw-expert"]?.description } },
        { id: "skill-2", type: "skill", position: { x: 1260, y: 120 }, data: { label: "memory-systems", title: "Context", active: true, description: docs["memory-systems"]?.description } },
        // Ambient agents
        { id: "agent-health", type: "agent", position: { x: 1200, y: 600 }, data: { label: "Monitors service health and reports issues", title: "Health Checker", icon: HeartPulse, active: true, description: docs["health-checker"]?.description, schedule: "5min" } },
        { id: "agent-security", type: "agent", position: { x: 1400, y: 600 }, data: { label: "Daily security scans and vulnerability reports", title: "Security Agent", icon: Shield, active: true, description: docs["security-agent"]?.description, schedule: "24h" } },
        { id: "agent-docs", type: "agent", position: { x: 1600, y: 600 }, data: { label: "Detects undocumented commits and drift", title: "Docs Agent", icon: FileText, active: true, description: docs["docs-agent"]?.description, schedule: "12h" } },
        // Infrastructure
        { id: "infra-pm2", type: "infrastructure", position: { x: 400, y: 600 }, data: { label: "Process Manager", title: "PM2", icon: ListTodo, active: true, description: docs.pm2?.description } },
        { id: "infra-shared", type: "infrastructure", position: { x: 600, y: 600 }, data: { label: "Cross-Agent Comms", title: "Shared Findings", icon: Network, active: true, description: docs["shared-findings"]?.description } },
    ];
}

function buildStaticEdges(): Edge[] {
    return [
        // Main message flow
        { id: "e1-2", source: "user", target: "openclaw", type: "smoothstep", animated: true, style: { strokeWidth: 2, stroke: "#3b82f6" } },
        { id: "e2-3", source: "openclaw", target: "bridge", type: "smoothstep", animated: true, style: { strokeWidth: 2, stroke: "#3b82f6" } },
        { id: "e3-4", source: "bridge", target: "orchestrator", type: "smoothstep", animated: true, style: { strokeWidth: 2, stroke: "#3b82f6" } },
        { id: "e4-5", source: "orchestrator", target: "backend", type: "smoothstep", label: "REST", style: { stroke: "#6366f1" } },
        { id: "e4-6", source: "orchestrator", target: "database", type: "smoothstep", label: "Prisma", style: { stroke: "#6366f1" } },
        // Frontend → Bridge
        { id: "e-fe-bridge", source: "frontend", target: "bridge", type: "smoothstep", animated: true, style: { strokeWidth: 2, stroke: "#3b82f6" } },
        // Cowork delegation
        { id: "e-orch-cowork", source: "orchestrator", target: "cowork", type: "smoothstep", label: "Delegate", style: { strokeWidth: 2, stroke: "#8b5cf6" } },
        // Skills → parent
        { id: "e-sk1-oc", source: "oc-skill-1", target: "openclaw", type: "smoothstep", style: { stroke: "#a855f7", strokeDasharray: "5 5", opacity: 0.4 } },
        { id: "e-sk2-oc", source: "oc-skill-2", target: "openclaw", type: "smoothstep", style: { stroke: "#a855f7", strokeDasharray: "5 5", opacity: 0.4 } },
        { id: "e-sk3-orch", source: "skill-1", target: "orchestrator", type: "smoothstep", style: { stroke: "#a855f7", strokeDasharray: "5 5", opacity: 0.4 } },
        { id: "e-sk4-orch", source: "skill-2", target: "orchestrator", type: "smoothstep", style: { stroke: "#a855f7", strokeDasharray: "5 5", opacity: 0.4 } },
        // Agents → shared findings
        { id: "e-health-shared", source: "agent-health", target: "infra-shared", type: "smoothstep", style: { stroke: "#10b981", strokeDasharray: "4 4", opacity: 0.3 } },
        { id: "e-sec-shared", source: "agent-security", target: "infra-shared", type: "smoothstep", style: { stroke: "#10b981", strokeDasharray: "4 4", opacity: 0.3 } },
        { id: "e-docs-shared", source: "agent-docs", target: "infra-shared", type: "smoothstep", style: { stroke: "#10b981", strokeDasharray: "4 4", opacity: 0.3 } },
        // PM2 manages agents
        { id: "e-pm2-health", source: "infra-pm2", target: "agent-health", type: "smoothstep", style: { stroke: "#f59e0b", strokeDasharray: "4 4", opacity: 0.3 } },
        { id: "e-pm2-sec", source: "infra-pm2", target: "agent-security", type: "smoothstep", style: { stroke: "#f59e0b", strokeDasharray: "4 4", opacity: 0.3 } },
        { id: "e-pm2-docs", source: "infra-pm2", target: "agent-docs", type: "smoothstep", style: { stroke: "#f59e0b", strokeDasharray: "4 4", opacity: 0.3 } },
    ];
}

// ── Metadata overlay ─────────────────────────────────────────────────────

function MetadataOverlay({ metadata }: { metadata?: GraphData["metadata"] }) {
    if (!metadata) return null;

    const ts = metadata.generated_at;
    const shortTs = ts ? ts.replace(/T/, " ").slice(0, 16) : "";

    return (
        <div className="absolute top-6 left-6 p-3 bg-black/60 border border-white/10 rounded-xl backdrop-blur-md pointer-events-none z-10">
            <p className="text-[9px] uppercase tracking-widest font-bold text-white/30 mb-1">Live Topology</p>
            <p className="text-[9px] text-white/50 font-mono">
                {metadata.pm2_process_count} processes · {metadata.agent_count} agents · {metadata.skill_count} skills
            </p>
            <p className="text-[8px] text-white/30 font-mono mt-1">Scanned {shortTs}</p>
            {metadata.active_incidents && metadata.active_incidents.length > 0 && (
                <p className="text-[9px] text-red-400 font-mono mt-1">
                    {metadata.active_incidents.length} active incident{metadata.active_incidents.length > 1 ? "s" : ""}
                </p>
            )}
        </div>
    );
}

// ── Main Diagram Component ───────────────────────────────────────────────

export function ArchitectureDiagram() {
    const initialNodes = useMemo(() => buildNodes(dynamicGraph), []);
    const initialEdges = useMemo(() => buildEdges(dynamicGraph), []);

    const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    const onConnect = (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds));

    const onDragOver = (event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    };

    const onDrop = (event: React.DragEvent) => {
        event.preventDefault();

        const type = event.dataTransfer.getData("application/reactflow");
        const label = event.dataTransfer.getData("application/label");

        if (typeof type === "undefined" || !type) return;

        const position = {
            x: event.clientX - 400,
            y: event.clientY - 100,
        };

        const newNode = {
            id: `dndnode_${Math.random()}`,
            type,
            position,
            data: {
                label,
                title: "Extended Capability",
                active: true
            },
        };

        setNodes((nds) => nds.concat(newNode));
    };

    return (
        <div className="h-[700px] w-full bg-black/10 rounded-3xl border border-white/5 overflow-hidden relative backdrop-blur-sm group/flow">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onInit={() => console.log("Flow initialized")}
                onDrop={onDrop}
                onDragOver={onDragOver}
                nodeTypes={nodeTypes}
                fitView
                className="bg-dot-white/[0.1]"
            >
                <Background gap={20} color="#333" />
                <Controls showInteractive={true} className="!bg-white/10 !border-white/20 !fill-white" />
                <MiniMap
                    nodeColor={(n) => {
                        switch (n.type) {
                            case "skill": return "#a855f7";
                            case "agent": return "#10b981";
                            case "infrastructure": return "#f59e0b";
                            default: return "#3b82f6";
                        }
                    }}
                    maskColor="rgba(0,0,0,0.5)"
                    className="!bg-white/5 !border-white/10"
                />
            </ReactFlow>

            {/* Metadata (live topology info) */}
            <MetadataOverlay metadata={dynamicGraph?.metadata} />

            {/* Legend / Overlay */}
            <div className="absolute top-6 right-6 p-4 bg-black/60 border border-white/10 rounded-2xl backdrop-blur-md pointer-events-none z-10">
                <h4 className="text-[10px] uppercase tracking-widest font-bold mb-3 text-white/50">Information Flow</h4>
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        <span className="text-[10px] text-white/80">Active Data Stream</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500 border border-purple-500/50" />
                        <span className="text-[10px] text-white/80">Skill Injection</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 border border-emerald-500/50" />
                        <span className="text-[10px] text-white/80">Ambient Agent</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500 border border-amber-500/50" />
                        <span className="text-[10px] text-white/80">Infrastructure</span>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-6 left-6 max-w-sm pointer-events-none z-10">
                <h3 className="text-xl font-bold mb-2">
                    {dynamicGraph ? "Live System Topology" : "System Builder v1.0"}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                    {dynamicGraph
                        ? "Auto-generated by the Architecture Agent. Topology updates every 6 hours."
                        : "Drag skills from the palette to extend system capabilities."
                    }
                </p>
            </div>
        </div>
    );
}

export function ArchitectureDiagramProvider() {
    return (
        <ReactFlowProvider>
            <ArchitectureDiagram />
        </ReactFlowProvider>
    );
}
