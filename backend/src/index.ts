import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

export const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ── Helpers ──────────────────────────────────────────────────────────────────

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
    (req: Request, res: Response, next: NextFunction) => {
        return Promise.resolve(fn(req, res, next)).catch(next);
    };

const parseId = (id: string | undefined): number => {
    if (!id) {
        const error = new Error('ID is required');
        (error as any).status = 400;
        throw error;
    }
    const parsed = parseInt(id);
    if (isNaN(parsed)) {
        const error = new Error('Invalid ID format');
        (error as any).status = 400;
        throw error;
    }
    return parsed;
};

// ── Routes ───────────────────────────────────────────────────────────────────

app.get('/health', asyncHandler(async (req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'OK', database: 'Connected' });
}));

app.get('/tasks', asyncHandler(async (req, res) => {
    const tasks = await prisma.task.findMany({
        orderBy: { createdAt: 'desc' }
    });
    res.json(tasks);
}));

app.post('/tasks', asyncHandler(async (req, res) => {
    const { title, priority, dueDate } = req.body;
    if (!title) {
        return res.status(400).json({ status: 'Error', message: 'Title is required' });
    }
    const task = await prisma.task.create({
        data: {
            title,
            priority: priority || 'medium',
            dueDate: dueDate ? new Date(dueDate) : null
        }
    });
    res.status(201).json(task);
}));

app.patch('/tasks/:id', asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const { title, completed, priority, dueDate } = req.body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (completed !== undefined) updateData.completed = completed;
    if (priority !== undefined) updateData.priority = priority;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;

    const task = await prisma.task.update({
        where: { id },
        data: updateData
    });
    res.json(task);
}));

app.delete('/tasks/:id', asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    await prisma.task.delete({
        where: { id }
    });
    res.status(204).send();
}));

// Logs Endpoints
app.get('/logs', asyncHandler(async (req, res) => {
    const logs = await prisma.log.findMany({
        take: 100,
        orderBy: { timestamp: 'desc' }
    });
    res.json(logs);
}));

app.post('/logs', asyncHandler(async (req, res) => {
    const { level, source, message } = req.body;
    if (!source || !message) {
        return res.status(400).json({ status: 'Error', message: 'Source and message are required' });
    }
    const log = await prisma.log.create({
        data: { level: level || 'info', source, message }
    });
    res.status(201).json(log);
}));

// ── Memories ──────────────────────────────────────────────────────────────────

app.get('/memories', asyncHandler(async (req, res) => {
    const memories = await prisma.memory.findMany({
        orderBy: { createdAt: 'desc' }
    });
    res.json(memories);
}));

app.post('/memories', asyncHandler(async (req, res) => {
    const { chatId, category, content, originalText } = req.body;
    if (!chatId || !category || !content) {
        return res.status(400).json({ status: 'Error', message: 'chatId, category, and content are required' });
    }
    const memory = await prisma.memory.create({
        data: { chatId, category, content, originalText }
    });
    res.status(201).json(memory);
}));

app.delete('/memories/:id', asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    await prisma.memory.delete({ where: { id } });
    res.status(204).send();
}));

// ── Letters ───────────────────────────────────────────────────────────────────

app.get('/letters', asyncHandler(async (req, res) => {
    const letters = await prisma.letter.findMany({
        orderBy: { createdAt: 'desc' }
    });
    res.json(letters);
}));

app.post('/letters', asyncHandler(async (req, res) => {
    const { content, status, lobId, sentAt } = req.body;
    if (!content) {
        return res.status(400).json({ status: 'Error', message: 'Content is required' });
    }
    const letter = await prisma.letter.create({
        data: {
            content,
            status: status ?? 'DRAFT',
            lobId: lobId ?? null,
            sentAt: sentAt ? new Date(sentAt) : null
        }
    });
    res.status(201).json(letter);
}));

app.patch('/letters/:id', asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const { status, lobId, sentAt } = req.body;
    const data: any = {};
    if (status !== undefined) data.status = status;
    if (lobId !== undefined) data.lobId = lobId;
    if (sentAt !== undefined) data.sentAt = new Date(sentAt);
    const letter = await prisma.letter.update({
        where: { id },
        data
    });
    res.json(letter);
}));

// ── Usage ────────────────────────────────────────────────────────────────────

app.get('/usage', asyncHandler(async (req, res) => {
    const usage = await prisma.usage.findMany({
        orderBy: { timestamp: 'desc' },
        take: 1000
    });
    res.json(usage);
}));

