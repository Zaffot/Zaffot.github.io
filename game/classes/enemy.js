export class Enemy {
    constructor(playerLevel) {
      this.name = this.generateName(playerLevel);
      this.level = playerLevel; // suoraan pelaajan level
      this.health = 10 + playerLevel * 8;
      this.maxHealth = this.health; // lisätty maxHealth elinvoimapalkkia varten
      this.defence = Math.floor(playerLevel * 0.5); // esim. 0.5 DEF per level
      this.attackMin = 2 + Math.floor(playerLevel * 0.6);
      this.attackMax = this.attackMin + 3;
    }
  
    makeDamage(player) {
      let damage = Math.floor(Math.random() * (this.attackMax - this.attackMin + 1)) + this.attackMin;
      const isCrit = Math.random() < 0.05;
  
      if (isCrit) {
        damage *= 2;
        console.log("Vihollinen teki kriittisen iskun!");
      }
  
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
  }