// game.js
import { Player } from './classes/player.js';
import { Enemy } from './classes/enemy.js';

const player = new Player("Sankari");
loadGame();
if (player.health <= 0 || player.maxHealth <= 0) {
  localStorage.removeItem("diabloCloneSave");
  location.reload();
}
let enemyCount = 0;

function createNewEnemy() {
  enemyCount++;
  const isBoss = enemyCount % 10 === 0; // 🔧 Muuta tästä kuinka usein boss tulee
  return new Enemy(player.level, isBoss);
}

let enemy = createNewEnemy();
let potionUsed = false;
let playerHits = 0;
let bleedTurns = 0;
let bleedDamage = 0;
let hotTurns = 0;
let hotCooldown = 0;

const attackBtn = document.getElementById("attack-btn");
const defendBtn = document.getElementById("defend-btn");
const potionBtn = document.getElementById("potion-btn");
const restartBtn = document.getElementById("restart-btn");
const powerBtn = document.getElementById("power-btn");
const bleedBtn = document.getElementById("bleed-btn");
const hotBtn = document.getElementById("hot-btn");
const logDiv = document.getElementById("log");
const playerBar = document.getElementById("player-health-bar");
const enemyBar = document.getElementById("enemy-health-bar");

updateStats();
logDiv.innerText = `⚔️ Uusi taistelu alkaa! Vastassasi on ${enemy.name}`;

attackBtn.addEventListener("click", () => {
  if (player.health <= 0) return;

  playerHits++;
  let damage = Math.floor(Math.random() * (player.attackMax - player.attackMin + 1)) + player.attackMin;
  let isCrit = Math.random() < 0.1;
  if (isCrit) damage = Math.floor(damage * 2);
  if (player.isDefending){ damage = 
    Math.floor(damage * 0.7);
    damage = Math.max(1, damage); // ei koskaan alle 1 kun pelaaja suojaa
  }

  const actualDamage = enemy.takeDamage(damage);
  logDiv.innerText = `👊 ${player.name} teki ${actualDamage} vahinkoa.` +
                     (isCrit ? "\n💥 Kriittinen osuma!" : "") +
                     (player.isDefending ? "\n🛡️ Hyökkäys puolustustilassa (-30 % teho)" : "");
  player.resetDefence();

  if (bleedTurns > 0) {
    const base = Math.floor(Math.random() * (player.attackMax - player.attackMin + 1)) + player.attackMin;
    const bleed = Math.floor(1 + base * (Math.random() * 0.2 + 0.1)); // 1 + 10-30%
    enemy.health -= bleed;
    logDiv.innerText += `\n🩸 Vihollinen kärsii Bleedistä ${bleed} vahinkoa.`;
    bleedTurns--;
  }

  if (hotTurns > 0) {
    const hotAmount = Math.floor(player.maxHealth * (Math.random() * 0.03 + 0.03));
    player.health = Math.min(player.maxHealth, player.health + hotAmount);
    logDiv.innerText += `\n💚 Healing Over Time palautti ${hotAmount} HP.`;
    hotTurns--;
    if (hotTurns === 0) {
      hotCooldown = 5;
    }
  }

  if (enemy.health <= 0) {
    const xpGained = enemy.isBoss
    ? enemy.level * (Math.floor(Math.random() * 2) + 3) * 10  // Boss: 3x–4x XP (kerroin *10)
    : enemy.level * 15;
    player.gainXP(xpGained);
    player.health = player.maxHealth;
    logDiv.innerText += `\n💀 Vihollinen kaatui! Saat ${xpGained} XP:tä!`;
    logDiv.innerText += `\n🩹 ${player.name} palautti kaiken elämänsä!`;

    enemy = createNewEnemy();
    potionUsed = false;
    powerBtn.disabled = true;
    playerHits = 0;
    bleedTurns = 0;
    hotTurns = 0;
    hotCooldown = 0;
    potionBtn.disabled = false;
    potionBtn.classList.remove("disabled");
    logDiv.innerText += `\n⚠️ Uusi vihollinen ilmestyi: ${enemy.name}`;
  } else {
    const enemyAttack = enemy.makeDamage(player);
    logDiv.innerText += `\n😡 ${enemy.name} hyökkäsi ja teki ${enemyAttack.damage} vahinkoa.` +
                        (enemyAttack.isCrit ? "\n💀 Kriittinen isku!" : "");
    if (player.health <= 0) {
      player.health = 0;
      logDiv.innerText += `\n☠️ ${player.name} kuoli! GAME OVER.`;
      disableAllButtons();
      restartBtn.style.display = "inline-block";
    }
  }
  updatePowerStatus();
  updateAbilityStatus();
  saveGame();
  updateStats();
});

