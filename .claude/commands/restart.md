---
description: Restart development environment
---

Restart the Aigentflow development environment:

1. Run `docker compose down` to stop containers
2. Run `pnpm dev:full` to start everything back up

If argument is "db": Only restart PostgreSQL with `docker compose restart postgres`
If argument is "clean": Do a clean restart - run `docker compose down -v`, then `pnpm dev:db`, then `pnpm db:push`, then start the app

After restarting, verify services are running and report status.

Arguments provided: $ARGUMENTS