app.post('/usage', asyncHandler(async (req, res) => {
    const { model, promptTokens, completionTokens, totalTokens } = req.body;
    if (!model || promptTokens === undefined || completionTokens === undefined) {
        return res.status(400).json({ status: 'Error', message: 'model, promptTokens, and completionTokens are required' });
    }
    const record = await prisma.usage.create({
        data: {
            model,
            promptTokens,
            completionTokens,
            totalTokens: totalTokens || (promptTokens + completionTokens)
        }
    });
    res.status(201).json(record);
}));

// ── Updates ──────────────────────────────────────────────────────────────────

app.get('/updates', asyncHandler(async (req, res) => {
    const updates = await prisma.update.findMany({
        orderBy: { timestamp: 'desc' }
    });
    res.json(updates);
}));

app.post('/updates', asyncHandler(async (req, res) => {
    const { title, content, type } = req.body;
    if (!title || !content) {
        return res.status(400).json({ status: 'Error', message: 'title and content are required' });
    }
    const update = await prisma.update.create({
        data: { title, content, type: type || 'PROGRESS' }
    });
    res.status(201).json(update);
}));

// ── Self-Evolution: Prompt Versions ──────────────────────────────────────────

app.get('/prompt-versions', asyncHandler(async (req, res) => {
    const versions = await prisma.promptVersion.findMany({
        orderBy: { version: 'desc' }
    });
    res.json(versions);
}));

app.get('/prompt-versions/active', asyncHandler(async (req, res) => {
    const active = await prisma.promptVersion.findFirst({
        where: { isActive: true }
    });
    if (!active) {
        return res.status(404).json({ status: 'Error', message: 'No active prompt version' });
    }
    res.json(active);
}));

app.post('/prompt-versions', asyncHandler(async (req, res) => {
    const { version, content, parentVersion, changeReason, changeDiff, isActive } = req.body;
    if (!content || version === undefined || !changeReason) {
        return res.status(400).json({ status: 'Error', message: 'version, content, and changeReason are required' });
    }
    // If activating this version, deactivate all others
    if (isActive) {
        await prisma.promptVersion.updateMany({
            where: { isActive: true },
            data: { isActive: false, deactivatedAt: new Date() }
        });
    }
    const pv = await prisma.promptVersion.create({
        data: {
            version,
            content,
            isActive: isActive ?? false,
            parentVersion: parentVersion ?? null,
            changeReason,
            changeDiff: changeDiff ?? null,
            activatedAt: isActive ? new Date() : null
        }
    });
    res.status(201).json(pv);
}));

app.patch('/prompt-versions/:id/activate', asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    // Deactivate all others
    await prisma.promptVersion.updateMany({
        where: { isActive: true },
        data: { isActive: false, deactivatedAt: new Date() }
    });
    const pv = await prisma.promptVersion.update({
        where: { id },
        data: { isActive: true, activatedAt: new Date() }
    });
    res.json(pv);
}));

app.patch('/prompt-versions/:id', asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const { avgScore, evalCount } = req.body;
    const data: any = {};
    if (avgScore !== undefined) data.avgScore = avgScore;
    if (evalCount !== undefined) data.evalCount = evalCount;
    const pv = await prisma.promptVersion.update({ where: { id }, data });
    res.json(pv);
}));

// ── Self-Evolution: Tool Interactions ────────────────────────────────────────

app.get('/tool-interactions', asyncHandler(async (req, res) => {
    const since = req.query.since ? new Date(req.query.since as string) : null;
    const interactions = await prisma.toolInteraction.findMany({
        ...(since ? { where: { createdAt: { gte: since } } } : {}),
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { evaluations: true }
    });
    res.json(interactions);
}));

app.post('/tool-interactions', asyncHandler(async (req, res) => {
    const { chatId, promptVersion, userMessage, conversationCtx, toolCalls, finalReply, model } = req.body;
    if (!chatId || promptVersion === undefined || !userMessage || !toolCalls || !finalReply || !model) {
        return res.status(400).json({ status: 'Error', message: 'chatId, promptVersion, userMessage, toolCalls, finalReply, and model are required' });
    }
    const interaction = await prisma.toolInteraction.create({
        data: { chatId, promptVersion, userMessage, conversationCtx, toolCalls, finalReply, model }
    });
    res.status(201).json(interaction);
}));

