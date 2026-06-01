// PATHOGEN SLAYER - MAIN GAME ENGINE

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(frequency, duration, type = 'sine', volume = 0.3) {
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.frequency.value = frequency;
  osc.type = type;
  gain.gain.setValueAtTime(volume, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
  osc.start(audioContext.currentTime);
  osc.stop(audioContext.currentTime + duration);
}

setInterval(() => {
  const notes = [262, 294, 330, 349];
  const note = notes[Math.floor(Date.now() / 500) % notes.length];
  playSound(note, 0.5, 'sine', 0.05);
}, 500);

const GAME_STATE = {
  currentLevel: 1,
  maxLevels: 25,
  health: 100,
  maxHealth: 100,
  currency: 0,
  kills: 0,
  startTime: 0,
  levelStartTime: 0,
  gameActive: false,
  primaryWeapon: null,
  upgrades: {},
  leaderboard: JSON.parse(localStorage.getItem('pathogenLeaderboard')) || []
};

const WEAPONS = {
  pistol: { name: 'Pistol', damage: 10, fireRate: 0.3, range: 300, cost: 0, color: '#ffaa00' },
  rifle: { name: 'Rifle', damage: 25, fireRate: 0.5, range: 500, cost: 100, color: '#ff6600' },
  shotgun: { name: 'Shotgun', damage: 50, fireRate: 1, range: 150, cost: 200, color: '#ff3300' },
  sniper: { name: 'Sniper', damage: 100, fireRate: 2, range: 800, cost: 300, color: '#ff0000' },
  laserGun: { name: 'Laser Gun', damage: 35, fireRate: 0.2, range: 600, cost: 250, color: '#00ff00' },
  plasmaRifle: { name: 'Plasma Rifle', damage: 45, fireRate: 0.4, range: 400, cost: 350, color: '#00ffff' },
  flamethrower: { name: 'Flamethrower', damage: 60, fireRate: 0.3, range: 200, cost: 400, color: '#ff6600' },
  iceGun: { name: 'Ice Gun', damage: 20, fireRate: 0.4, range: 350, cost: 280, color: '#00ccff' },
  thunderbolt: { name: 'Thunderbolt', damage: 55, fireRate: 0.6, range: 450, cost: 320, color: '#ffff00' },
  minigun: { name: 'Minigun', damage: 15, fireRate: 0.1, range: 400, cost: 380, color: '#888888' },
  rocketLauncher: { name: 'Rocket Launcher', damage: 120, fireRate: 1.5, range: 500, cost: 450, color: '#ff3300' },
  atomicBomb: { name: 'Atomic Bomb', damage: 200, fireRate: 3, range: 600, cost: 600, color: '#ffff00' },
  acidSpray: { name: 'Acid Spray', damage: 40, fireRate: 0.35, range: 250, cost: 290, color: '#00ff00' },
  magneticPulse: { name: 'Magnetic Pulse', damage: 70, fireRate: 0.8, range: 500, cost: 380, color: '#ff00ff' },
  sonicBurst: { name: 'Sonic Burst', damage: 50, fireRate: 0.5, range: 400, cost: 330, color: '#00ffff' },
  vortexCannon: { name: 'Vortex Cannon', damage: 85, fireRate: 1.2, range: 550, cost: 420, color: '#ff00ff' },
  frostNova: { name: 'Frost Nova', damage: 65, fireRate: 0.7, range: 300, cost: 360, color: '#00ccff' },
  inferno: { name: 'Inferno', damage: 75, fireRate: 0.9, range: 350, cost: 390, color: '#ff6600' },
  quantumBlade: { name: 'Quantum Blade', damage: 95, fireRate: 1.1, range: 200, cost: 480, color: '#00ff96' },
  deathRay: { name: 'Death Ray', damage: 150, fireRate: 2.5, range: 700, cost: 550, color: '#ff0000' }
};

const UPGRADES = {
  healthBoost: { name: 'Health Boost', cost: 50, effect: () => { GAME_STATE.maxHealth += 20; GAME_STATE.health = GAME_STATE.maxHealth; } },
  speedBoost: { name: 'Speed Boost', cost: 75, effect: () => { GAME_STATE.speedBonus = (GAME_STATE.speedBonus || 0) + 0.1; } },
  damageBoost: { name: 'Damage Boost', cost: 100, effect: () => { GAME_STATE.damageMultiplier = (GAME_STATE.damageMultiplier || 1) + 0.2; } },
  fireRateBoost: { name: 'Fire Rate Boost', cost: 80, effect: () => { GAME_STATE.fireRateMultiplier = (GAME_STATE.fireRateMultiplier || 1) + 0.15; } },
  rangeBoost: { name: 'Range Boost', cost: 60, effect: () => { GAME_STATE.rangeMultiplier = (GAME_STATE.rangeMultiplier || 1) + 0.2; } }
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let gameObjects = { player: null, enemies: [], projectiles: [], particles: [] };

class Player {
  constructor() {
    this.x = canvas.width / 2;
    this.y = canvas.height / 2;
    this.radius = 15;
    this.speed = 5 + (GAME_STATE.speedBonus || 0) * 10;
    this.health = GAME_STATE.health;
    this.maxHealth = GAME_STATE.maxHealth;
    this.weapon = GAME_STATE.primaryWeapon || WEAPONS.pistol;
    this.lastShot = 0;
  }

  update(keys) {
    if (keys['ArrowUp'] || keys['w']) this.y -= this.speed;
    if (keys['ArrowDown'] || keys['s']) this.y += this.speed;
    if (keys['ArrowLeft'] || keys['a']) this.x -= this.speed;
    if (keys['ArrowRight'] || keys['d']) this.x += this.speed;
    this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));
  }

  shoot(mouseX, mouseY) {
    const now = Date.now();
    const fireRate = this.weapon.fireRate / (GAME_STATE.fireRateMultiplier || 1);
    if (now - this.lastShot < fireRate * 1000) return;
    this.lastShot = now;
    const angle = Math.atan2(mouseY - this.y, mouseX - this.x);
    const projectile = new Projectile(this.x, this.y, angle, this.weapon);
    gameObjects.projectiles.push(projectile);
    playSound(800, 0.1, 'sine', 0.2);
  }

  draw() {
    ctx.fillStyle = '#00ff96';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#00ff96';
    ctx.lineWidth = 2;
    ctx.stroke();
    const barWidth = 40;
    const barHeight = 5;
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(this.x - barWidth / 2, this.y - this.radius - 15, barWidth, barHeight);
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(this.x - barWidth / 2, this.y - this.radius - 15, (this.health / this.maxHealth) * barWidth, barHeight);
  }
}