powerBtn.addEventListener("click", () => {
  if (playerHits < 10 || player.health <= 0) return;
  let damage = player.attackMax * 2;
  const actual = enemy.takeDamage(damage);
  logDiv.innerText = `💥 Power-isku! ${player.name} teki ${actual} vahinkoa!`;
  playerHits = 0;
  powerBtn.disabled = true;
  updateStats();
});

bleedBtn.addEventListener("click", () => {
  if (bleedTurns > 0) return;
  
  bleedTurns = 3;
  logDiv.innerText = `🩸 ${player.name} aktivoi Bleedin! Vaikutus seuraavat 3 vuoroa`;
  updateAbilityStatus();
});

hotBtn.addEventListener("click", () => {
  if (hotCooldown > 0 || hotTurns > 0) return;
  hotTurns = 3;
  hotCooldown = 5;
  logDiv.innerText = `💚 Healing Over Time aktivoitu! Parantaa seuraavat 3 vuoroa.`;
  updateAbilityStatus();
});

defendBtn.addEventListener("click", () => {
  if (player.health <= 0) return;
  player.isDefending = true;
  logDiv.innerText = `🛡️ ${player.name} asettui puolustamaan!`;
  updateStats();
});

potionBtn.addEventListener("click", () => {
  if (potionUsed || player.health <= 0) return;

  const healPercent = Math.floor(Math.random() * 31) + 30;
  const healAmount = Math.floor(player.maxHealth * (healPercent / 100));
  player.health = Math.min(player.health + healAmount, player.maxHealth);

  logDiv.innerText = `🧪 ${player.name} joi potionin ja palautti +${healAmount} HP (${healPercent}%)`;

  potionUsed = true;
  potionBtn.disabled = true;
  potionBtn.classList.add("disabled");

  saveGame();
  updateStats();
});

restartBtn.addEventListener("click", () => {
  localStorage.removeItem("diabloCloneSave");
  attackBtn.disabled = false;
  defendBtn.disabled = false;
  potionBtn.disabled = false;
  powerBtn.disabled = true;
  potionBtn.classList.remove("disabled");
  restartBtn.style.display = "none";
  location.reload();
});

function updatePowerStatus() {
  powerBtn.disabled = playerHits < 10;
}

function updateAbilityStatus() {
  hotBtn.classList.toggle("disabled", hotCooldown > 0 || hotTurns > 0);
  hotBtn.disabled = hotCooldown > 0 || hotTurns > 0;

  bleedBtn.classList.toggle("disabled", bleedTurns > 0);
  bleedBtn.disabled = bleedTurns > 0;
}

function disableAllButtons() {
  attackBtn.disabled = true;
  defendBtn.disabled = true;
  potionBtn.disabled = true;
  powerBtn.disabled = true;
  hotBtn.disabled = true;
  bleedBtn.disabled = true;
}

function updateStats() {
  document.getElementById("player-health-bar").style.width = `${(player.health / player.maxHealth) * 100}%`;
  document.getElementById("enemy-health-bar").style.width = `${(enemy.health / enemy.maxHealth) * 100}%`;
  document.getElementById("enemy-name").textContent = `${enemy.name}`;
  const debugDiv = document.getElementById("debug");
  debugDiv.innerHTML = `Level: ${player.level}<br>XP: ${player.xp}/${player.nextLevelXP}<br>HP: ${player.health}/${player.maxHealth}<br>Power charge: ${playerHits} / 10`;
  const enemyStatsDiv = document.getElementById("enemy-debug");
  const stats = enemy.getStats();
  enemyStatsDiv.innerHTML = `Level: ${stats.level}<br>HP: ${stats.hp}/${stats.maxHp}<br>Attack: ${stats.attack}<br>Defence: ${stats.defence}`;
}

// 🎮 Hotkey-numerot 1–7 (hyökkäykset ja reset)
document.addEventListener("keydown", (e) => {
  if (e.key === "1") attackBtn.click();
  else if (e.key === "2") defendBtn.click();
  else if (e.key === "3") potionBtn.click();
  else if (e.key === "4") hotBtn.click();
  else if (e.key === "5") bleedBtn.click();
  else if (e.key === "6") powerBtn.click();
  else if (e.key === "7") restartBtn.click();
});

function saveGame() {
  const saveData = {
    level: player.level,
    xp: player.xp,
    nextLevelXP: player.nextLevelXP,
    health: player.health,
    maxHealth: player.maxHealth,
    attackMin: player.attackMin,
    attackMax: player.attackMax,
    defence: player.defence
  };
  localStorage.setItem("diabloCloneSave", JSON.stringify(saveData));
}

function loadGame() {
  const data = localStorage.getItem("diabloCloneSave");
  if (!data) return;

  const saved = JSON.parse(data);
  player.level = saved.level;
  player.xp = saved.xp;
  player.nextLevelXP = saved.nextLevelXP;
  player.health = saved.health;
  player.maxHealth = saved.maxHealth;
  player.attackMin = saved.attackMin;
  player.attackMax = saved.attackMax;
  player.defence = saved.defence;
}
