// player.js
export class Player {
    constructor(name) {
      this.name = name;
      this.level = 1;
      this.xp = 0;
      this.nextLevelXP = 50;
      this.maxHealth = 30;
      this.health = this.maxHealth;
      this.attackMin = 1;
      this.attackMax = 3;
      this.defence = 0;
      this.isDefending = false;
    }
  
    gainXP(amount) {
      this.xp += amount;
  
      while (this.xp >= this.nextLevelXP && this.level < 100) {
        this.xp -= this.nextLevelXP;
        this.level++;
        this.nextLevelXP = Math.floor(this.nextLevelXP * 1.6); // level up XP increases by 60%
  
        // Level up stats
        this.maxHealth += 5;
        this.attackMin += 1;
        this.attackMax += 2;
        this.defence += (this.level % 2 === 0 ? 1 : 0); // defnce upgrade every second level
        this.health = this.maxHealth; //resests health
  
        console.log(`Level up! Olet nyt tasolla ${this.level}`);
      }
    }
  
    makeDamage(enemy) {
      let damage = Math.floor(Math.random() * (this.attackMax - this.attackMin + 1)) + this.attackMin;
      const isCrit = Math.random() < 0.1; // 10% change to crit
      if (isCrit) damage *= 2;
  
      const actualDamage = enemy.takeDamage(damage);
      return { damage: actualDamage, isCrit };
    }
  
    takeDamage(amount) {
      let totalDamage = amount - this.defence;
      if (this.isDefending) totalDamage = Math.floor(totalDamage / 2);
      totalDamage = Math.max(0, totalDamage);
      this.health -= totalDamage;
      return totalDamage;
    }
  
    resetDefence() {
      this.isDefending = false;
    }
  }