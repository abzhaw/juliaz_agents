import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Tasks API Integration Tests', () => {
    beforeAll(async () => {
        // Clear tasks before testing
        await prisma.task.deleteMany();
    });

    it('should return empty array on GET /tasks', async () => {
        const res = await request(app).get('/tasks');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('should create a task on POST /tasks', async () => {
        const res = await request(app)
            .post('/tasks')
            .send({ title: 'New Task' });

        expect(res.status).toBe(201);
        expect(res.body.title).toBe('New Task');
        expect(res.body.completed).toBe(false);
        expect(res.body.id).toBeTypeOf('number');
    });

    it('should update a task on PATCH /tasks/:id', async () => {
        const createRes = await request(app)
            .post('/tasks')
            .send({ title: 'Task to Update' });

        const taskId = createRes.body.id;
        const res = await request(app)
            .patch(`/tasks/${taskId}`)
            .send({ completed: true });

        expect(res.status).toBe(200);
        expect(res.body.completed).toBe(true);
    });

    it('should delete a task on DELETE /tasks/:id', async () => {
        const createRes = await request(app)
            .post('/tasks')
            .send({ title: 'Task to Delete' });

        const taskId = createRes.body.id;
        const res = await request(app).delete(`/tasks/${taskId}`);

        expect(res.status).toBe(204);

        const checkRes = await request(app).get('/tasks');
        expect(checkRes.body.some((t: any) => t.id === taskId)).toBe(false);
    });
});
