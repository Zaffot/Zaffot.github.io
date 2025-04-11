// Päivitetty enemy.js
export class Enemy {
  constructor(playerLevel, isBoss = false) {
    this.name = this.generateName(playerLevel, isBoss);
    this.level = playerLevel;
    this.isBoss = isBoss;

    this.health = (isBoss ? 1.5 : 1) * (18 + playerLevel * 7);
    this.maxHealth = this.health;
    this.defence = Math.floor(playerLevel * 0.5);
    this.attackMin = 1 + Math.floor(playerLevel * 1);
    this.attackMax = this.attackMin + 2;

    this.isBleeding = false;
    this.bleedTurns = 0;
    this.bleedDamage = 0;
  }

  makeDamage(player) {
    let damage = Math.floor(Math.random() * (this.attackMax - this.attackMin + 1)) + this.attackMin;
    const isCrit = Math.random() < 0.05;
    if (isCrit) damage = Math.floor(damage * 2.1);

    const actualDamage = player.takeDamage(damage);
    return {
      damage: actualDamage,
      isCrit: isCrit
    };
  }

  takeDamage(amount) {
    let damage = amount - this.defence;
    damage = Math.max(0, damage);
    this.health -= damage;
    return damage;
  }

  applyBleed(minPercent = 20, maxPercent = 40) {
    if (!this.isBleeding) {
      const percent = Math.random() * (maxPercent - minPercent) + minPercent;
      this.bleedDamage = Math.floor(this.maxHealth * (percent / 100));
      this.bleedTurns = 3;
      this.isBleeding = true;
    }
  }

  takeBleedDamage() {
    if (this.isBleeding && this.bleedTurns > 0) {
      const perTurn = Math.floor(this.bleedDamage / 3);
      this.health -= perTurn;
      this.bleedTurns--;
      if (this.bleedTurns === 0) {
        this.isBleeding = false;
        this.bleedDamage = 0;
      }
      return perTurn;
    }
    return 0;
  }

  generateName(playerLevel, isBoss) {
    const names = ["Zombi", "Noita", "Haamu", "Demoni", "Kaaoksen Ritari", "Luolahirviö", "Räyhähenki", "Pimeyden Olento"];
    const randomName = names[Math.floor(Math.random() * names.length)];
    return `${isBoss ? "BOSS: " : ""}${randomName} Lv.${playerLevel}`;
  }

  getStats() {
    return {
      level: this.level,
      hp: this.health,
      maxHp: this.maxHealth,
      attack: `${this.attackMin} - ${this.attackMax}`,
      defence: this.defence,
      isBoss: this.isBoss,
      bleed: this.isBleeding ? `${this.bleedDamage} (${this.bleedTurns} turns left)` : "-"
    };
  }
}
