---
description: Database operations (push, reset, studio)
---

Perform database operations based on the argument:

If argument is "push":
  1. Run `pnpm build --filter=@aigentflow/database`
  2. Run `cd packages/database && npx cross-env DATABASE_URL=postgresql://aigentflow:aigentflow_dev_2026@localhost:5432/aigentflow npx drizzle-kit push --force`
  3. Apply RLS policies: `docker exec -i aigentflow-postgres psql -U aigentflow -d aigentflow < packages/database/src/rls/policies.sql`

If argument is "reset":
  1. Run `docker compose down -v` to remove all data
  2. Run `pnpm dev:db` to start fresh PostgreSQL
  3. Run the push steps above

If argument is "studio":
  Run `cd packages/database && npx drizzle-kit studio`

If argument is "status":
  Run `docker exec aigentflow-postgres psql -U aigentflow -d aigentflow -c "\dt"` to show tables

Arguments provided: $ARGUMENTS
