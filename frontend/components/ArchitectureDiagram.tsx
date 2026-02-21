"use client";

import React, { useMemo, useEffect } from "react";
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
import { User, MessageSquare, Link, Cpu, Database, Brain, Workflow, Zap, LucideIcon } from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────────

interface NodeData {
    label: string;
    title?: string;
    icon?: LucideIcon | any;
    active?: boolean;
}

// ── Custom Node Components ──────────────────────────────────────────────────

const SystemNode = ({ data }: NodeProps) => {
    const Icon = data.icon;
    return (
        <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.02, boxShadow: "0 0 20px rgba(59, 130, 246, 0.3)" }}
            className={`p-4 rounded-2xl border backdrop-blur-xl transition-all relative group ${data.active ? 'bg-blue-500/10 border-blue-500/50 shadow-blue-500/10' : 'bg-white/5 border-white/10 opacity-80'}`}
        >
            {data.active && (
                <div className="absolute -inset-[1px] bg-gradient-to-r from-blue-500/40 to-cyan-500/40 rounded-2xl blur-sm opacity-50 group-hover:opacity-100 transition-opacity" />
            )}

            <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-blue-500 !border-2 !border-black" />
            <div className="flex items-center gap-3 relative z-10">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner ${data.active ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/10 text-muted-foreground'}`}>
                    <Icon className="w-6 h-6" />
                </div>
                <div>
                    <p className="text-[10px] text-blue-400/70 uppercase tracking-widest font-bold mb-0.5">{data.label}</p>
                    <p className="text-sm font-bold text-white/90">{data.title}</p>
                </div>
            </div>
            <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-blue-500 !border-2 !border-black" />
        </motion.div>
    );
};

const SkillNode = ({ data }: NodeProps) => {
    return (
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
    );
};

const nodeTypes = {
    system: SystemNode,
    skill: SkillNode,
};

// ── Diagram Config ──────────────────────────────────────────────────────────

const initialNodes: Node<NodeData>[] = [
    // Primary Flow
    {
        id: "user",
        type: "system",
        position: { x: 0, y: 300 },
        data: { label: "User Interface", title: "Human Input", icon: User, active: true }
    },
    {
        id: "openclaw",
        type: "system",
        position: { x: 400, y: 300 },
        data: { label: "Messaging Gateway", title: "OpenClawJulia", icon: MessageSquare, active: true }
    },
    {
        id: "bridge",
        type: "system",
        position: { x: 800, y: 300 },
        data: { label: "The Glue", title: "MCP Bridge (Sync)", icon: Link, active: true }
    },
    {
        id: "orchestrator",
        type: "system",
        position: { x: 1200, y: 300 },
        data: { label: "Intelligence", title: "Julia Orchestrator", icon: Cpu, active: true }
    },
    {
        id: "backend",
        type: "system",
        position: { x: 1650, y: 150 },
        data: { label: "Application Layer", title: "REST API (Docker)", icon: Zap, active: true }
    },
    {
        id: "database",
        type: "system",
        position: { x: 1650, y: 450 },
        data: { label: "Persistence", title: "PostgreSQL / Memory", icon: Database, active: true }
    },

    // OpenClaw Skills
    { id: "oc-skill-1", type: "skill", position: { x: 350, y: 120 }, data: { label: "julia-relay", title: "Bridge", active: true } },
    { id: "oc-skill-2", type: "skill", position: { x: 460, y: 120 }, data: { label: "bash-linux", title: "Shell", active: true } },
    { id: "oc-skill-3", type: "skill", position: { x: 350, y: 480 }, data: { label: "notion-connector", title: "Sync", active: true } },
    { id: "oc-skill-4", type: "skill", position: { x: 460, y: 480 }, data: { label: "browser-automation", title: "Web", active: true } },

    // Orchestrator Skills
    { id: "skill-1", type: "skill", position: { x: 1150, y: 120 }, data: { label: "openclaw-expert", title: "Core", active: true } },
    { id: "skill-2", type: "skill", position: { x: 1260, y: 120 }, data: { label: "memory-systems", title: "Context", active: true } },
    { id: "skill-3", type: "skill", position: { x: 1150, y: 480 }, data: { label: "systematic-debugging", title: "QA", active: true } },
    { id: "skill-4", type: "skill", position: { x: 1260, y: 480 }, data: { label: "ui-ux-pro-max", title: "Design", active: true } },
];

const initialEdges = [
    // Flow Path
    { id: "e1-2", source: "user", target: "openclaw", animated: true, style: { strokeWidth: 2, stroke: "#3b82f6" } },
    { id: "e2-3", source: "openclaw", target: "bridge", animated: true, style: { strokeWidth: 2, stroke: "#3b82f6" } },
    { id: "e3-4", source: "bridge", target: "orchestrator", animated: true, style: { strokeWidth: 2, stroke: "#3b82f6" } },

    // Interactions
    { id: "e4-5", source: "orchestrator", target: "backend", label: "REST", style: { stroke: "#6366f1" } },
    { id: "e4-6", source: "orchestrator", target: "database", label: "Prisma", style: { stroke: "#6366f1" } },

    // OpenClaw Skill Connections
    { id: "ocs1", source: "openclaw", target: "oc-skill-1", style: { stroke: "#a855f7", strokeDasharray: "5 5", opacity: 0.4 } },
    { id: "ocs2", source: "openclaw", target: "oc-skill-2", style: { stroke: "#a855f7", strokeDasharray: "5 5", opacity: 0.4 } },
    { id: "ocs3", source: "openclaw", target: "oc-skill-3", style: { stroke: "#a855f7", strokeDasharray: "5 5", opacity: 0.4 } },
    { id: "ocs4", source: "openclaw", target: "oc-skill-4", style: { stroke: "#a855f7", strokeDasharray: "5 5", opacity: 0.4 } },

    // Orchestrator Skill Connections
    { id: "es1", source: "orchestrator", target: "skill-1", style: { stroke: "#a855f7", strokeDasharray: "5 5", opacity: 0.4 } },
    { id: "es2", source: "orchestrator", target: "skill-2", style: { stroke: "#a855f7", strokeDasharray: "5 5", opacity: 0.4 } },
    { id: "es3", source: "orchestrator", target: "skill-3", style: { stroke: "#a855f7", strokeDasharray: "5 5", opacity: 0.4 } },
    { id: "es4", source: "orchestrator", target: "skill-4", style: { stroke: "#a855f7", strokeDasharray: "5 5", opacity: 0.4 } },
];

export function ArchitectureDiagram() {
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
            x: event.clientX - 400, // Offset for side panel
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
                onInit={(instance) => console.log("Flow initialized")}
                onDrop={onDrop}
                onDragOver={onDragOver}
                nodeTypes={nodeTypes}
                fitView
                className="bg-dot-white/[0.1]"
            >
                <Background gap={20} color="#333" />
                <Controls showInteractive={true} className="!bg-white/10 !border-white/20 !fill-white" />
                <MiniMap
                    nodeColor={(n) => (n.type === "skill" ? "#a855f7" : "#3b82f6")}
                    maskColor="rgba(0,0,0,0.5)"
                    className="!bg-white/5 !border-white/10"
                />
            </ReactFlow>

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
                </div>
            </div>

            <div className="absolute bottom-6 left-6 max-w-sm pointer-events-none z-10">
                <h3 className="text-xl font-bold mb-2">System Builder v1.0</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                    Drag skills from the top palette to extend system capabilities.
                    Connect nodes to define new information routes.
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
