# Tasks CRUD Design

**Date:** 2026-02-21
**Status:** Approved

## Goal
Implement a basic CRUD (Create, Read, Update, Delete) system for a "Tasks" resource to verify the persistence layer and build a foundation for future features.

## Architecture
**Approach:** Flat & Fast (Approach A)
**Data Flow:** `Request -> Express Router -> Prisma Client -> PostgreSQL`

## Data Model
```prisma
model Task {
  id        Int      @id @default(autoincrement())
  title     String
  completed Boolean  @default(false)
  createdAt DateTime @default(now())
}
```

## API Specification
- `GET /tasks`: Returns an array of all tasks.
- `POST /tasks`: Creates a task. Body: `{ "title": string }`.
- `PATCH /tasks/:id`: Updates a task. Body: `{ "title"?: string, "completed"?: boolean }`.
- `DELETE /tasks/:id`: Deletes a task by ID.

## Verification
- Manual verification using `curl`.
- Success Criteria: Data persists across container restarts.
