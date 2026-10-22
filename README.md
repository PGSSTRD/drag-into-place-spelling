"# Drag Into Place Spelling

Offline English spelling activity, implemented with React and TypeScript.

## Development

Use Node.js 24.20.0 LTS with npm 11.19.0.

```sh
npm ci
npm run dev
```

## Checks

```sh
npm run typecheck
npm run test:unit
npm run build
npm run validate:content
```

The included CAT picture is original project artwork. Production pronunciation
recordings, the shared correction cue and reader font have not been supplied;
`npm run validate:content` reports these missing assets and must pass before a
standalone release can be considered. Failed audio is nonfatal at runtime, but
the release media gate remains blocked until reviewed local media and license
records are provided.

This delivery implements the Foundation, MVP and Better static gameplay path.
Great moving mode, release ZIP/icon tooling, automated browser E2E, and physical
container/device verification remain outside this delivery. The engine uses a
development `sub_app_id`; the approved Curious Reader identifier and production
content are still required before release.
