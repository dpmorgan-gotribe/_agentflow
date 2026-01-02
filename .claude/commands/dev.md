---
description: Start development server (use: /dev, /dev db, /dev full)
---

Start the Aigentflow development environment based on the argument provided:

If no argument or "default": Run `pnpm dev` to start in-memory mode (fast, no database)
If argument is "db": Run `pnpm dev:db` to start only PostgreSQL container
If argument is "full": Run `pnpm dev:full` to start PostgreSQL + API + Web (full stack)
If argument is "all": Run `pnpm dev:all` to start all packages

After starting, tell me:
- What mode was started
- What URLs are available (API: localhost:3000, Web: localhost:5173)
- Any errors that occurred

Arguments provided: $ARGUMENTS
