# GoodCall on Vercel

Public demo: https://goodcall-sigma.vercel.app

Follower view: https://goodcall-sigma.vercel.app/#/discover

## What is hosted

Vercel serves the built React application and the fictional case-file PDF. The canvas, evidence checks, local answer templates, chat, follower discovery and saved advice run in the browser. Each browser has its own workspace, published collection and feedback. A fresh browser starts with no published answers. An explicitly shared advice snapshot can open on another device, but workspaces and feedback do not synchronise.

The public build does not run the local AI middleware or accept API keys. Live Claude/OpenAI remains a local-app option. Tano and social accounts are not connected. Browser speech controls remain available where supported; successful microphone capture, transcription and speaker output were not verified as part of deployment.

## Build and publication

The `goodcall` Vercel project is linked to `MasteraSnackin/GoodCall`. Production builds use `vercel.json`: Vite, `npm ci`, `VITE_STATIC_DEMO=true npm run build`, output `dist`. Vercel uses its supported Node 24 runtime; the local checkout retains its existing Node 26 development baseline.

The public build flag prevents AI requests before any network call and replaces the API-key form with a hosted-demo explanation. It is a user-interface and client safeguard; no public AI server endpoint is deployed. Do not expose the local process-wide credential middleware as a shared serverless function.

The `.vercelignore` file excludes credentials, local Vercel state, development dependencies, tests and presentation/media sources from command-line uploads. No provider keys or local browser data were transferred. Git-triggered deployments build the tracked repository; environment files remain ignored by Git.

To redeploy from a clean checkout with Vercel access:

```sh
npx vercel link --yes --project goodcall --scope mythicmindlabs
npx vercel deploy --prod --yes --scope mythicmindlabs
```

No path rewrite is required: follower and advice routes use URL hashes. The stable production URL is public; Vercel preview URLs may have separate access settings.

## Verification on 20 September 2026

- All 536 automated tests passed: 296 Node tests and 240 browser-component tests.
- The hosted production build passed locally and on Vercel.
- Unauthenticated requests returned HTTP 200 for the public homepage and case-file PDF. `/api/ai/status` returned 404, as expected for this static deployment.
- Chrome loaded the creator canvas and the hosted AI explanation, with no credential fields.
- Drafting the Barrier Cream question produced a clarification and kept approval disabled because evidence was missing.
- Template-based chat answered the Cloud Cream question with the recorded £38 price and supporting evidence.
- The follower discovery page opened directly and survived a browser refresh. Its empty published collection correctly reflected that browser’s new workspace.

The media files are separate from the hosted application. Pending video revisions do not alter the application deployment.
