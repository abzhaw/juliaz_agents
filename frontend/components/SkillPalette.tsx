import { Brain, Zap, Shield, Database, Layout, Search, Settings, Code } from "lucide-react";
import { motion } from "framer-motion";

const availableSkills = [
    { id: "s1", label: "julia-relay", icon: Zap, category: "OpenClaw", color: "text-blue-400" },
    { id: "s2", label: "bash-linux", icon: Settings, category: "Operations", color: "text-emerald-400" },
    { id: "s3", label: "memory-systems", icon: Brain, category: "Intelligence", color: "text-purple-400" },
    { id: "s4", label: "security-auditor", icon: Shield, category: "Security", color: "text-red-400" },
    { id: "s5", label: "postgres-expert", icon: Database, category: "Data", color: "text-amber-400" },
    { id: "s6", label: "ui-ux-pro-max", icon: Layout, category: "Design", color: "text-pink-400" },
    { id: "s7", label: "exa-search", icon: Search, category: "Research", color: "text-cyan-400" },
    { id: "s8", label: "python-pro", icon: Code, category: "Compute", color: "text-yellow-400" },
];

export function SkillPalette() {
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
                    {availableSkills.map((skill, index) => {
                        const Icon = skill.icon;
                        return (
                            <motion.div
                                key={skill.id}
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
                        );
                    })}
                </div>
            </div>

            <div className="mt-8 p-6 rounded-3xl bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl -mr-16 -mt-16" />
                <p className="text-xs text-blue-300 relative z-10 leading-relaxed font-medium">
                    <span className="font-bold block mb-1">Architecture Instruction</span>
                    Drop skills onto the neural fabric and connect nodes to expand Julia's functional surface.
                </p>
            </div>
        </div>
    );
}
