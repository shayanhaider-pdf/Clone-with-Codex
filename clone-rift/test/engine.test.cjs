const test = require("node:test");
const assert = require("node:assert/strict");
const game = require("../engine.js");

function grant(state, credits) {
  state.credits += credits;
  state.runEarned += credits;
  state.lifetimeEarned += credits;
}

test("a fresh run starts with one idle clone and four locked sectors", () => {
  const state = game.createState(0);
  assert.equal(state.credits, 25);
  assert.equal(state.runEarned, 0);
  assert.equal(game.incomeRate(state), 0);
  assert.deepEqual(state.sectors.map((sector) => sector.clones), [1, 0, 0, 0, 0]);
  assert.deepEqual(state.sectors.map((sector) => sector.unlocked), [true, false, false, false, false]);
  assert.equal(game.launch(state, 1), false);
  assert.equal(game.sync(state, 0), false);
  assert.equal(game.claim(state, "establish"), false);
});

test("a manual hunt pays exactly once after a full cycle", () => {
  const state = game.createState(0);
  assert.equal(game.launch(state, 0), true);
  assert.equal(game.launch(state, 0), false);
  assert.equal(game.advance(state, 5_999).earned, 0);
  assert.equal(state.sectors[0].running, true);
  assert.equal(game.advance(state, 6_000).earned, 18);
  assert.equal(state.sectors[0].running, false);
  assert.equal(game.advance(state, 90_000).earned, 0);
  assert.equal(state.credits, 43);
});

test("Command Dispatch has a cooldown and rewards grow with synced income", () => {
  const state = game.createState(0);
  assert.equal(game.command(state, 0), 12);
  assert.equal(game.command(state, 4_999), 0);
  assert.equal(game.command(state, 5_000), 12);
  grant(state, 200);
  assert.equal(game.sync(state, 0), true);
  assert.equal(game.sync(state, 0), false);
  assert.equal(game.commandReward(state), 18);
  assert.equal(game.command(state, 10_000), 18);
});

test("sync keeps an in-flight cycle and completes later cycles automatically", () => {
  const state = game.createState(0);
  grant(state, 120);
  game.launch(state, 0);
  game.advance(state, 3_000);
  assert.equal(game.sync(state, 0), true);
  assert.equal(state.sectors[0].progress, 3);
  assert.equal(game.advance(state, 18_000).earned, 54);
  assert.equal(state.sectors[0].progress, 0);
  assert.equal(game.incomeRate(state), 3);
});

test("time catch-up is capped, retains progress, and cannot repeat an interval", () => {
  const state = game.createState(0);
  grant(state, 1_000);
  game.unlock(state, 1);
  game.sync(state, 0);
  game.launch(state, 1);
  game.advance(state, 3_000);
  const returnTime = 9 * 60 * 60 * 1_000;
  const report = game.advance(state, returnTime);
  assert.equal(report.seconds, 8 * 60 * 60);
  assert.deepEqual(report.completions, [4_800, 1, 0, 0, 0]);
  assert.equal(report.earned, 4_800 * 18 + 55);
  assert.equal(state.sectors[0].progress, 3);
  assert.equal(game.advance(state, returnTime - 5_000).earned, 0);
  assert.equal(game.advance(state, returnTime).earned, 0);
  assert.equal(game.advance(state, returnTime + 3_000).earned, 18);
});

test("foreground ticks and one background catch-up agree with fractional durations", () => {
  const foreground = game.createState(0);
  grant(foreground, 50_000);
  game.sync(foreground, 0);
  game.unlock(foreground, 1);
  game.sync(foreground, 1);
  game.buyUpgrade(foreground, "kinetics");
  const background = game.decodeSave(game.encodeSave(foreground), 0);

  for (let now = 125; now <= 96_875; now += 125) game.advance(foreground, now);
  game.advance(background, 96_875);
  assert.equal(background.credits, foreground.credits);
  assert.equal(background.runEarned, foreground.runEarned);
  foreground.sectors.forEach((sector, index) => {
    assert.ok(Math.abs(sector.progress - background.sectors[index].progress) < 1e-8);
  });
});

