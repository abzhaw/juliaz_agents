import express from 'express';
import { PrismaClient } from '@prisma/client';
export const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3000;
app.use(express.json());
app.get('/health', async (req, res) => {
    try {
        await prisma.$queryRaw `SELECT 1`;
        res.json({ status: 'OK', database: 'Connected' });
    }
    catch (error) {
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
app.get('/', (req, res) => {
    res.send('Backend is running!');
});
if (process.env.NODE_ENV !== 'test') {
    app.listen(port, () => {
        console.log(`API running on http://localhost:${port}`);
    });
}
//# sourceMappingURL=index.js.map