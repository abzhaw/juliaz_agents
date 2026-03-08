import { Brain, Zap, Shield, Database, Layout, Search, Settings, Code } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import architectureDocs from "../lib/architectureData.json";

const docs = architectureDocs as Record<string, { description?: string }>;

const availableSkills = [
    { id: "s1", label: "julia-relay", icon: Zap, category: "OpenClaw", color: "text-blue-400", description: docs["julia-relay"]?.description },
    { id: "s2", label: "bash-linux", icon: Settings, category: "Operations", color: "text-emerald-400", description: docs["bash-linux"]?.description },
    { id: "s3", label: "memory-systems", icon: Brain, category: "Intelligence", color: "text-purple-400", description: docs["memory-systems"]?.description },
    { id: "s4", label: "security-auditor", icon: Shield, category: "Security", color: "text-red-400", description: docs["security-auditor"]?.description },
    { id: "s5", label: "postgres-expert", icon: Database, category: "Data", color: "text-amber-400", description: docs["postgres-expert"]?.description },
    { id: "s6", label: "ui-ux-pro-max", icon: Layout, category: "Design", color: "text-pink-400", description: docs["ui-ux-pro-max"]?.description },
    { id: "s7", label: "exa-search", icon: Search, category: "Research", color: "text-cyan-400", description: docs["exa-search"]?.description },
    { id: "s8", label: "python-pro", icon: Code, category: "Compute", color: "text-yellow-400", description: docs["python-pro"]?.description },
];

function SkillPaletteItem({ skill, index, onDragStart }: {
    skill: typeof availableSkills[number];
    index: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onDragStart: (event: any, nodeType: string, label: string) => void;
}) {
    const Icon = skill.icon;
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className="relative"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.05 }}
                draggable
                onDragStart={(e) => onDragStart(e, "skill", skill.label)}
                className="p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all cursor-grab active:cursor-grabbing group"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center transition-colors group-hover:bg-blue-500/10 ${skill.color}`}>
                            <Icon className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-white/90 group-hover:text-blue-400 transition-colors uppercase tracking-tight">{skill.label}</p>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium">{skill.category}</p>
                        </div>
                    </div>
                </div>
            </motion.div>

            <AnimatePresence>
                {isHovered && skill.description && (
                    <motion.div
                        initial={{ opacity: 0, x: 10, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 5, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-full top-0 ml-3 w-56 p-3 bg-[#0a0a0a] border border-blue-500/30 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[100] pointer-events-none"
                    >
                        <p className="text-xs text-white/80 leading-relaxed">{skill.description}</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export function SkillPalette() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onDragStart = (event: any, nodeType: string, label: string) => {
        event.dataTransfer.setData("application/reactflow", nodeType);
        event.dataTransfer.setData("application/label", label);
        event.dataTransfer.effectAllowed = "move";
    };

    return (
        <div className="h-full flex flex-col">
            <div className="p-6 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-md flex-1">
                <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-blue-400 mb-6 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Brain className="w-4 h-4" />
                    </div>
                    Skill Inventory
                </h3>

                <div className="space-y-3">
                    {availableSkills.map((skill, index) => (
                        <SkillPaletteItem key={skill.id} skill={skill} index={index} onDragStart={onDragStart} />
                    ))}
                </div>
            </div>

            <div className="mt-8 p-6 rounded-3xl bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl -mr-16 -mt-16" />
                <p className="text-xs text-blue-300 relative z-10 leading-relaxed font-medium">
                    <span className="font-bold block mb-1">Architecture Instruction</span>
                    Drop skills onto the neural fabric and connect nodes to expand Julia&apos;s functional surface.
                </p>
            </div>
        </div>
    );
}
