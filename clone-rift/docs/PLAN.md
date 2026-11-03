# Clone Rift v1 plan

Build an original, playable idle game about a hunter who sends copies of themself into unstable rifts. The player starts by dispatching a single clone, then trades hunt proceeds for bigger squads, automated hunts, and permanent bonuses across runs.

## Design targets

- Give the player an immediate action and show exactly what each purchase changes.
- Open automation during the first minute of active play and the second sector during the first few minutes.
- Make the first Archive reachable in a short session with active reinvestment. Support slower progress from offline hunts.
- Give players a choice between expanding to a higher-paying sector, investing in existing squads, and buying research that affects every sector.
- Run in desktop and mobile browsers from local files or a static HTTP server. Keep the game self-contained.

## Build order

1. Define hunt timing, costs, progression gates, contracts, and the Archive loop in a data-driven engine.
2. Build the command deck, hunt controls, lab, contracts, Archive, and save tools around the engine.
3. Exercise the first-run curve and a second run with deterministic simulations. Test save validation, elapsed time, and purchase boundaries.
4. Play through the browser controls at desktop and mobile sizes. Fix usability, progression, and save issues found in testing.
5. Document the rules, launch options, and verified release checks. Publish the checked source to a dedicated GitHub location.

## Release gate

- A fresh player can launch a hunt, earn Credits, recruit, and automate the starter sector.
- All five sectors, lab research, contracts, and Archive are accessible through normal play.
- Sync earns while away up to the eight-hour cap. Reloads and imports preserve valid state and do not duplicate catch-up rewards.
- Progress and controls are legible on mobile, actionable by keyboard, and usable with reduced motion.
- The repository includes launch instructions, design documentation, and reproducible tests.

## References

- Production growth, research, and prestige from [Egg, Inc.](https://apps.apple.com/us/app/egg-inc/id993492744)
- Automation and reinvestment from [AdVenture Capitalist](https://hyperhippo.com/games/adventure-capitalist/)
- Clone-powered hunting premise from [Auto Hunting With My Clones](https://www.webtoons.com/en/action/auto-hunting-with-my-clones/list?title_no=5034)
