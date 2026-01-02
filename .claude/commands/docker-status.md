---
description: Check Docker container status and health
---

Check the status of Docker containers for Aigentflow:

1. Run `docker compose ps` to list container status
2. Run `docker exec aigentflow-postgres pg_isready -U aigentflow -d aigentflow` to check database health
3. Run `docker exec aigentflow-postgres psql -U aigentflow -d aigentflow -c "\dt"` to list tables

If argument is "logs": Also show recent logs with `docker compose logs --tail=30`

Report the health status of all services.

Arguments provided: $ARGUMENTS
