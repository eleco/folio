# Folio

Private read-later app and Chrome Manifest V3 extension. Hosted using Sites with per-user D1 storage and ChatGPT sign-in.

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

The current hosted app remains privately accessible. Making this source repository public does not grant access to its users or database.

## Regression coverage

The 21-test suite covers extraction, safe URL handling, device storage, automatic download queues, offline reader redirects and installation failures. A Miniflare/workerd test exercises real Cloudflare Request construction to catch unsupported fetch options that Node mocks can miss.
