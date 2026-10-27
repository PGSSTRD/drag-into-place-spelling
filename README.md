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

The learner-facing implementation is Great: target letters and foils move
left-to-right, can be stopped and dragged into the answer, and recycle until
placed or removed. Foils reveal position hints. Reduced-motion mode presents
the same puzzle with stationary tiles. Production media, release ZIP/icon
tooling, automated browser E2E, and physical container/device verification
remain outstanding. The engine uses a development `sub_app_id`; the approved
Curious Reader identifier and production content are still required before
release.
