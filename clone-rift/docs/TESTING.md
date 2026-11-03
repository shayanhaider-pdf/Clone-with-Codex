# Release verification

Run the automated checks from the game folder with Node.js 20 or newer.

```sh
node --check engine.js
node --check app.js
node --check serve.cjs
node --test
```

The 16 engine tests cover manual and automatic hunts, command cooldown, offline catch-up and rounding, purchase prices and capacity, sector gates, upgrade stacking, contract claims, Archive retention, and malformed or repeated save restores.

The active simulation uses the game's normal commands, reinvests in Sync, research, and squads, and claims contracts as they unlock. The first run reached Sync at 0:18, the Foundry at 0:40, and Archive at 17:26. The same strategy with one Echo reached its second Archive at 14:33. Results vary with purchase order and how often the player dispatches strikes.

## Browser verification for v1.0

Chrome smoke testing opened the game directly from disk. It exercised manual hunts and Sync from a fresh save, then used save fixtures for the eight-hour catch-up and Archive paths. It verified keyboard controls, dialog focus, export downloads, file and text imports, reset, corrupt-save recovery, and repeat reloads. Layout checks covered 320, 390, 620, 621, 850, and 851 pixels wide with reduced motion.

Import regression checks covered an oversized file selected after a valid backup was pasted and two competing file reads. The current selection controls the import and the confirmation remains unavailable during its read.

The local server was checked for startup and for GET, HEAD, asset types, missing files, and unsupported paths and methods at the request handler.

## Browser checklist

1. Open the game, use the keyboard to reach the first hunt, and launch it. Check that the payout arrives once and Launch Hunt becomes available again.
2. Compare recruit quotes, buy clones, and enable Sync. Check the balance, average idle rate, and repeat hunt progress.
3. Open a sector, buy a lab upgrade, and claim a contract. Confirm each updates immediately and survives reload.
4. Leave a synced game running, then return. Check that catch-up is credited once and the hunt progress carries forward.
5. Export a profile. Cancel a reset, try an invalid import, and import the export. Confirm only the successful import replaces progress.
6. With Archive available, cancel once and confirm once. Confirm the first sector and starting Credits are restored, with the Echoes and run number updated.
7. Repeat at a narrow viewport and with reduced motion. Check for horizontal overflow and confirm all controls are reachable.