class Enemy {
  constructor(x, y, level) {
    this.x = x;
    this.y = y;
    this.radius = 10 + level * 0.5;
    this.health = 20 + level * 5;
    this.maxHealth = this.health;
    this.speed = 1.5 + level * 0.3;
    this.damage = 5 + level * 1;
    this.color = `hsl(${Math.random() * 60}, 100%, 50%)`;
    this.hasSpeedModifier = Math.random() < 0.2;
    this.hasHealthModifier = Math.random() < 0.15;
    this.hasDamageModifier = Math.random() < 0.1;
    if (this.hasSpeedModifier) this.speed *= 1.5;
    if (this.hasHealthModifier) { this.health *= 1.5; this.maxHealth *= 1.5; }
    if (this.hasDamageModifier) this.damage *= 1.5;
    this.bounty = Math.floor(10 + level * 5);
  }

  update(playerX, playerY) {
    const angle = Math.atan2(playerY - this.y, playerX - this.x);
    this.x += Math.cos(angle) * this.speed;
    this.y += Math.sin(angle) * this.speed;
  }

  draw() {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    if (this.hasSpeedModifier) {
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (this.hasHealthModifier) {
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    const barWidth = this.radius * 2;
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(this.x - barWidth / 2, this.y - this.radius - 10, barWidth, 3);
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(this.x - barWidth / 2, this.y - this.radius - 10, (this.health / this.maxHealth) * barWidth, 3);
  }
}

class Projectile {
  constructor(x, y, angle, weapon) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = 8;
    this.damage = weapon.damage * (GAME_STATE.damageMultiplier || 1);
    this.range = weapon.range * (GAME_STATE.rangeMultiplier || 1);
    this.distTraveled = 0;
    this.color = weapon.color;
    this.radius = 4;
  }

  update() {
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;
    this.distTraveled += this.speed;
  }

  draw() {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  isOutOfRange() {
    return this.distTraveled > this.range || this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height;
  }
}

class Particle {
  constructor(x, y, vx, vy, color, life) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.radius = 2;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.1;
    this.life--;
  }

  draw() {
    ctx.fillStyle = this.color;
    ctx.globalAlpha = this.life / this.maxLife;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

let keys = {};
let mouseX = 0;
let mouseY = 0;

window.addEventListener('keydown', (e) => { keys[e.key] = true; });
window.addEventListener('keyup', (e) => { keys[e.key] = false; });
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
});
canvas.addEventListener('click', () => {
  if (gameObjects.player) gameObjects.player.shoot(mouseX, mouseY);
});

function spawnEnemies(level) {
  const count = 5 + level * 2;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const x = canvas.width / 2 + Math.cos(angle) * 400;
    const y = canvas.height / 2 + Math.sin(angle) * 400;
    gameObjects.enemies.push(new Enemy(x, y, level));
  }
}

