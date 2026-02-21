import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
export const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
// ── Helpers ──────────────────────────────────────────────────────────────────
const asyncHandler = (fn) => (req, res, next) => {
    return Promise.resolve(fn(req, res, next)).catch(next);
};
const parseId = (id) => {
    if (!id) {
        const error = new Error('ID is required');
        error.status = 400;
        throw error;
    }
    const parsed = parseInt(id);
    if (isNaN(parsed)) {
        const error = new Error('Invalid ID format');
        error.status = 400;
        throw error;
    }
    return parsed;
};
// ── Routes ───────────────────────────────────────────────────────────────────
app.get('/health', asyncHandler(async (req, res) => {
    await prisma.$queryRaw `SELECT 1`;
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
    const updateData = {};
    if (title !== undefined)
        updateData.title = title;
    if (completed !== undefined)
        updateData.completed = completed;
    if (priority !== undefined)
        updateData.priority = priority;
    if (dueDate !== undefined)
        updateData.dueDate = dueDate ? new Date(dueDate) : null;
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
    const data = {};
    if (status !== undefined)
        data.status = status;
    if (lobId !== undefined)
        data.lobId = lobId;
    if (sentAt !== undefined)
        data.sentAt = new Date(sentAt);
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
// ── Root ──────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.send('Backend is running!');
});
// ── Error Handling ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
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
//# sourceMappingURL=index.js.map