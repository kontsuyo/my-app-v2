# Patina Gallery frontend

Next.js 15 App Router application. Node.js 20.19 or later is recommended.

## Local development

```bash
npm ci
npm run dev
```

The API client defaults to `/api/v1`. During development, Next.js proxies this
path to `http://localhost:8000`; set `API_PROXY_URL` to use a different backend.
For a deployment without the Next.js server, set `NEXT_PUBLIC_API_BASE_URL` to
the API origin and path at build time.

JWT access and refresh tokens are kept in browser memory only. They are cleared
when the page is reloaded or the tab is closed; browser storage is not used.

## Tests

```bash
npm test -- --run
npx playwright install chromium
npm run test:e2e
```

Vitest and React Testing Library cover component behavior. MSW provides API
responses to tests without contacting the backend. Playwright runs browser
smoke and user-flow tests against the local development server.
