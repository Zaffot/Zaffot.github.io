// game.js
import { Player } from './classes/player.js';
import { Enemy } from './classes/enemy.js';

const player = new Player("Sankari");
loadGame();
if (player.health <= 0 || player.maxHealth <= 0) {
  localStorage.removeItem("diabloCloneSave");
  location.reload();
}

let enemy = new Enemy(player.level);
let potionUsed = false;

const attackBtn = document.getElementById("attack-btn");
const defendBtn = document.getElementById("defend-btn");
const potionBtn = document.getElementById("potion-btn");
const restartBtn = document.getElementById("restart-btn");
const logDiv = document.getElementById("log");
const playerBar = document.getElementById("player-health-bar");
const enemyBar = document.getElementById("enemy-health-bar");

updateStats();
logDiv.innerText = `⚔️ Uusi taistelu alkaa! Vastassasi on ${enemy.name}`;

attackBtn.addEventListener("click", () => {
  if (player.health <= 0) return;

  // Pelaajan hyökkäys
  let damage = Math.floor(Math.random() * (player.attackMax - player.attackMin + 1)) + player.attackMin;
  let isCrit = false;
  if (player.isDefending) {
    damage = Math.floor(damage * 0.7); // -30% hyökkäysvoima
  } else {
    isCrit = Math.random() < 0.1;
    if (isCrit) damage = Math.floor(damage * 2);
  }

  const actualDamage = enemy.takeDamage(damage);
  logDiv.innerText = `👊 ${player.name} teki ${actualDamage} vahinkoa.` +
                     (isCrit ? "\n💥 Kriittinen osuma!" : "") +
                     (player.isDefending ? "\n🛡️ Hyökkäys puolustustilassa (-30 % teho)" : "");

  player.resetDefence();

  if (enemy.health <= 0) {
    const xpGained = enemy.level * 15;
    player.gainXP(xpGained);
    player.health = player.maxHealth;
    logDiv.innerText += `\n💀 Vihollinen kaatui! Saat ${xpGained} XP:tä!`;
    logDiv.innerText += `\n🩹 ${player.name} palautti kaiken elämänsä!`;

    enemy = new Enemy(player.level);
    potionUsed = false;
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
      attackBtn.disabled = true;
      defendBtn.disabled = true;
      potionBtn.disabled = true;
      restartBtn.style.display = "inline-block";
    }
  }

  saveGame();
  updateStats();
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
  potionBtn.classList.remove("disabled");
  restartBtn.style.display = "none";
  location.reload();
});

function updateStats() {
  document.getElementById("player-health").textContent = `HP: ${player.health}`;
  document.getElementById("player-xp").textContent = `XP: ${player.xp} / ${player.nextLevelXP}`;
  document.getElementById("player-level").textContent = `Level: ${player.level}`;
  document.getElementById("enemy-health").textContent = `HP: ${enemy.health}`;
  document.getElementById("enemy-name").textContent = `${enemy.name}`;

  if (playerBar) playerBar.style.height = `${Math.max(0, (player.health / player.maxHealth) * 100)}%`;
  if (enemyBar) enemyBar.style.height = `${Math.max(0, (enemy.health / enemy.maxHealth) * 100)}%`;

  const debugDiv = document.getElementById("debug");
  if (debugDiv) {
    debugDiv.innerHTML = `
      <h3>📊 Pelaajan statsit</h3>
      <p>Max HP: ${player.maxHealth}</p>
      <p>Attack: ${player.attackMin} - ${player.attackMax}</p>
      <p>Defence: ${player.defence}</p>
    `;
  }

  const enemyStatsDiv = document.getElementById("enemy-debug");
  if (enemyStatsDiv) {
    const stats = enemy.getStats();
    enemyStatsDiv.innerHTML = `
      <h3>💀 Vihollisen statsit</h3>
      <p>Max HP: ${stats.maxHp}</p>
      <p>Attack: ${stats.attack}</p>
      <p>Defence: ${stats.defence}</p>
    `;
  }
}

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
