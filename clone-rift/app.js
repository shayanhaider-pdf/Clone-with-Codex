(function () {
  "use strict";

  const game = globalThis.CloneRift;
  const $ = (id) => document.getElementById(id);
  const exact = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
  const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 });
  const fullNumber = (value) => exact.format(value);
  const number = (value) => {
    if (value < 10_000) return fullNumber(value);
    if (value >= 1e15) return value.toExponential(2);
    return compact.format(value);
  };
  const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const stations = Array.from(document.querySelectorAll("[data-view]"));
  const quantityButtons = Array.from(document.querySelectorAll("[data-quantity]"));
  const hero = document.querySelector(".hero");
  const dialog = $("confirmation");
  const importText = $("import-text");
  const importFile = $("import-file");

  let quantity = 1;
  let pendingAction = "";
  let toastTimer;
  let state = restore();
  let lastSave = Date.now();

  function say(text) {
    $("toast").textContent = text;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $("toast").textContent = ""; }, 4200);
  }

  function notice(text) {
    const box = $("notice");
    box.textContent = text;
    box.hidden = !text;
  }

  function setText(element, value) {
    const text = String(value);
    if (element.textContent !== text) element.textContent = text;
  }

  function restore() {
    try {
      const data = localStorage.getItem(game.SAVE_KEY);
      if (data) {
        try {
          return game.decodeSave(data);
        } catch {
          notice("The stored save was unreadable. A fresh run is ready, or you can restore a backup from Settings.");
        }
      }
    } catch {
      showSaveError();
    }
    return game.createState();
  }

  function showSaveError() {
    setText($("save-status"), "Storage unavailable");
    notice("This browser blocked local saves. Export a backup from Settings before closing the game.");
  }

  function save() {
    lastSave = Date.now();
    try {
      localStorage.setItem(game.SAVE_KEY, game.encodeSave(state));
      setText($("save-status"), "Autosave active");
    } catch {
      showSaveError();
    }
  }

  function catchUp(now) {
    const result = game.advance(state, now);
    if (result.seconds >= 30 && result.earned > 0) {
      const minutes = Math.floor(result.seconds / 60);
      const away = minutes >= 60
        ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
        : minutes > 0 ? `${minutes}m` : `${Math.floor(result.seconds)}s`;
      notice(`Welcome back. Your squads earned ${number(result.earned)} Credits in ${away} of hunt time.`);
    }
  }

  function createCards(container, items, markup) {
    container.innerHTML = items.map(markup).join("");
    return Array.from(container.children);
  }

  const sectorCards = createCards($("sectors"), game.SECTORS, (sector, index) => `
    <article class="sector-card" data-rank="${sector.rank}" aria-labelledby="sector-${index}">
      <span class="rank-tile" aria-label="Rank ${sector.rank}"><small>RANK</small>${sector.rank}</span>
      <div class="sector-title"><h3 id="sector-${index}">${sector.name}</h3><p>${sector.subtitle}</p><p class="squad-count"></p></div>
      <div class="sector-cycle">
        <p class="cycle-caption"><span class="cycle-status"></span><span class="cycle-time"></span></p>
        <progress aria-label="${sector.name} progress" max="1" value="0"></progress>
        <p class="cycle-payout"></p>
      </div>
      <div class="sector-actions">
        <button class="button primary" type="button" data-action="launch" data-index="${index}">Launch hunt</button>
        <button class="button secondary" type="button" data-action="sync" data-index="${index}">Sync · ${number(sector.syncCost)}</button>
        <span class="button secondary synced" hidden>${icon("bolt")} Sync active</span>
        <button class="button secondary" type="button" data-action="recruit" data-index="${index}"></button>
        <button class="button primary" type="button" data-action="unlock" data-index="${index}" hidden></button>
      </div>
    </article>`).map((card) => ({
    card,
    squad: card.querySelector(".squad-count"),
    status: card.querySelector(".cycle-status"),
    time: card.querySelector(".cycle-time"),
    payout: card.querySelector(".cycle-payout"),
    progress: card.querySelector("progress"),
    launch: card.querySelector("[data-action=launch]"),
    sync: card.querySelector("[data-action=sync]"),
    synced: card.querySelector(".synced"),
    recruit: card.querySelector("[data-action=recruit]"),
    unlock: card.querySelector("[data-action=unlock]"),
  }));

  const upgradeCards = createCards($("upgrades"), game.UPGRADES, (upgrade) => `
    <article class="detail-card">
      <span class="detail-icon">${icon("lab")}</span>
      <div><h3>${upgrade.name}</h3><p>${upgrade.description}</p></div>
      <button class="button secondary" type="button" data-action="upgrade" data-id="${upgrade.id}"></button>
    </article>`).map((card) => card.querySelector("button"));

  const contractCards = createCards($("contracts"), game.CONTRACTS, (contract) => `
    <article class="detail-card">
      <span class="detail-icon">${icon("contracts")}</span>
      <div><h3>${contract.name}</h3><p>${contract.description}</p></div>
      <div><span class="detail-meta"></span><progress aria-label="${contract.name} progress" max="1" value="0"></progress></div>
      <button class="button secondary" type="button" data-action="claim" data-id="${contract.id}"></button>
    </article>`).map((card) => ({
    meter: card.querySelector("progress"),
    meta: card.querySelector(".detail-meta"),
    button: card.querySelector("button"),
  }));

  function switchView(focusHeading = false) {
    const requested = location.hash.slice(1);
    const current = stations.some((link) => link.dataset.view === requested) ? requested : "hunt";
    for (const link of stations) {
      const name = link.dataset.view;
      const selected = name === current;
      if (selected) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
      $(`view-${name}`).hidden = !selected;
    }
    hero.hidden = current !== "hunt";
    if (focusHeading && requested === current) {
      const heading = $(`${current}-heading`);
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }

  function available(button, enabled, description = "") {
    const value = String(!enabled);
    if (button.getAttribute("aria-disabled") !== value) button.setAttribute("aria-disabled", value);
    if (button.title !== description) button.title = description;
  }

  function renderSector(row, data, index) {
    const sector = state.sectors[index];
    const { card, squad, status, time, payout, progress, launch, sync, synced, recruit, unlock } = row;
    const { duration, reward, multiplier } = game.sectorStats(state, index);
    const mode = !sector.unlocked ? "locked" : sector.synced ? "synced" : sector.running ? "hunting" : "ready";
    if (card.dataset.status !== mode) card.dataset.status = mode;
    const readyToUnlock = !sector.unlocked && state.sectors[index - 1]?.unlocked && state.runEarned >= data.unlockAt;
    const previousOpen = index === 0 || state.sectors[index - 1].unlocked;
    launch.hidden = sync.hidden = !sector.unlocked || sector.synced;
    recruit.hidden = !sector.unlocked;
    synced.hidden = !sector.synced;
    unlock.hidden = sector.unlocked;

    if (!sector.unlocked) {
      setText(squad, `Requires ${number(data.unlockAt)} run Credits`);
      setText(status, readyToUnlock ? "Access ready" : "Restricted");
      setText(time, "");
      progress.value = Math.min(1, state.runEarned / data.unlockAt);
      setText(payout, `${fullNumber(Math.min(state.runEarned, data.unlockAt))} / ${fullNumber(data.unlockAt)} earned`);
      setText(unlock, readyToUnlock ? "Open sector" : "Sector locked");
      available(unlock, readyToUnlock, previousOpen ? `Earn ${fullNumber(data.unlockAt)} Credits this run` : "Open the preceding sector first");
      return;
    }

    const milestone = game.MILESTONES.find((target) => target > sector.clones);
    const bonus = milestone ? ` · ×${multiplier * 2} at ${milestone}` : ` · ×${multiplier} milestone bonus`;
    setText(squad, `${sector.clones} ${sector.clones === 1 ? "clone" : "clones"}${bonus}`);
    setText(status, sector.synced ? "Auto-hunting" : sector.running ? "Hunting" : "Ready");
    const remaining = sector.running ? Math.max(0.1, Math.ceil((duration - sector.progress) * 10) / 10) : duration;
    setText(time, `${fullNumber(remaining)}s`);
    progress.value = sector.progress / duration;
    setText(payout, `${number(reward)} Credits / hunt`);
    setText(launch, sector.running ? "Hunting…" : "Launch hunt");
    available(launch, !sector.running, sector.running ? "Hunt in progress" : "Start a single hunt");
    available(sync, state.credits >= data.syncCost, `Automate hunts for ${fullNumber(data.syncCost)} Credits`);

    const quote = game.quoteRecruit(state, index, quantity);
    const next = quote.count ? quote : game.quoteRecruit(state, index);
    if (sector.clones >= game.CLONE_LIMIT) setText(recruit, "Squad at capacity");
    else if (!quote.count) setText(recruit, `Recruit · ${number(next.cost)}`);
    else setText(recruit, `Recruit ×${quote.count} · ${number(quote.cost)}`);
    available(recruit, quote.count > 0 && state.credits >= quote.cost, next.count ? `Cost ${fullNumber(next.cost)} Credits` : "Squad capacity reached");
  }

  function render(now = Date.now()) {
    setText($("run-label"), `RUN ${String(state.archives + 1).padStart(2, "0")}`);
    setText($("credits"), number(state.credits));
    $("credits").title = `${fullNumber(state.credits)} Credits`;
    setText($("rate"), number(game.incomeRate(state)));
    setText($("clone-count"), state.sectors.reduce((total, sector) => total + sector.clones, 0));
    setText($("echoes"), number(state.echoes));
    const cooldown = Math.max(0, Math.ceil((state.commandReadyAt - now) / 1000));
    available($("command"), cooldown === 0);
    setText($("command-label"), "Dispatch Strike");
    setText($("command-help"), cooldown ? `Ready in ${cooldown}s` : `+${number(game.commandReward(state))} Credits instantly`);

    const first = state.sectors[0];
    setText($("hunt-hint"), first.synced
      ? "Grow your squads for better payouts. Earn Credits to open new sectors."
      : "Launch hunts for Credits. Buy Sync to keep a squad hunting.");
    sectorCards.forEach((row, index) => renderSector(row, game.SECTORS[index], index));
    game.UPGRADES.forEach((upgrade, index) => {
      const button = upgradeCards[index];
      setText(button, state.upgrades[upgrade.id] ? "Installed" : `Research · ${number(upgrade.cost)}`);
      available(button, !state.upgrades[upgrade.id] && state.credits >= upgrade.cost, `Cost ${fullNumber(upgrade.cost)} Credits`);
    });
    let claims = 0;
    game.CONTRACTS.forEach((contract, index) => {
      const { current, target } = game.contractProgress(state, contract.id);
      const claimed = state.claimed[contract.id];
      const eligible = !claimed && current >= target;
      const { meter, meta, button } = contractCards[index];
      if (eligible) claims += 1;
      meter.value = Math.min(1, current / target);
      setText(meta, `${Math.min(current, target)} / ${target}`);
      setText(button, claimed ? "Claimed" : `Claim ${number(contract.reward)} Credits`);
      available(button, eligible);
    });
    $("contract-badge").hidden = claims === 0;
    setText($("contract-badge"), claims);
    $("archive-meter").value = Math.min(1, state.runEarned / game.ARCHIVE_THRESHOLD);
    setText($("archive-progress"), state.runEarned < game.ARCHIVE_THRESHOLD
      ? `${fullNumber(state.runEarned)} / ${fullNumber(game.ARCHIVE_THRESHOLD)} Credits earned this run`
      : `${number(state.runEarned)} Credits earned this run`);
    const echoes = game.archiveReward(state);
    const boost = Math.round((game.echoMultiplier(state) - 1) * 100);
    setText($("archive-echoes"), `+${number(echoes)} ${echoes === 1 ? "Echo" : "Echoes"} available · +${number(boost)}% current hunt bonus`);
    available($("archive-button"), echoes >= 1);
  }

  function openConfirmation(action, title, message, confirm) {
    pendingAction = action;
    setText($("dialog-title"), title);
    setText($("dialog-message"), message);
    setText($("dialog-confirm"), confirm);
    $("import-field").hidden = action !== "import";
    importFile.value = "";
    importText.value = "";
    $("dialog-confirm").disabled = false;
    setText($("import-error"), "");
    dialog.showModal();
  }

  function exportSave() {
    save();
    const file = new Blob([game.encodeSave(state)], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "clone-rift-save.json";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    say("Save exported.");
  }

  function strike(now) {
    const earned = game.command(state, now);
    if (!earned) return false;
    hero.classList.remove("strike");
    requestAnimationFrame(() => hero.classList.add("strike"));
    say(`Strike complete. +${number(earned)} Credits.`);
    return true;
  }

  function perform(action, index, id, now) {
    switch (action) {
      case "launch":
        return game.launch(state, index);
      case "sync":
        if (!game.sync(state, index)) return false;
        say(`${game.SECTORS[index].name} is now auto-hunting.`);
        return true;
      case "recruit": {
        const hired = game.recruit(state, index, quantity);
        if (!hired) return false;
        say(`Recruited ${hired} ${hired === 1 ? "clone" : "clones"}.`);
        return true;
      }
      case "unlock":
        if (!game.unlock(state, index)) return false;
        say(`${game.SECTORS[index].name} is open. One clone assigned.`);
        return true;
      case "upgrade":
        if (!game.buyUpgrade(state, id)) return false;
        say("Research installed across the network.");
        return true;
      case "claim":
        if (!game.claim(state, id)) return false;
        say(`Contract complete. +${number(game.CONTRACTS.find((contract) => contract.id === id).reward)} Credits.`);
        return true;
      case "prepare-archive": {
        const echoes = game.archiveReward(state);
        openConfirmation("archive", "Archive this timeline?", `Gain ${number(echoes)} ${echoes === 1 ? "Echo" : "Echoes"} for another +${number(echoes * 20)}% hunt bonus. Your current squads, research, and Credits will reset.`, "Archive timeline");
        break;
      }
      case "prepare-import":
        openConfirmation("import", "Import a save?", "Choose a backup file or paste its JSON. Confirm to replace your current profile.", "Import and replace");
        break;
      case "prepare-reset":
        openConfirmation("reset", "Reset your profile?", "This clears all progress on this device, including Echoes and archived runs.", "Reset profile");
        break;
      case "export":
        exportSave();
        break;
      case "command":
        return strike(now);
    }
    return false;
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || dialog.contains(button)) return;
    if (button.dataset.quantity) {
      quantity = button.dataset.quantity === "max" ? "max" : Number(button.dataset.quantity);
      quantityButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      render();
      return;
    }
    const action = button.id === "command" ? "command" : button.dataset.action;
    if (!action) return;
    const now = Date.now();
    game.advance(state, now);
    render(now);
    if (button.getAttribute("aria-disabled") === "true") return;
    if (perform(action, Number(button.dataset.index), button.dataset.id, now)) save();
    render(now);
    // Move focus to the new control if the action removed its own button.
    if (button.hidden && action === "sync") sectorCards[Number(button.dataset.index)].recruit.focus();
    if (button.hidden && action === "unlock") sectorCards[Number(button.dataset.index)].launch.focus();
  });

  dialog.addEventListener("submit", (event) => {
    if (event.submitter?.value !== "confirm") return;
    event.preventDefault();
    const now = Date.now();
    game.advance(state, now);
    if (pendingAction === "import") {
      try {
        state = game.decodeSave(importText.value.trim(), now);
      } catch (error) {
        setText($("import-error"), error.message);
        importText.focus();
        return;
      }
      notice("");
      catchUp(now);
      say("Save imported.");
    } else if (pendingAction === "archive") {
      if (game.archive(state, now)) {
        notice("");
        say("Timeline archived. Your Echoes are active.");
      }
    } else if (pendingAction === "reset") {
      state = game.createState(now);
      notice("");
      say("Profile reset.");
    }
    save();
    render(now);
    dialog.close();
  });

  importFile.addEventListener("change", async () => {
    const file = importFile.files[0];
    if (!file) return;
    const confirm = $("dialog-confirm");
    importText.value = "";
    setText($("import-error"), "");
    if (file.size > 65_536) {
      confirm.disabled = false;
      setText($("import-error"), "This file is too large to be a Clone Rift save.");
      return;
    }
    confirm.disabled = true;
    try {
      const contents = await file.text();
      if (!dialog.open || importFile.files[0] !== file) return;
      importText.value = contents;
    } catch {
      if (!dialog.open || importFile.files[0] !== file) return;
      setText($("import-error"), "Could not read this file. Paste the save JSON instead.");
    } finally {
      if (dialog.open && importFile.files[0] === file) confirm.disabled = false;
    }
  });

  window.addEventListener("hashchange", () => switchView(true));
  document.addEventListener("visibilitychange", () => {
    const now = Date.now();
    if (document.hidden) game.advance(state, now);
    else catchUp(now);
    save();
    render(now);
  });
  window.addEventListener("pagehide", () => {
    game.advance(state);
    save();
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== game.SAVE_KEY || !event.newValue) return;
    try {
      state = game.decodeSave(event.newValue);
      render();
    } catch {
      notice("Another tab wrote an unreadable save. Export a backup from Settings to keep this session.");
    }
  });

  switchView();
  catchUp(Date.now());
  save();
  render();
  setInterval(() => {
    if (document.hidden) return;
    const now = Date.now();
    catchUp(now);
    render(now);
    if (now - lastSave >= 4000) save();
  }, 150);
})();
