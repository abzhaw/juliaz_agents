# Tasks CRUD Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Create, Read, Update, and Delete endpoints for a "Task" resource to verify database persistence.

**Architecture:** Flat & Fast - Direct Prisma calls within Express routes in `src/index.ts`. Simple RESTful API design.

**Tech Stack:** Node.js v22, Express v4, Prisma v6, PostgreSQL v15.

---

### Task 1: Update Database Schema
**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Write the failing test**
N/A (Schema validation)

**Step 2: Run test to verify it fails**
Run: `npx prisma validate`
Expected: PASS (current schema is valid)

**Step 3: Write minimal implementation**
Add `Task` model to `prisma/schema.prisma`:
```prisma
model Task {
  id        Int      @id @default(autoincrement())
  title     String
  completed Boolean  @default(false)
  createdAt DateTime @default(now())
}
```

**Step 4: Run test to verify it passes**
Run: `npx prisma validate && npx prisma migrate dev --name add_task_model`
Expected: SUCCESS

**Step 5: Commit**
```bash
git add prisma/schema.prisma
git commit -m "feat: add Task model to schema"
```

### Task 2: Implement GET /tasks
**Files:**
- Modify: `src/index.ts`
- Create: `tests/integration/tasks.test.ts`

**Step 1: Write the failing test**
```typescript
it('should return empty array on GET /tasks', async () => {
  const res = await fetch('http://localhost:3000/tasks');
  const data = await res.json();
  expect(res.status).toBe(200);
  expect(data).toEqual([]);
});
```

**Step 2: Run test to verify it fails**
Run: `npm test`
Expected: FAIL (404 Not Found)

**Step 3: Write minimal implementation**
```typescript
app.get('/tasks', async (req, res) => {
    const tasks = await prisma.task.findMany();
    res.json(tasks);
});
```

**Step 4: Run test to verify it passes**
Run: `npm test`
Expected: PASS

**Step 5: Commit**
```bash
git add src/index.ts tests/integration/tasks.test.ts
git commit -m "feat: implement GET /tasks"
```

### Task 3: Implement POST /tasks
**Files:**
- Modify: `src/index.ts`

**Step 1: Write the failing test**
```typescript
it('should create a task on POST /tasks', async () => {
  const res = await fetch('http://localhost:3000/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'New Task' })
  });
  const data = await res.json();
  expect(res.status).toBe(201);
  expect(data.title).toBe('New Task');
});
```

**Step 2: Run test to verify it fails**
Run: `npm test`
Expected: FAIL (404)

**Step 3: Write minimal implementation**
```typescript
app.post('/tasks', async (req, res) => {
    const { title } = req.body;
    const task = await prisma.task.create({ data: { title } });
    res.status(201).json(task);
});
```

**Step 4: Run test to verify it passes**
Run: `npm test`
Expected: PASS

**Step 5: Commit**
```bash
git commit -am "feat: implement POST /tasks"
```

### Task 4: Implement PATCH and DELETE
**Files:**
- Modify: `src/index.ts`

**Step 1: Write failing tests**
Write tests for updating and deleting a task by ID.

**Step 2: Run tests to verify they fail**
Run: `npm test`
Expected: FAIL

**Step 3: Write minimal implementation**
Implement `app.patch('/tasks/:id')` and `app.delete('/tasks/:id')`.

**Step 4: Run tests to verify they pass**
Run: `npm test`
Expected: PASS

**Step 5: Commit**
```bash
git commit -am "feat: implement update and delete for tasks"
```
