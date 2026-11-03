# Clone Rift

You can only be in one place. Your clones can be in five.

Clone Rift is a single-player idle hunting game. Send your first clone into the Hollow Tunnels, use the payout to recruit and automate squads, then archive the run for a permanent boost.

## Play

Open [index.html](index.html) in a current desktop browser. The game has no installs or external assets.

You can also use a local server from this folder with Node.js 20 or newer.

```sh
node serve.cjs
```

Open [Clone Rift on localhost](http://127.0.0.1:4173). The server is also useful when a browser restricts local-file storage. File and HTTP launches have separate saves, so export from one and import into the other to move your progress.

1. Use **Dispatch Strike** for an immediate payout and **Launch hunt** to send a squad out.
2. Buy **Sync** to repeat a sector's hunts automatically. A synced squad keeps working for up to eight hours while you're away.
3. Recruit clones, unlock higher-ranked sectors, and buy research in **Clone Lab**. Collect eligible payouts under **Contracts**.
4. Once the run has earned 20 million Credits, visit **Archive** to carry Echoes into a fresh run.

Progress autosaves in your browser. Use **Settings → Export save** for a portable backup and **Settings → Import save** to restore it. On a phone, serve the same files from a static web host and open the URL.

## Development

```sh
node --test
```

The test suite covers gameplay, save handling, and simulated first and second runs. The runtime has no package dependencies.

- [Plan and release criteria](docs/PLAN.md)
- [Game rules and implementation](docs/DESIGN.md)
- [Verification and browser checklist](docs/TESTING.md)