test("bulk recruit quotes agree with individual purchases and exact affordability", () => {
  const bulk = game.createState(0);
  const singles = game.createState(0);
  grant(bulk, 10_000);
  grant(singles, 10_000);
  assert.deepEqual(game.quoteRecruit(bulk, 0), { count: 1, cost: 30 });
  const quoted = game.quoteRecruit(bulk, 0, 10);
  assert.equal(quoted.count, 10);
  assert.equal(game.recruit(bulk, 0, 10), 10);
  for (let index = 0; index < 10; index++) assert.equal(game.recruit(singles, 0), 1);
  assert.deepEqual(bulk, singles);
  assert.equal(bulk.credits, 10_025 - quoted.cost);

  const limited = game.createState(0);
  grant(limited, 44);
  assert.equal(game.recruit(limited, 0, 10), 0);
  assert.deepEqual(game.quoteRecruit(limited, 0, "max"), { count: 2, cost: 69 });
  assert.equal(game.recruit(limited, 0, "max"), 2);
  assert.equal(limited.credits, 0);
  assert.equal(game.recruit(limited, 0, "max"), 0);
  assert.equal(game.recruit(limited, 1, "max"), 0);
});

test("max recruitment cannot pass the clone limit or produce infinite prices", () => {
  const state = game.createState(0);
  grant(state, 1e30);
  state.sectors.forEach((sector, index) => {
    if (index > 0) assert.equal(game.unlock(state, index), true);
    assert.equal(game.recruit(state, index, "max"), game.CLONE_LIMIT - 1);
    assert.equal(sector.clones, game.CLONE_LIMIT);
    assert.deepEqual(game.quoteRecruit(state, index, 10), { count: 0, cost: 0 });
  });
  assert.ok(Number.isFinite(state.credits));
});

test("recruit prices round up only when the scaled cost has a fractional part", () => {
  const state = game.createState(0);
  grant(state, 100_000);
  game.unlock(state, 1);
  game.unlock(state, 2);
  game.recruit(state, 2);
  game.recruit(state, 2);
  assert.deepEqual(game.quoteRecruit(state, 2), { count: 1, cost: 5_746 });
});

test("sector gates use earned credits and unlock in order without charging the balance", () => {
  const state = game.createState(0);
  grant(state, game.SECTORS[2].unlockAt);
  assert.equal(game.unlock(state, 2), false);
  game.recruit(state, 0, 10);
  const balance = state.credits;
  assert.equal(game.unlock(state, 1), true);
  assert.equal(game.unlock(state, 2), true);
  assert.equal(game.unlock(state, 3), false);
  assert.equal(game.unlock(state, 2), false);
  assert.equal(state.sectors[2].clones, 1);
  assert.equal(state.credits, balance);
});

test("clone milestones and research stack, with speed preserving completed progress", () => {
  const state = game.createState(0);
  grant(state, 30_000);
  game.launch(state, 0);
  game.advance(state, 3_000);
  for (let index = 0; index < 4; index++) game.recruit(state, 0);
  assert.equal(game.sectorStats(state, 0).reward, 180);
  assert.equal(game.sectorStats(state, 0).multiplier, 2);
  assert.equal(game.buyUpgrade(state, "optics"), true);
  assert.equal(game.buyUpgrade(state, "kinetics"), true);
  assert.equal(game.buyUpgrade(state, "kinetics"), false);
  assert.equal(game.buyUpgrade(state, "overdrive"), false);
  assert.ok(Math.abs(state.sectors[0].progress - 2.4) < 1e-9);
  assert.equal(game.advance(state, 5_399).earned, 0);
  assert.equal(game.advance(state, 5_400).earned, 270);
  assert.equal(game.sectorStats(state, 0).multiplier, 2);
});

test("contracts pay once only after reaching their target", () => {
  const state = game.createState(0);
  grant(state, 1_000);
  assert.deepEqual(game.contractProgress(state, "establish"), { current: 0, target: 1 });
  assert.equal(game.claim(state, "establish"), false);
  game.sync(state, 0);
  const balance = state.credits;
  const total = state.runEarned;
  assert.equal(game.claim(state, "establish"), true);
  assert.equal(game.claim(state, "establish"), false);
  assert.equal(state.credits, balance + 60);
  assert.equal(state.runEarned, total + 60);
});

test("Archive grants permanent Echoes and restarts the run", () => {
  const state = game.createState(0);
  grant(state, game.ARCHIVE_THRESHOLD - 1);
  assert.equal(game.archive(state, 100), false);
  grant(state, 1);
  game.sync(state, 0);
  game.unlock(state, 1);
  game.claim(state, "establish");
  game.buyUpgrade(state, "optics");
  const lifetime = state.lifetimeEarned;
  assert.equal(game.archiveReward(state), 1);
  assert.equal(game.archive(state, 100), true);
  assert.deepEqual(state, { ...game.createState(100), lifetimeEarned: lifetime, echoes: 1, archives: 1 });
  assert.equal(game.echoMultiplier(state), 1.2);
  assert.equal(game.sectorStats(state, 0).reward, 21);
  grant(state, game.ARCHIVE_THRESHOLD * 4);
  assert.equal(game.archiveReward(state), 2);
});