function checkCollisions() {
  for (let i = gameObjects.projectiles.length - 1; i >= 0; i--) {
    const proj = gameObjects.projectiles[i];
    for (let j = gameObjects.enemies.length - 1; j >= 0; j--) {
      const enemy = gameObjects.enemies[j];
      const dist = Math.hypot(proj.x - enemy.x, proj.y - enemy.y);
      if (dist < proj.radius + enemy.radius) {
        enemy.health -= proj.damage;
        gameObjects.projectiles.splice(i, 1);
        for (let k = 0; k < 5; k++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 3 + 1;
          gameObjects.particles.push(new Particle(
            enemy.x, enemy.y,
            Math.cos(angle) * speed, Math.sin(angle) * speed,
            enemy.color, 20
          ));
        }
        if (enemy.health <= 0) {
          gameObjects.enemies.splice(j, 1);
          GAME_STATE.currency += enemy.bounty;
          GAME_STATE.kills++;
          playSound(1200, 0.1, 'sine', 0.3);
        }
        break;
      }
    }
  }

  if (gameObjects.player) {
    for (let enemy of gameObjects.enemies) {
      const dist = Math.hypot(gameObjects.player.x - enemy.x, gameObjects.player.y - enemy.y);
      if (dist < gameObjects.player.radius + enemy.radius) {
        gameObjects.player.health -= enemy.damage;
        playSound(200, 0.2, 'sine', 0.3);
        if (gameObjects.player.health <= 0) {
          endLevel(false);
        }
      }
    }
  }
}

