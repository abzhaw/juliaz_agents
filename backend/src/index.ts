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
    const tasks = await prisma.task.findMany();
    res.json(tasks);
});

app.get('/', (req, res) => {
    res.send('Backend is running!');
});

if (process.env.NODE_ENV !== 'test') {
    app.listen(port, () => {
        console.log(`API running on http://localhost:${port}`);
    });
}
