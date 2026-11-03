/* Clone Rift's economy and simulation. Shared by the browser and Node tests. */
(function (factory) {
  const engine = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = engine;
  } else {
    globalThis.CloneRift = engine;
  }
})(function () {
  "use strict";

  const SAVE_KEY = "clone-rift-v1";
  const VERSION = 1;
  const OFFLINE_CAP_SECONDS = 8 * 60 * 60;
  const COMMAND_COOLDOWN_SECONDS = 5;
  const ARCHIVE_THRESHOLD = 20_000_000;
  const CLONE_LIMIT = 200;
  const START_CREDITS = 25;
  const MAX_CREDITS = 1e30;
  const MAX_TIMESTAMP = 8.64e15;
  const MILESTONES = Object.freeze([5, 10, 25, 50, 100]);

  const SECTORS = [
    {
      id: "tunnel", name: "Hollow Tunnels", subtitle: "Low-threat sweep", rank: "E",
      duration: 6, reward: 18, recruitCost: 30, syncCost: 120, unlockAt: 0,
    },
    {
      id: "foundry", name: "Cinder Foundry", subtitle: "Heavy machinery zone", rank: "D",
      duration: 8, reward: 55, recruitCost: 180, syncCost: 550, unlockAt: 660,
    },
    {
      id: "district", name: "Glass District", subtitle: "Abandoned city blocks", rank: "C",
      duration: 12, reward: 160, recruitCost: 3_400, syncCost: 13_000, unlockAt: 26_000,
    },
    {
      id: "citadel", name: "Black Citadel", subtitle: "Fortified stronghold", rank: "B",
      duration: 16, reward: 540, recruitCost: 78_000, syncCost: 290_000, unlockAt: 720_000,
    },
    {
      id: "heart", name: "Rift Heart", subtitle: "Anomaly epicenter", rank: "A",
      duration: 24, reward: 1_600, recruitCost: 1_050_000, syncCost: 4_000_000, unlockAt: 10_000_000,
    },
  ].map(Object.freeze);
  Object.freeze(SECTORS);

  const RECRUIT_PRICES = SECTORS.map(({ recruitCost }) => {
    const prices = [0];
    let numerator = BigInt(recruitCost);
    let denominator = 1n;
    for (let owned = 1; owned < CLONE_LIMIT; owned++) {
      // Grow by exactly 30% so round-up does not overcharge integral prices.
      prices.push(Number((numerator + denominator - 1n) / denominator));
      numerator *= 13n;
      denominator *= 10n;
    }
    return prices;
  });

  const UPGRADES = [
    { id: "optics", name: "Predator Optics", description: "+50% hunt rewards", cost: 850 },
    { id: "kinetics", name: "Kinetic Weave", description: "Hunts finish 20% sooner", cost: 8_500 },
    { id: "resonance", name: "Rift Resonance", description: "Double hunt rewards", cost: 125_000 },
    { id: "overdrive", name: "Neural Overdrive", description: "Double hunt rewards again", cost: 1_000_000 },
  ].map(Object.freeze);
  Object.freeze(UPGRADES);

  const CONTRACTS = [
    { id: "establish", name: "Establish the Link", description: "Sync a hunt sector.", reward: 60 },
    { id: "formation", name: "Full Formation", description: "Field 15 clones across your sectors.", reward: 350 },
    { id: "breach", name: "Third Breach", description: "Unlock three hunt sectors.", reward: 7_500 },
    { id: "dominion", name: "Rift Dominion", description: "Sync all five hunt sectors.", reward: 600_000 },
  ].map(Object.freeze);
  Object.freeze(CONTRACTS);

  function createState(now = Date.now()) {
    return {
      version: VERSION,
      credits: START_CREDITS,
      runEarned: 0,
      lifetimeEarned: 0,
      echoes: 0,
      archives: 0,
      commandReadyAt: now,
      updatedAt: now,
      sectors: SECTORS.map((_, index) => ({
        unlocked: index === 0, clones: index === 0 ? 1 : 0,
        synced: false, running: false, progress: 0,
      })),
      upgrades: {},
      claimed: {},
    };
  }

  function addCredits(state, amount) {
    const earned = Math.min(amount, MAX_CREDITS - state.credits);
    state.credits += earned;
    state.runEarned = Math.min(MAX_CREDITS, state.runEarned + earned);
    state.lifetimeEarned = Math.min(MAX_CREDITS, state.lifetimeEarned + earned);
    return earned;
  }

  function sectorStats(state, index) {
    const sector = state.sectors[index];
    const data = SECTORS[index];
    if (!sector || !data) return { duration: 0, reward: 0, rate: 0, multiplier: 1 };
    const milestoneCount = MILESTONES.filter((milestone) => sector.clones >= milestone).length;
    const multiplier = 2 ** milestoneCount;
    const labMultiplier = (state.upgrades.optics ? 1.5 : 1)
      * (state.upgrades.resonance ? 2 : 1)
      * (state.upgrades.overdrive ? 2 : 1);
    const duration = data.duration * (state.upgrades.kinetics ? 0.8 : 1);
    const baseReward = data.reward * sector.clones * multiplier * labMultiplier;
    const reward = Math.floor(baseReward + baseReward * state.echoes / 5);
    return { duration, reward, rate: reward / duration, multiplier };
  }

  function echoMultiplier(state) {
    return 1 + state.echoes * 0.2;
  }

  function incomeRate(state) {
    return state.sectors.reduce((rate, sector, index) => {
      return sector.synced ? rate + sectorStats(state, index).rate : rate;
    }, 0);
  }

  function advance(state, now = Date.now()) {
    const completions = SECTORS.map(() => 0);
    if (!Number.isFinite(now) || now <= state.updatedAt) {
      return { earned: 0, seconds: 0, completions };
    }
    const seconds = Math.min((now - state.updatedAt) / 1_000, OFFLINE_CAP_SECONDS);
    state.updatedAt = now;
    let payout = 0;
    state.sectors.forEach((sector, index) => {
      if (!sector.running) return;
      const { duration, reward } = sectorStats(state, index);
      const elapsed = sector.progress + seconds;
      // Fractional cycle durations can fall just below an exact boundary in binary.
      const cycles = Math.floor((elapsed + 1e-9) / duration);
      if (sector.synced) {
        completions[index] = cycles;
        sector.progress = Math.max(0, elapsed - cycles * duration);
      } else if (cycles > 0) {
        completions[index] = 1;
        sector.running = false;
        sector.progress = 0;
      } else {
        sector.progress = elapsed;
      }
      payout += completions[index] * reward;
    });
    return { earned: addCredits(state, payout), seconds, completions };
  }

  function launch(state, index) {
    const sector = state.sectors[index];
    if (!sector?.unlocked || sector.running) return false;
    sector.running = true;
    return true;
  }

  function sync(state, index) {
    const sector = state.sectors[index];
    const data = SECTORS[index];
    if (!sector?.unlocked || sector.synced || state.credits < data.syncCost) return false;
    state.credits -= data.syncCost;
    sector.synced = true;
    sector.running = true;
    return true;
  }

  function unlock(state, index) {
    const sector = state.sectors[index];
    if (!sector || sector.unlocked || !state.sectors[index - 1]?.unlocked) return false;
    if (state.runEarned < SECTORS[index].unlockAt) return false;
    sector.unlocked = true;
    sector.clones = 1;
    return true;
  }

  function commandReward(state) {
    return Math.floor(12 * echoMultiplier(state) + 2 * incomeRate(state));
  }

  function command(state, now = Date.now()) {
    if (!Number.isFinite(now) || now < state.commandReadyAt) return 0;
    state.commandReadyAt = now + COMMAND_COOLDOWN_SECONDS * 1_000;
    return addCredits(state, commandReward(state));
  }

  function quoteRecruit(state, index, quantity = 1) {
    const sector = state.sectors[index];
    if (!sector?.unlocked || ![1, 10, "max"].includes(quantity)) return { count: 0, cost: 0 };
    const remaining = CLONE_LIMIT - sector.clones;
    const limit = quantity === "max" ? remaining : Math.min(remaining, quantity);
    let count = 0;
    let cost = 0;
    while (count < limit) {
      const price = RECRUIT_PRICES[index][sector.clones + count];
      if (quantity === "max" && cost + price > state.credits) break;
      cost += price;
      count += 1;
    }
    return { count, cost };
  }

  function recruit(state, index, quantity = 1) {
    const { count, cost } = quoteRecruit(state, index, quantity);
    if (count === 0 || cost > state.credits) return 0;
    state.credits -= cost;
    state.sectors[index].clones += count;
    return count;
  }

  function buyUpgrade(state, id) {
    const upgrade = UPGRADES.find((item) => item.id === id);
    if (!upgrade || state.upgrades[id] || state.credits < upgrade.cost) return false;
    state.credits -= upgrade.cost;
    state.upgrades[id] = true;
    if (id === "kinetics") {
      for (const sector of state.sectors) sector.progress *= 0.8;
    }
    return true;
  }

  function contractProgress(state, id) {
    switch (id) {
      case "establish":
        return { current: state.sectors.filter((sector) => sector.synced).length, target: 1 };
      case "formation":
        return { current: state.sectors.reduce((total, sector) => total + sector.clones, 0), target: 15 };
      case "breach":
        return { current: state.sectors.filter((sector) => sector.unlocked).length, target: 3 };
      case "dominion":
        return { current: state.sectors.filter((sector) => sector.synced).length, target: 5 };
      default:
        return { current: 0, target: Infinity };
    }
  }

  function claim(state, id) {
    const contract = CONTRACTS.find((item) => item.id === id);
    if (!contract || state.claimed[id]) return false;
    const { current, target } = contractProgress(state, id);
    if (current < target) return false;
    state.claimed[id] = true;
    addCredits(state, contract.reward);
    return true;
  }

  function archiveReward(state) {
    return Math.min(
      Math.floor(Math.sqrt(state.runEarned / ARCHIVE_THRESHOLD)),
      Number.MAX_SAFE_INTEGER - state.echoes,
    );
  }

  function archive(state, now = Date.now()) {
    const reward = archiveReward(state);
    if (reward < 1 || !Number.isFinite(now)) return false;
    const fresh = createState(now);
    fresh.lifetimeEarned = state.lifetimeEarned;
    fresh.echoes = state.echoes + reward;
    fresh.archives = Math.min(Number.MAX_SAFE_INTEGER, state.archives + 1);
    Object.assign(state, fresh);
    return true;
  }

  function encodeSave(state) {
    return JSON.stringify(state);
  }

  function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function readNumber(value, name, min, max, integer = false) {
    if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      throw new Error(`Invalid save value for ${name}.`);
    }
    return value;
  }

  function readFlags(value, catalog, name) {
    if (!isRecord(value)) throw new Error(`Invalid save value for ${name}.`);
    const flags = {};
    for (const { id } of catalog) {
      if (!Object.hasOwn(value, id)) continue;
      if (typeof value[id] !== "boolean") throw new Error(`Invalid save flag for ${id}.`);
      if (value[id]) flags[id] = true;
    }
    return flags;
  }

  function decodeSave(text, now = Date.now()) {
    if (typeof text !== "string" || text.length > 16_384) {
      throw new Error("Save data must be a Clone Rift JSON export.");
    }
    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new Error("Save data is not valid JSON.");
    }
    if (!isRecord(raw) || raw.version !== VERSION) throw new Error("Unsupported save version.");
    if (!Array.isArray(raw.sectors) || raw.sectors.length !== SECTORS.length) {
      throw new Error("Invalid save sectors.");
    }
    const state = createState(now);
    state.credits = readNumber(raw.credits, "credits", 0, MAX_CREDITS);
    state.runEarned = readNumber(raw.runEarned, "run earnings", 0, MAX_CREDITS);
    state.lifetimeEarned = readNumber(raw.lifetimeEarned, "lifetime earnings", state.runEarned, MAX_CREDITS);
    state.echoes = readNumber(raw.echoes, "echoes", 0, Number.MAX_SAFE_INTEGER, true);
    state.archives = readNumber(raw.archives, "archives", 0, state.echoes, true);
    state.upgrades = readFlags(raw.upgrades, UPGRADES, "lab upgrades");
    state.claimed = readFlags(raw.claimed, CONTRACTS, "contracts");
    const updatedAt = readNumber(raw.updatedAt, "last update time", 0, MAX_TIMESTAMP);
    const readyAt = readNumber(raw.commandReadyAt, "command time", 0, MAX_TIMESTAMP);
    state.updatedAt = Math.min(now, updatedAt);
    const remaining = Math.min(COMMAND_COOLDOWN_SECONDS * 1_000, Math.max(0, readyAt - updatedAt));
    state.commandReadyAt = updatedAt > now ? now + remaining : Math.min(readyAt, updatedAt + remaining);

    state.sectors = raw.sectors.map((sector, index) => {
      const flags = ["unlocked", "synced", "running"];
      if (!isRecord(sector) || flags.some((flag) => typeof sector[flag] !== "boolean")) {
        throw new Error("Invalid save sector flags.");
      }
      const { unlocked, synced, running } = sector;
      if ((!unlocked && (synced || running)) || (synced && !running)
          || (index === 0 && !unlocked) || (index > 0 && unlocked && !raw.sectors[index - 1].unlocked)) {
        throw new Error("Inconsistent save sector flags.");
      }
      const clones = readNumber(sector.clones, "clone count", unlocked ? 1 : 0, unlocked ? CLONE_LIMIT : 0, true);
      const duration = sectorStats(state, index).duration;
      const progress = readNumber(sector.progress, "hunt progress", 0, running ? duration : 0);
      if (progress >= duration) throw new Error("Hunt progress exceeds one cycle.");
      return { unlocked, clones, synced, running, progress };
    });
    return state;
  }

  return Object.freeze({
    SECTORS, UPGRADES, CONTRACTS, OFFLINE_CAP_SECONDS, ARCHIVE_THRESHOLD,
    COMMAND_COOLDOWN_SECONDS, SAVE_KEY, CLONE_LIMIT, MILESTONES,
    createState, advance, command, commandReward, launch, sync, unlock, buyUpgrade, claim, archive,
    recruit, quoteRecruit, sectorStats, incomeRate, contractProgress, archiveReward, echoMultiplier,
    encodeSave, decodeSave,
  });
});
