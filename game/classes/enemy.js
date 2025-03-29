// enemy.js
export class Enemy {
  constructor(playerLevel) {
    this.name = this.generateName(playerLevel);
    this.level = playerLevel;
    this.health = 18 + playerLevel * 7;
    this.maxHealth = this.health;
    this.defence = Math.floor(playerLevel * 0.5); // pienempi alkuarvo
    this.attackMin = 1 + Math.floor(playerLevel * 1); // pienennetty minimi
    this.attackMax = this.attackMin + 2; // pienempi haarukka
  }

  makeDamage(player) {
    let damage = Math.floor(Math.random() * (this.attackMax - this.attackMin + 1)) + this.attackMin;
    const isCrit = Math.random() < 0.05;
    if (isCrit) damage *= 2.1;

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

  generateName(playerLevel) {
    const names = ["Zombi", "Noita", "Haamu", "Demoni", "Kaaoksen Ritari", "Luolahirviö", "Räyhähenki", "Pimeyden Olento"];
    const randomName = names[Math.floor(Math.random() * names.length)];
    return `${randomName} Lv.${playerLevel}`;
  }

  getStats() {
    return {
      level: this.level,
      hp: this.health,
      maxHp: this.maxHealth,
      attack: `${this.attackMin} - ${this.attackMax}`,
      defence: this.defence
    };
  }
}
