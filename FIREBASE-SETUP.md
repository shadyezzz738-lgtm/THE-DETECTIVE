# Firebase online rooms setup

This branch adds the online room UI and Realtime Database synchronization hooks to THE DETECTIVE. Offline play continues to use the existing localStorage save system.

## One-time Firebase setup

1. In Firebase Console, open your project and add a Web App.
2. Enable **Authentication → Sign-in method → Anonymous**.
3. Create **Realtime Database**.
4. Copy the Web App config into `firebase-config.js`.
5. In Realtime Database → Rules, paste the contents of `database.rules.json` and publish.
6. Add your GitHub Pages URL under Authentication → Settings → Authorized domains if it is not already present.

## Deploy

Merge this branch into `main` (or set GitHub Pages to publish this branch). Firebase Hosting / Firebase CLI are not needed; GitHub Pages remains the website host.

## Multiplayer behavior

- Host creates a six-character room code; friends join with that code.
- Up to 10 members are tracked, with online/offline presence.
- Host starts the selected case.
- Evidence collection, links, confrontations and phone decisions are synchronized through the shared game state.
- Notes remain local to each player's device.

## Important

The Firebase config values are project-specific and must be filled in by the project owner. Do not put service-account credentials or private keys in browser code. The included starter database rules restrict room access to authenticated room members; review and tighten them before a public launch. These starter rules allow members to update the room record, so they are suitable only as an initial private test, not a hardened competitive environment.