function updateHUD() {
  document.getElementById('hudLevel').textContent = GAME_STATE.currentLevel;
  document.getElementById('hudHealth').textContent = Math.max(0, Math.floor(gameObjects.player?.health || 0));
  document.getElementById('hudCurrency').textContent = GAME_STATE.currency;
  document.getElementById('hudKills').textContent = GAME_STATE.kills;
  document.getElementById('hudWeapon').textContent = gameObjects.player?.weapon.name || 'None';
  const elapsed = Math.floor((Date.now() - GAME_STATE.levelStartTime) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  document.getElementById('hudTime').textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function gameLoop() {
  if (!GAME_STATE.gameActive) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  gameObjects.player.update(keys);
  gameObjects.enemies.forEach(e => e.update(gameObjects.player.x, gameObjects.player.y));
  gameObjects.projectiles.forEach(p => p.update());
  gameObjects.particles.forEach(p => p.update());
  gameObjects.projectiles = gameObjects.projectiles.filter(p => !p.isOutOfRange());
  gameObjects.particles = gameObjects.particles.filter(p => p.life > 0);
  checkCollisions();
  gameObjects.player.draw();
  gameObjects.enemies.forEach(e => e.draw());
  gameObjects.projectiles.forEach(p => p.draw());
  gameObjects.particles.forEach(p => p.draw());
  if (gameObjects.enemies.length === 0 && gameObjects.projectiles.length === 0) {
    endLevel(true);
    return;
  }
  updateHUD();
  requestAnimationFrame(gameLoop);
}

function startLevel(level) {
  GAME_STATE.currentLevel = level;
  GAME_STATE.gameActive = true;
  GAME_STATE.levelStartTime = Date.now();
  gameObjects.player = new Player();
  gameObjects.enemies = [];
  gameObjects.projectiles = [];
  gameObjects.particles = [];
  spawnEnemies(level);
  gameLoop();
}

function endLevel(won) {
  GAME_STATE.gameActive = false;
  const elapsed = Math.floor((Date.now() - GAME_STATE.levelStartTime) / 1000);
  if (won) {
    const reward = 100 + GAME_STATE.currentLevel * 20;
    GAME_STATE.currency += reward;
    const stats = `<div>Level: ${GAME_STATE.currentLevel}</div><div>Time: ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}</div><div>Kills: ${GAME_STATE.kills}</div><div>Reward: +${reward} 💰</div>`;
    document.getElementById('levelStats').innerHTML = stats;
    document.getElementById('levelComplete').classList.remove('hidden');
    if (GAME_STATE.currentLevel === GAME_STATE.maxLevels) {
      setTimeout(() => {
        document.getElementById('levelComplete').classList.add('hidden');
        endCampaign();
      }, 2000);
    }
  } else {
    const stats = `<div>Level: ${GAME_STATE.currentLevel}</div><div>Time: ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}</div><div>Kills: ${GAME_STATE.kills}</div><div>Health: 0 / ${GAME_STATE.maxHealth}</div>`;
    document.getElementById('gameOverStats').innerHTML = stats;
    document.getElementById('gameOver').classList.remove('hidden');
  }
}

function endCampaign() {
  const totalTime = Math.floor((Date.now() - GAME_STATE.startTime) / 1000);
  const entry = { time: totalTime, kills: GAME_STATE.kills, date: new Date().toLocaleDateString() };
  GAME_STATE.leaderboard.push(entry);
  GAME_STATE.leaderboard.sort((a, b) => a.time - b.time);
  GAME_STATE.leaderboard = GAME_STATE.leaderboard.slice(0, 10);
  localStorage.setItem('pathogenLeaderboard', JSON.stringify(GAME_STATE.leaderboard));
  const stats = `<div>Total Time: ${Math.floor(totalTime / 60)}:${String(totalTime % 60).padStart(2, '0')}</div><div>Total Kills: ${GAME_STATE.kills}</div><div>Total Currency: ${GAME_STATE.currency}</div><div>Levels Completed: ${GAME_STATE.currentLevel} / ${GAME_STATE.maxLevels}</div>`;
  document.getElementById('campaignStats').innerHTML = stats;
  document.getElementById('campaignComplete').classList.remove('hidden');
}

function showLobby() {
  document.getElementById('gameScreen').classList.remove('active');
  document.getElementById('lobbyScreen').classList.add('active');
  GAME_STATE.gameActive = false;
  updateLobbyUI();
}

function updateLobbyUI() {
  document.getElementById('lobbyLevel').textContent = `${GAME_STATE.currentLevel} / ${GAME_STATE.maxLevels}`;
  document.getElementById('lobbyCurrency').textContent = `${GAME_STATE.currency} 💰`;
  document.getElementById('lobbyKills').textContent = GAME_STATE.kills;
  const shopHTML = Object.entries(WEAPONS).map(([key, weapon]) => `<div class="weapon-item ${GAME_STATE.primaryWeapon?.name === weapon.name ? 'selected' : ''}" onclick="selectWeapon('${key}', 'primary')"><div class="weapon-name">${weapon.name}</div><div class="weapon-stats">DMG: ${weapon.damage} | Fire: ${weapon.fireRate}s | Range: ${weapon.range}</div><div class="weapon-stats">Cost: ${weapon.cost} 💰</div></div>`).join('');
  document.getElementById('weaponShop').innerHTML = shopHTML;
  const upgradesHTML = Object.entries(UPGRADES).map(([key, upgrade]) => `<div class="upgrade-item" onclick="buyUpgrade('${key}')"><div class="upgrade-name">${upgrade.name}</div><div class="upgrade-cost">Cost: ${upgrade.cost} 💰</div></div>`).join('');
  document.getElementById('upgradesList').innerHTML = upgradesHTML;
  document.getElementById('primaryWeapon').textContent = GAME_STATE.primaryWeapon?.name || 'None';
  document.getElementById('loadoutHealth').textContent = GAME_STATE.maxHealth;
  document.getElementById('loadoutSpeed').textContent = `${(GAME_STATE.speedBonus || 0) * 100}%`;
  const leaderboardHTML = GAME_STATE.leaderboard.map((entry, i) => `<div class="leaderboard-entry"><span class="leaderboard-rank">#${i + 1}</span><span class="leaderboard-time">${Math.floor(entry.time / 60)}:${String(entry.time % 60).padStart(2, '0')}</span><span>${entry.kills} kills</span></div>`).join('');
  document.getElementById('leaderboard').innerHTML = leaderboardHTML || '<p>No runs yet!</p>';
}

function selectWeapon(weaponKey, slot) {
  const weapon = WEAPONS[weaponKey];
  if (GAME_STATE.currency >= weapon.cost) {
    GAME_STATE.currency -= weapon.cost;
    if (slot === 'primary') GAME_STATE.primaryWeapon = weapon;
    updateLobbyUI();
    playSound(1000, 0.1, 'sine', 0.3);
  }
}

function buyUpgrade(upgradeKey) {
  const upgrade = UPGRADES[upgradeKey];
  if (GAME_STATE.currency >= upgrade.cost && !GAME_STATE.upgrades[upgradeKey]) {
    GAME_STATE.currency -= upgrade.cost;
    GAME_STATE.upgrades[upgradeKey] = true;
    upgrade.effect();
    updateLobbyUI();
    playSound(1200, 0.15, 'sine', 0.3);
  }
}

document.getElementById('startBtn').addEventListener('click', () => {
  GAME_STATE.startTime = Date.now();
  GAME_STATE.currentLevel = 1;
  GAME_STATE.kills = 0;
  GAME_STATE.currency = 0;
  document.getElementById('lobbyScreen').classList.remove('active');
  document.getElementById('gameScreen').classList.add('active');
  startLevel(1);
});

document.getElementById('nextLevelBtn').addEventListener('click', () => {
  document.getElementById('levelComplete').classList.add('hidden');
  document.getElementById('gameScreen').classList.add('active');
  startLevel(GAME_STATE.currentLevel + 1);
});

document.getElementById('retryBtn').addEventListener('click', () => {
  document.getElementById('gameOver').classList.add('hidden');
  document.getElementById('gameScreen').classList.add('active');
  startLevel(GAME_STATE.currentLevel);
});

document.getElementById('lobbyBtn').addEventListener('click', showLobby);
document.getElementById('lobbyBtn2').addEventListener('click', showLobby);

document.getElementById('restartCampaignBtn').addEventListener('click', () => {
  document.getElementById('campaignComplete').classList.add('hidden');
  showLobby();
});

updateLobbyUI();
