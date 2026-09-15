# Quality gates

Before production release:

- `npm run check`
- `npm test`
- Docker build
- CORS preflight test from GitHub Pages origin
- Registration/login smoke test
- Authenticated memory CRUD smoke test
- Media upload validation test
- Export/delete test
- Browser E2E on desktop and mobile viewport
- Provider readiness verification
- Backup restore drill
