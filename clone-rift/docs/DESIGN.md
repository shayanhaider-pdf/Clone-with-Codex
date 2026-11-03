# Game design

Rifts opened beneath the city. A hunter can duplicate themself and send those copies to clear the breach sites. The hunter network remembers the strongest timelines as Echoes, which make future squads more effective.

## Hunt loop

A new run starts with 25 Credits and one clone in the Hollow Tunnels. A manual hunt pays once when its timer finishes. Sync is a one-time purchase per sector per run. It repeats hunts indefinitely and preserves any progress from a hunt already under way. An unlocked sector gets its first clone free. Unlocks are sequential and count all Credits earned this run, even after spending them.

| Rank and sector | Earned to unlock | Hunt time | Base payout | First recruit | Sync |
| --- | ---: | ---: | ---: | ---: | ---: |
| E · Hollow Tunnels | 0 | 6s | 18 | 30 | 120 |
| D · Cinder Foundry | 660 | 8s | 55 | 180 | 550 |
| C · Glass District | 26,000 | 12s | 160 | 3,400 | 13,000 |
| B · Black Citadel | 720,000 | 16s | 540 | 78,000 | 290,000 |
| A · Rift Heart | 10,000,000 | 24s | 1,600 | 1,050,000 | 4,000,000 |

Each additional clone adds the sector's base payout. Squad payouts double at 5, 10, 25, 50, and 100 clones, with a limit of 200 clones per sector. Recruit prices rise by 30% per clone and round up. ×10 quotes a bundle up to the remaining squad capacity. Max spends up to the available balance.

The Dispatch Strike action pays the whole-number part of 12 times the Echo multiplier plus two seconds of synced income. It recharges in five seconds. Idle income is the expected average per second. The balance receives Credits when a hunt finishes.

## Research and contracts

| Research | Cost | Effect |
| --- | ---: | --- |
| Predator Optics | 850 | ×1.5 hunt payout |
| Kinetic Weave | 8,500 | ×0.8 hunt duration |
| Rift Resonance | 125,000 | ×2 hunt payout |
| Neural Overdrive | 1,000,000 | ×2 hunt payout |

Research stacks across sectors and applies to future payouts, including the current hunt when it finishes. Kinetic Weave preserves the fraction of a hunt already complete.

| Contract | Target | Payout |
| --- | --- | ---: |
| Establish the Link | Sync one sector | 60 |
| Full Formation | Field 15 clones in total | 350 |
| Third Breach | Open three sectors | 7,500 |
| Rift Dominion | Sync all five sectors | 600,000 |

Contracts must be claimed. Each can pay once per run and contributes to run earnings.

## Archive

Archive unlocks at 20 million run Credits. Echoes awarded are the rounded-down square root of run Credits divided by 20 million. One Echo is available at 20 million and two at 80 million. Each adds 20 percentage points to the permanent hunt payout bonus. The Strike's base payout uses the same Echo multiplier.

Archiving restores starting Credits and squads and resets sector unlocks, Sync, research, and contract claims. Echoes, archive count, and lifetime earnings carry forward.

## Implementation

- `engine.js` is the single source of truth for balance constants and state transitions. It runs in the browser and under Node.
- `app.js` renders the stations, handles controls, and coordinates autosaves. It advances the simulation before each player action.
- `index.html`, `style.css`, and the SVGs provide a responsive UI and original vector art. The game uses the browser's reduced motion preference.
- `serve.cjs` serves the game's six static files on loopback for local play.

The simulation uses timestamps. On return, it processes whole hunt cycles in one calculation and carries forward the remainder. Catch-up covers at most eight hours in one elapsed interval. Synced squads can complete multiple hunts during that window. A previously launched manual hunt can finish once.

Saves are versioned JSON stored locally. Import checks fields and basic state consistency before replacement. The game displays a storage warning if the browser blocks autosave. Back up progress before clearing browser data or switching launch URLs.
