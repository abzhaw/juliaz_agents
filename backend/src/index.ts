import express from 'express';
import { PrismaClient } from '@prisma/client';

export const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: 'OK', database: 'Connected' });
    } catch (error) {
        res.status(500).json({ status: 'Error', database: 'Disconnected', error: String(error) });
    }
});

app.get('/tasks', async (req, res) => {
    const tasks = await prisma.task.findMany({
        orderBy: { createdAt: 'desc' }
    });
    res.json(tasks);
});

app.post('/tasks', async (req, res) => {
    const { title, priority, dueDate } = req.body;
    const task = await prisma.task.create({
        data: {
            title,
            priority: priority || 'medium',
            dueDate: dueDate ? new Date(dueDate) : null
        }
    });
    res.status(201).json(task);
});

app.patch('/tasks/:id', async (req, res) => {
    const { id } = req.params;
    const { title, completed, priority, dueDate } = req.body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (completed !== undefined) updateData.completed = completed;
    if (priority !== undefined) updateData.priority = priority;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;

    const task = await prisma.task.update({
        where: { id: parseInt(id) },
        data: updateData
    });
    res.json(task);
});

app.delete('/tasks/:id', async (req, res) => {
    const { id } = req.params;
    await prisma.task.delete({
        where: { id: parseInt(id) }
    });
    res.status(204).send();
});

// Logs Endpoints
app.get('/logs', async (req, res) => {
    const logs = await prisma.log.findMany({
        take: 100,
        orderBy: { timestamp: 'desc' }
    });
    res.json(logs);
});

app.post('/logs', async (req, res) => {
    const { level, source, message } = req.body;
    const log = await prisma.log.create({
        data: { level: level || 'info', source, message }
    });
    res.status(201).json(log);
});

// ── Memories ──────────────────────────────────────────────────────────────────

app.get('/memories', async (req, res) => {
    const memories = await prisma.memory.findMany({
        orderBy: { createdAt: 'desc' }
    });
    res.json(memories);
});

app.post('/memories', async (req, res) => {
    const { chatId, category, content, originalText } = req.body;
    const memory = await prisma.memory.create({
        data: { chatId, category, content, originalText }
    });
    res.status(201).json(memory);
});

app.delete('/memories/:id', async (req, res) => {
    await prisma.memory.delete({ where: { id: parseInt(req.params.id) } });
    res.status(204).send();
});

// ── Letters ───────────────────────────────────────────────────────────────────

app.get('/letters', async (req, res) => {
    const letters = await prisma.letter.findMany({
        orderBy: { createdAt: 'desc' }
    });
    res.json(letters);
});

app.post('/letters', async (req, res) => {
    const { content, status, lobId, sentAt } = req.body;
    const letter = await prisma.letter.create({
        data: {
            content,
            status: status ?? 'DRAFT',
            lobId: lobId ?? null,
            sentAt: sentAt ? new Date(sentAt) : null
        }
    });
    res.status(201).json(letter);
});

app.patch('/letters/:id', async (req, res) => {
    const { status, lobId, sentAt } = req.body;
    const data: any = {};
    if (status !== undefined) data.status = status;
    if (lobId !== undefined) data.lobId = lobId;
    if (sentAt !== undefined) data.sentAt = new Date(sentAt);
    const letter = await prisma.letter.update({
        where: { id: parseInt(req.params.id) },
        data
    });
    res.json(letter);
});

// ── Root ──────────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
    res.send('Backend is running!');
});

if (process.env.NODE_ENV !== 'test') {
    app.listen(port, () => {
        console.log(`API running on http://localhost:${port}`);
    });
}
