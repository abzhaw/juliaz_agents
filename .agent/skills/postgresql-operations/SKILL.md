---
name: postgresql-operations
description: Postgres admin, backups, vacuum, monitoring, indexes. Use when managing Julia's backend Postgres database running in Docker.
---

# PostgreSQL Operations

## Connect to Dockerized Postgres
```bash
# Connect via docker exec
docker exec -it backend-db-1 psql -U postgres -d julia

# Or via psql with port mapping (5432)
psql postgresql://postgres:password@localhost:5432/julia
```

## Common psql Commands
```sql
\l                    -- list databases
\dt                   -- list tables
\d tasks              -- describe table structure
\x                    -- toggle expanded output
\timing               -- show query execution time

SELECT * FROM "Task" ORDER BY "createdAt" DESC LIMIT 10;
SELECT COUNT(*) FROM "Task" WHERE completed = false;
```

## Prisma Migrate (Julia's ORM)
```bash
cd backend
npx prisma migrate dev --name add_field   # create + apply migration
npx prisma migrate deploy                  # apply in production
npx prisma studio                          # visual DB browser
npx prisma db push                         # sync schema without migration
npx prisma generate                        # regenerate client after schema change
```

## Backup & Restore
```bash
# Backup (from Docker)
docker exec backend-db-1 pg_dump -U postgres julia > backup_$(date +%Y%m%d).sql

# Restore
docker exec -i backend-db-1 psql -U postgres julia < backup_20260223.sql
```

## Index for Common Queries
```sql
-- Add index on status field for task filtering
CREATE INDEX CONCURRENTLY idx_task_status ON "Task" (completed);
CREATE INDEX CONCURRENTLY idx_task_created ON "Task" ("createdAt" DESC);
```

## Health Check Query
```sql
SELECT pg_is_in_recovery(), pg_postmaster_start_time(), count(*) FROM pg_stat_activity;
```
