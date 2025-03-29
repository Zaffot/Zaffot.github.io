export class Player{
    // Constructor for the Player class
    // Initializes the player's name, health, defence, attack, level, xp, and isDefending properties
    constructor(name) {
        this.name = name;
        this.level = 1;
        this.health = 30;
        this.maxHealth = 30; // uusi
        this.attackMin = 1;
        this.attackMax = 3;
        this.defence = 0;
        this.xp = 0;
        this.nextLevelXP = 50;
        this.isDefending = false;
        this.maxHealth = 30;
        this.health = this.maxHealth;
        
    }


    gainXP(amount) {
        this.xp += amount;
    
        while (this.xp >= this.nextLevelXP && this.level < 100) {
            this.xp -= this.nextLevelXP;
            this.level++;
            this.nextLevelXP *= 2;
    
            // Kasvatetaan max-terveyttä ja palautetaan täyteen
            this.maxHealth += 5;
            this.health = this.maxHealth;
    
            // Hyökkäys ja puolustus kehittyy
            this.attackMin += 1;
            this.attackMax += 2;
            this.defence += 1;
    
            console.log(`🔼 Level up! Olet nyt tasolla ${this.level}`);
        }
    }
    
    
    takeDamage(amount) {
        let defenseValue = this.defence;
    
        if (this.isDefending) {
            // Esim. puolustustilassa saat +2 lisää suojaa
            defenseValue += 2;
        }
    
        let totalDamage = amount - defenseValue;
    
        // Ei saa ottaa negatiivista vahinkoa
        totalDamage = Math.max(0, totalDamage);
    
        this.health -= totalDamage;
        return totalDamage;
    }
    

    resetDefence() {
        this.isDefending = false;
    }

    makeDamage(target) {
        // Satunnainen arvo välillä min–max
        let damage = Math.floor(Math.random() * (this.attackMax - this.attackMin + 1)) + this.attackMin;
    
        // 10% mahdollisuus kriittiseen osumaan
        const isCrit = Math.random() < 0.1;
    
        if (isCrit) {
            damage *= 2;
            console.log("Kriittinen osuma!");
        }
    
        const actualDamage = target.takeDamage(damage);
        return {
            damage: actualDamage,
            isCrit: isCrit
        };
    }
}