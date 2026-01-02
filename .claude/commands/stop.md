---
description: Stop development services (Docker containers and dev servers)
---

Stop the Aigentflow development environment:

1. Run `docker compose down` to stop all Docker containers
2. Check if any node processes are still running with `tasklist | findstr node` (Windows) or `ps aux | grep node` (Unix)
3. Tell me what was stopped and if anything is still running

If argument is "docker": Only stop Docker containers
If argument is "clean": Run `docker compose down -v` to also remove volumes (WARNING: deletes database data)

Arguments provided: $ARGUMENTS
