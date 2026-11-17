# Folio

Multi-user read-later app and Chrome Manifest V3 extension. Hosted using Sites with per-user D1 storage and ChatGPT sign-in.

## Extension
Download /folio-extension.zip in the app, unzip, and load the folder through chrome://extensions in Developer mode. The toolbar button opens an authenticated same-origin capture window. No bearer secrets are shipped to the client.

## Scope
URL/title saving, deduplication, search, archive/restore, delete, mobile-responsive home-screen app. Includes device-local offline text reading.

## Offline text reading

New and existing links automatically queue for offline text download while Folio is open online on each device. Explicitly removed copies are excluded from automatic backfill; manual retry remains available. The authenticated server verifies link ownership, retrieves public HTML with bounded size/time/redirects, and extracts inert text blocks. IndexedDB stores the copy on the downloading device; no article bodies are added to the hosted database. A service worker caches only the generic standalone reader and its assets. Failed root navigations fall back to the reader. Private API/login responses are not cached. The reader has no external assets and renders text with textContent. Downloads remain readable locally without network authentication, as intended for offline use; remove copies from a shared browser. Clearing browser storage removes downloads. Account IDs partition copies.

Images, video, JavaScript-only articles and authenticated/paywalled content are not supported. Extraction is best effort and may include or omit text on unusual layouts.

## Source and development

This repository contains the Folio web app, Chrome extension, database schema and tests. It does not contain saved links, downloaded articles, credentials, or the production database.

Use Node.js 22.13+ and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm build
node --experimental-strip-types --test tests/*.test.mjs
```

The app targets the Cloudflare Workers runtime via Vinext and uses a D1 binding named `DB`. Apply the SQL migrations in `drizzle/` to a local database before testing saved links. Sites supplies authenticated identity headers; local preview alone does not simulate ChatGPT sign-in. Do not trust client-supplied identity headers when hosting independently: provide a trusted authentication layer first.

The `.openai/hosting.json` template deliberately excludes the original deployment identity. Register a new Site before publishing a separate instance. The Chrome extension in `extension/background.js` currently targets the original Folio deployment; change `FOLIO` to your own origin when using a separate instance and regenerate `public/folio-extension.zip`.

The hosted app accepts visitors via ChatGPT sign-in. Reading lists and downloads are private per account; shared article metadata appears only after explicit consent.

## Regression coverage

The 29-test suite covers extraction, safe URL handling, device storage, automatic download queues, offline reader redirects and installation failures. A Miniflare/workerd test exercises real Cloudflare Request construction to catch unsupported fetch options that Node mocks can miss.

## Multi-user MVP

Visitors sign in with ChatGPT. Reading lists, archives and downloads are owner-scoped. Saves start private; existing links are not published by migration. Share to Trending is an explicit action with a confirmation. Removing a share or deleting its link retracts that contribution.

Trending ranks opted-in articles by distinct contributors in the last seven days, breaking ties by recency. It exposes only title, normalized public URL, aggregate count and latest contribution timestamp. Saving an article from Trending creates a private bookmark. Known tracking parameters are stripped; obvious private/token links and non-public DNS destinations are rejected. Users must still share only URLs intended for everyone. Limits: 1,000 saved links per account and 20 currently active contributions made within 24 hours.

Migrations add the shared article catalogue and contributions without altering existing bookmarks. Sites applies them at deployment. On another host, protect the identity headers with trusted authentication; never accept user-provided identity headers directly.

Run `node --experimental-strip-types --test tests/*.test.mjs` and `node node_modules/typescript/bin/tsc --noEmit`. The multiplayer tests run the API service against Miniflare/workerd and real D1, including owner isolation, explicit consent, ranking, duplicate suppression, retraction and contribution limits. Sign-in still needs end-to-end verification with real visitor accounts.
