"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Clock, Plus, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Task {
    id: number;
    title: string;
    priority: string;
    completed: boolean;
    createdAt: string;
    dueDate: string | null;
}

export function TaskBoard() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [newTitle, setNewTitle] = useState("");

    const fetchTasks = async () => {
        try {
            const res = await fetch("http://localhost:3000/tasks");
            if (res.ok) setTasks(await res.json());
        } catch (e) { }
    };

    useEffect(() => {
        fetchTasks();
        const interval = setInterval(fetchTasks, 5000);
        return () => clearInterval(interval);
    }, []);

    const addTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle.trim()) return;
        try {
            const res = await fetch("http://localhost:3000/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: newTitle })
            });
            if (res.ok) {
                setNewTitle("");
                fetchTasks();
            }
        } catch (e) { }
    };

    const toggleTask = async (id: number, completed: boolean) => {
        try {
            await fetch(`http://localhost:3000/tasks/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ completed: !completed })
            });
            fetchTasks();
        } catch (e) { }
    };

    const deleteTask = async (id: number) => {
        try {
            await fetch(`http://localhost:3000/tasks/${id}`, { method: "DELETE" });
            fetchTasks();
        } catch (e) { }
    };

    return (
        <div className="glass-panel p-6 h-full">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-semibold flex items-center gap-2">
                    <Clock className="w-5 h-5 text-orange-400" />
                    Active Objectives
                </h3>
                <span className="text-[10px] bg-white/5 border border-white/5 px-2 py-1 rounded uppercase tracking-widest">Backend Sync</span>
            </div>

            <form onSubmit={addTask} className="mb-6">
                <div className="relative">
                    <input
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="New objective..."
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 pr-10 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                    />
                    <button type="submit" className="absolute right-2 top-2 text-white/40 hover:text-white">
                        <Plus className="w-5 h-5" />
                    </button>
                </div>
            </form>

            <div className="space-y-3 overflow-y-auto max-h-[350px] scrollbar-hide">
                <AnimatePresence>
                    {tasks.map((task) => (
                        <motion.div
                            key={task.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className={`p-3 rounded-lg border flex items-center justify-between group transition-colors ${task.completed ? 'bg-white/2 border-white/5 opacity-50' : 'bg-white/5 border-white/10'}`}
                        >
                            <div className="flex items-center gap-3">
                                <button onClick={() => toggleTask(task.id, task.completed)}>
                                    {task.completed ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Circle className="w-5 h-5 text-white/20" />}
                                </button>
                                <span className={`text-sm ${task.completed ? 'line-through' : ''}`}>{task.title}</span>
                            </div>
                            <button
                                onClick={() => deleteTask(task.id)}
                                className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-opacity"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}