// ── Self-Evolution: Tool Evaluations ─────────────────────────────────────────

app.get('/tool-evaluations', asyncHandler(async (req, res) => {
    const since = req.query.since ? new Date(req.query.since as string) : null;
    const evaluations = await prisma.toolEvaluation.findMany({
        ...(since ? { where: { createdAt: { gte: since } } } : {}),
        orderBy: { createdAt: 'desc' },
        take: 500
    });
    res.json(evaluations);
}));

app.post('/tool-evaluations', asyncHandler(async (req, res) => {
    const { interactionId, graderName, score, rawScore, passed, reasoning, suggestion } = req.body;
    if (!interactionId || !graderName || passed === undefined) {
        return res.status(400).json({ status: 'Error', message: 'interactionId, graderName, and passed are required' });
    }
    const evaluation = await prisma.toolEvaluation.create({
        data: {
            interactionId,
            graderName,
            score: score ?? null,
            rawScore: rawScore ?? null,
            passed,
            reasoning: reasoning ?? null,
            suggestion: suggestion ?? null
        }
    });
    res.status(201).json(evaluation);
}));

// ── Self-Evolution: Optimization Runs ────────────────────────────────────────

app.get('/optimization-runs', asyncHandler(async (req, res) => {
    const runs = await prisma.promptOptimizationRun.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50
    });
    res.json(runs);
}));

app.post('/optimization-runs', asyncHandler(async (req, res) => {
    const { fromVersion, toVersion, evaluationsUsed, avgScoreBefore, failingGraders, feedbackSummary, optimizerModel, optimizerOutput, decision } = req.body;
    if (fromVersion === undefined || !decision || !optimizerModel || !optimizerOutput) {
        return res.status(400).json({ status: 'Error', message: 'fromVersion, decision, optimizerModel, and optimizerOutput are required' });
    }
    const run = await prisma.promptOptimizationRun.create({
        data: {
            fromVersion,
            toVersion: toVersion ?? null,
            evaluationsUsed: evaluationsUsed ?? 0,
            avgScoreBefore: avgScoreBefore ?? 0,
            failingGraders: failingGraders ?? '[]',
            feedbackSummary: feedbackSummary ?? '',
            optimizerModel,
            optimizerOutput,
            decision
        }
    });
    res.status(201).json(run);
}));

// ── Self-Evolution: Aggregate Stats ──────────────────────────────────────────

app.get('/evolution-stats', asyncHandler(async (req, res) => {
    const [versions, totalInteractions, totalEvaluations, recentRuns] = await Promise.all([
        prisma.promptVersion.findMany({ orderBy: { version: 'asc' } }),
        prisma.toolInteraction.count(),
        prisma.toolEvaluation.count(),
        prisma.promptOptimizationRun.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10
        })
    ]);

    // Per-grader pass rates from last 50 evaluations
    const recentEvals = await prisma.toolEvaluation.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200
    });
    const graderStats: Record<string, { total: number; passed: number; avgScore: number }> = {};
    for (const ev of recentEvals) {
        if (!graderStats[ev.graderName]) {
            graderStats[ev.graderName] = { total: 0, passed: 0, avgScore: 0 };
        }
        const g = graderStats[ev.graderName]!;
        g.total++;
        if (ev.passed) g.passed++;
        if (ev.score !== null) {
            g.avgScore = (g.avgScore * (g.total - 1) + ev.score) / g.total;
        }
    }

    res.json({
        promptVersions: versions.map(v => ({
            version: v.version,
            isActive: v.isActive,
            avgScore: v.avgScore,
            evalCount: v.evalCount,
            changeReason: v.changeReason,
            createdAt: v.createdAt,
            activatedAt: v.activatedAt
        })),
        totalInteractions,
        totalEvaluations,
        graderStats,
        recentOptimizationRuns: recentRuns.map(r => ({
            fromVersion: r.fromVersion,
            toVersion: r.toVersion,
            decision: r.decision,
            avgScoreBefore: r.avgScoreBefore,
            createdAt: r.createdAt
        }))
    });
}));

// ── Root ──────────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
    res.send('Backend is running!');
});

// ── Error Handling ────────────────────────────────────────────────────────────

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Error:', err.message);
    const status = err.status || 500;
    res.status(status).json({
        status: 'Error',
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

if (process.env.NODE_ENV !== 'test') {
    app.listen(port, () => {
        console.log(`API running on http://localhost:${port}`);
    });
}