test("repeated save restores retain partial progress and preserve the cooldown", () => {
  const state = game.createState(10_000);
  grant(state, 150);
  game.sync(state, 0);
  game.command(state, 10_000);
  game.advance(state, 12_000);
  const encoded = game.encodeSave(state);
  const restored = game.decodeSave(encoded, 12_000);
  assert.deepEqual(restored, state);
  assert.equal(game.command(restored, 14_999), 0);
  assert.equal(game.advance(restored, 16_000).earned, 18);
  assert.equal(game.advance(restored, 16_000).earned, 0);
  assert.deepEqual(game.decodeSave(game.encodeSave(restored), 16_000), restored);

  const future = game.decodeSave(encoded, 1_000);
  assert.equal(future.updatedAt, 1_000);
  assert.equal(future.commandReadyAt, 4_000);
  assert.equal(game.advance(future, 5_000).earned, 18);
});

test("save import rejects malformed, foreign-version, and impossible state", () => {
  const fresh = game.createState(0);
  assert.throws(() => game.decodeSave("{bad JSON"), /not valid JSON/);
  assert.throws(() => game.decodeSave("null"), /Unsupported save version/);
  assert.throws(() => game.decodeSave(" ".repeat(16_385)), /JSON export/);
  assert.throws(() => game.decodeSave(game.encodeSave({ ...fresh, version: 999 })), /Unsupported save version/);
  assert.throws(() => game.decodeSave(game.encodeSave({ ...fresh, credits: -1 })), /credits/);
  assert.throws(() => game.decodeSave(game.encodeSave({ ...fresh, upgrades: { optics: "true" } })), /save flag/);
  assert.throws(() => game.decodeSave(game.encodeSave({ ...fresh, sectors: [] })), /save sectors/);
  fresh.sectors[0].running = true;
  fresh.sectors[0].progress = 6;
  assert.throws(() => game.decodeSave(game.encodeSave(fresh)), /one cycle/);
});

function simulateActiveRun(state) {
  const start = state.updatedAt;
  let firstSyncAt;
  let secondSectorAt;
  for (let second = 0; second <= 1_200; second++) {
    const now = start + second * 1_000;
    game.advance(state, now);
    game.command(state, now);
    state.sectors.forEach((_, index) => {
      if (game.unlock(state, index) && index === 1) secondSectorAt = second;
      if (game.sync(state, index) && index === 0) firstSyncAt = second;
      game.launch(state, index);
    });
    for (const { id } of game.CONTRACTS) game.claim(state, id);
    for (const { id } of game.UPGRADES) game.buyUpgrade(state, id);
    state.sectors.forEach((sector, index) => {
      const { cost } = game.quoteRecruit(state, index);
      if (sector.synced && sector.clones < 20 && (sector.clones < 5 || cost < state.credits / 3)) {
        game.recruit(state, index);
      }
    });
    if (game.archiveReward(state) > 0) {
      return { firstSyncAt, secondSectorAt, archiveAt: second };
    }
  }
  throw new Error("Expected to reach Archive within twenty simulated minutes.");
}

test("an active run unlocks and Syncs all sectors, then Echoes speed up a second run", () => {
  const state = game.createState(0);
  const { firstSyncAt, secondSectorAt, archiveAt } = simulateActiveRun(state);
  assert.equal(firstSyncAt, 18);
  assert.ok(secondSectorAt >= 30 && secondSectorAt <= 120);
  assert.ok(archiveAt >= 12 * 60 && archiveAt <= 20 * 60);
  assert.ok(state.sectors.every((sector) => sector.synced));
  assert.deepEqual(Object.keys(state.claimed).sort(), game.CONTRACTS.map(({ id }) => id).sort());
  assert.equal(game.archive(state, archiveAt * 1_000), true);
  assert.equal(state.echoes, 1);
  const secondRun = simulateActiveRun(state);
  assert.ok(secondRun.archiveAt < archiveAt);
  assert.equal(game.archive(state, state.updatedAt), true);
  assert.equal(state.echoes, 2);
  assert.equal(state.archives, 2);
});
