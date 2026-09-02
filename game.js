/**
 * AETHELGARD: ECHOES OF SOLTIA
 * Motor de Juego Principal (game.js)
 * Standalone Action-RPG Engine para GitHub Pages / Móviles
 */

(function() {
  'use strict';

  // ==========================================
  // 1. SINTETIZADOR WEB AUDIO API (CHIPTUNE)
  // ==========================================
  class SoundFX {
    constructor() {
      this.ctx = null;
    }

    init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    playTone(freq, type, duration, slideFreq = null) {
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (slideFreq) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideFreq), this.ctx.currentTime + duration);
        }
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {}
    }

    hit() { this.init(); this.playTone(180, 'square', 0.1, 40); }
    slash() { this.init(); this.playTone(420, 'triangle', 0.08, 120); }
    dash() { this.init(); this.playTone(300, 'sine', 0.15, 600); }
    potion() { this.init(); this.playTone(330, 'sine', 0.25, 660); }
    levelUp() {
      this.init();
      [261, 329, 392, 523].forEach((f, i) => {
        setTimeout(() => this.playTone(f, 'triangle', 0.18), i * 75);
      });
    }
    secret() {
      this.init();
      [440, 554, 659, 880, 1108].forEach((f, i) => {
        setTimeout(() => this.playTone(f, 'sine', 0.2), i * 90);
      });
    }
    fishBite() { this.init(); this.playTone(600, 'square', 0.08, 800); }
    forgeFail() { this.init(); this.playTone(120, 'sawtooth', 0.35, 30); }
    forgeSuccess() { this.init(); this.playTone(587, 'triangle', 0.25, 880); }
  }

  const sfx = new SoundFX();

  // ==========================================
  // 2. CONSTANTES, CALENDARIO Y ESTADOS
  // ==========================================
  const CANVAS_WIDTH = 640;
  const CANVAS_HEIGHT = 480;
  const TILE_SIZE = 32;

  // Detección de Eventos de Temporada basados en Fecha Real
  function getSeasonalEvent() {
    const now = new Date();
    const month = now.getMonth() + 1; // 1 - 12
    const day = now.getDate();

    // Halloween / Víspera de Ánimas (Oct 24 - Nov 2)
    if ((month === 10 && day >= 24) || (month === 11 && day <= 2)) {
      return { id: 'halloween', name: 'Noche de Ánimas', tint: 'rgba(75, 0, 130, 0.22)', bonusExp: 1.25 };
    }
    // Solsticio Helado / Navidad (Dic 20 - Ene 5)
    if ((month === 12 && day >= 20) || (month === 1 && day <= 5)) {
      return { id: 'solstice', name: 'Solsticio Helado', tint: 'rgba(173, 216, 230, 0.2)', snow: true };
    }
    // Año Nuevo (Dic 31 - Ene 1)
    if ((month === 12 && day === 31) || (month === 1 && day === 1)) {
      return { id: 'newyear', name: 'Alba Primigenia', tint: 'rgba(255, 215, 0, 0.15)', goldMult: 1.5 };
    }
    // Luna Carmesí / Equinoccio (Alrededor de 20-23 Marzo o Septiembre)
    if ((month === 3 && day >= 20 && day <= 22) || (month === 9 && day >= 21 && day <= 24)) {
      return { id: 'bloodmoon', name: 'Eclipse del Éter', tint: 'rgba(180, 20, 20, 0.28)', frenzy: true };
    }
    return { id: 'normal', name: 'Era de la Calma', tint: null };
  }

  const CURRENT_SEASON = getSeasonalEvent();

  // ==========================================
  // 3. BASE DE DATOS DE CLASES (21 CLASES)
  // ==========================================
  const CLASS_REGISTRY = {
    // Básicas
    novice: { name: 'Novato Errante', hp: 100, res: 50, str: 8, dex: 8, vit: 8, int: 8, resType: 'Energía', desc: 'Un vagabundo sin entrenamiento formal.' },
    iron_cleric: { name: 'Clérigo de Hierro', hp: 130, res: 60, str: 12, dex: 6, vit: 12, int: 8, resType: 'Fe', desc: 'Guerrero devoto con armadura tosca.' },
    shadow_thief: { name: 'Acechador Sombrío', hp: 90, res: 70, str: 7, dex: 15, vit: 7, int: 9, resType: 'Aguante', desc: 'Rápido y letal desde las esquinas.' },
    apprentice_mage: { name: 'Erudito Arcano', hp: 80, res: 100, str: 5, dex: 7, vit: 7, int: 16, resType: 'Maná', desc: 'Manipula las corrientes del Éter.' },
    bastion_guard: { name: 'Escudero del Bastión', hp: 150, res: 40, str: 14, dex: 6, vit: 15, int: 5, resType: 'Ira', desc: 'Muralla viviente ante las bestias.' },

    // Evoluciones Marciales y Canónicas
    gladiator: { name: 'Gladiador de Sangre', hp: 180, res: 60, str: 22, dex: 14, vit: 18, int: 6, resType: 'Ira', desc: 'Invicto en los fosos subterráneos.' },
    templar: { name: 'Inquisidor Solar', hp: 160, res: 80, str: 18, dex: 10, vit: 16, int: 14, resType: 'Fe', desc: 'Purifica monstruos con fuego sagrado.' },
    assassin: { name: 'Sombra Mortífera', hp: 110, res: 90, str: 12, dex: 25, vit: 10, int: 11, resType: 'Aguante', desc: 'Golpea puntos vitales con precisión quirúrgica.' },
    arcanist: { name: 'Archimago del Vacío', hp: 95, res: 140, str: 6, dex: 10, vit: 9, int: 26, resType: 'Maná', desc: 'Desgarra el espacio con relámpagos etéreos.' },
    ranger: { name: 'Cazador de Bestias', hp: 125, res: 80, str: 15, dex: 20, vit: 13, int: 8, resType: 'Aguante', desc: 'Maestro rastreador del Pantano.' },

    // Ramas Corruptas y Pactos Prohibidos
    corrupted_knight: { name: 'Caballero Voraz', hp: 210, res: 30, str: 26, dex: 8, vit: 20, int: 4, resType: 'Hambre', desc: 'Su armadura se ha soldado a su propia piel por el Éter.' },
    blood_heretic: { name: 'Hereje de Sangre', hp: 140, res: 90, str: 10, dex: 14, vit: 12, int: 22, resType: 'Corrupción', desc: 'Sacrifica su vitalidad a cambio de poder prohibido.' },
    wraith: { name: 'Aparición Maldita', hp: 80, res: 130, str: 5, dex: 24, vit: 6, int: 23, resType: 'Éter', desc: 'Apenas roza el plano mortal; casi intocable pero frágil.' },
    rot_druid: { name: 'Chamán de la Podredumbre', hp: 145, res: 85, str: 12, dex: 9, vit: 17, int: 18, resType: 'Esporas', desc: 'Emite toxinas que asfixian a todo ser viviente cercano.' },

    // Ramas del Azar y Caída
    vagabond_king: { name: 'Señor del Infortunio', hp: 115, res: 75, str: 13, dex: 13, vit: 13, int: 13, resType: 'Azar', desc: 'El destino baraja sus golpes: o inflige daño nulo o aniquila.' },
    gambler: { name: 'Tahúr de la Cripta', hp: 100, res: 80, str: 9, dex: 18, vit: 10, int: 15, resType: 'Suerte', desc: 'Lanza monedas que explotan o curan según el azar.' },
    broken_husk: { name: 'Cáscara Vacía', hp: 70, res: 20, str: 28, dex: 5, vit: 5, int: 2, resType: 'Desesperación', desc: 'Residuo de un héroe destrozado por múltiples muertes.' },

    // Ramas Arcanas Secretas
    aether_smith: { name: 'Forjador del Cosmos', hp: 170, res: 70, str: 20, dex: 12, vit: 19, int: 15, resType: 'Ignición', desc: 'Armas imbuidas con fragmentos de meteoritos.' },
    crypt_keeper: { name: 'Custodio del Sepulcro', hp: 150, res: 90, str: 16, dex: 11, vit: 15, int: 16, resType: 'Resonancia', desc: 'Guardián de los sellos y tumbas olvidadas.' },
    
    // Rutas Ocultas Especiales
    void_angler: { name: 'Heraldo de las Mareas Sombrías', hp: 135, res: 95, str: 14, dex: 21, vit: 14, int: 17, resType: 'Profundidad', desc: 'Vio lo que duerme en el fondo del agua y aprendió su lenguaje secreto.' },
    silent_one: { name: 'El Innominado', hp: 200, res: 100, str: 20, dex: 20, vit: 20, int: 20, resType: 'Trascendencia', desc: 'Aquel que no juró lealtad a ningún dios ni mortal.' }
  };

  // ==========================================
  // 4. ESTRUCTURA DEL MUNDO Y MAPAS
  // ==========================================
  const MAPS = {
    bastion: {
      id: 'bastion',
      name: 'Bastión del Alba (Pueblo)',
      bgColor: '#161924',
      walls: [
        { x: 0, y: 0, w: 640, h: 32 },
        { x: 0, y: 448, w: 640, h: 32 },
        { x: 0, y: 32, w: 32, h: 416 },
        { x: 608, y: 32, w: 32, h: 180 },
        { x: 608, y: 270, w: 32, h: 180 }, // Salida Este hacia Pantano
        { x: 120, y: 80, w: 100, h: 80 },  // Tienda / Herrería
        { x: 420, y: 80, w: 120, h: 80 },  // Taberna / Coliseo
      ],
      interactives: [
        { id: 'ignacio', type: 'npc', name: 'Ignacio el Herrero', x: 170, y: 170, w: 28, h: 28, color: '#e67e22', dialogId: 'ignacio_dialog' },
        { id: 'silas', type: 'npc', name: 'Silas el Erudito', x: 280, y: 100, w: 28, h: 28, color: '#9b59b6', dialogId: 'silas_dialog' },
        { id: 'mael', type: 'npc', name: 'Mael el Pescador', x: 500, y: 360, w: 28, h: 28, color: '#2980b9', dialogId: 'mael_dialog' },
        { id: 'stash_chest', type: 'stash', name: 'Baúl Común', x: 70, y: 60, w: 26, h: 26, color: '#f39c12' },
        { id: 'water_dock', type: 'fishing_spot', name: 'Estanque del Bastión', x: 540, y: 380, w: 40, h: 40, color: '#3498db' },
        { id: 'bounty_board', type: 'bounty', name: 'Tablón de Contratos', x: 390, y: 160, w: 24, h: 32, color: '#d35400' }
      ],
      exits: [
        { x: 608, y: 212, w: 32, h: 58, targetMap: 'swamp', spawnX: 60, spawnY: 240 }
      ],
      enemies: []
    },
    swamp: {
      id: 'swamp',
      name: 'Pantano de los Lamentos',
      bgColor: '#101c14',
      walls: [
        { x: 0, y: 0, w: 640, h: 32 },
        { x: 0, y: 448, w: 640, h: 32 },
        { x: 0, y: 32, w: 32, h: 180 },
        { x: 0, y: 270, w: 32, h: 180 },  // Salida Oeste a Bastión
        { x: 608, y: 32, w: 32, h: 180 },
        { x: 608, y: 270, w: 32, h: 180 }, // Salida Este a Minas
        { x: 160, y: 120, w: 60, h: 90 },
        { x: 380, y: 250, w: 80, h: 80 }
      ],
      interactives: [
        { id: 'herb_node', type: 'gathering', name: 'Hongo Sombrío', x: 260, y: 90, w: 24, h: 24, color: '#2ecc71', respawn: 15 },
        { id: 'swamp_water', type: 'fishing_spot', name: 'Aguas Negras', x: 320, y: 360, w: 60, h: 50, color: '#16a085' }
      ],
      exits: [
        { x: 0, y: 212, w: 32, h: 58, targetMap: 'bastion', spawnX: 570, spawnY: 240 },
        { x: 608, y: 212, w: 32, h: 58, targetMap: 'mines', spawnX: 60, spawnY: 240 }
      ],
      enemies: [
        { type: 'slime', name: 'Moco de Ciénaga', x: 220, y: 280, hp: 45, maxHp: 45, atk: 8, spd: 1.1, exp: 14, color: '#27ae60' },
        { type: 'ghoul', name: 'Carroñero Ciego', x: 480, y: 160, hp: 70, maxHp: 70, atk: 14, spd: 1.4, exp: 25, color: '#7f8c8d' },
        { type: 'swamp_horror', name: 'Acechador Fangoso', x: 500, y: 340, hp: 110, maxHp: 110, atk: 19, spd: 1.2, exp: 40, color: '#1b4f72' }
      ]
    },
    mines: {
      id: 'mines',
      name: 'Galerías del Éter (Minas)',
      bgColor: '#171212',
      walls: [
        { x: 0, y: 0, w: 640, h: 32 },
        { x: 0, y: 448, w: 640, h: 32 },
        { x: 0, y: 32, w: 32, h: 180 },
        { x: 0, y: 270, w: 32, h: 180 }, // Salida a Pantano
        { x: 608, y: 32, w: 32, h: 416 },
        { x: 200, y: 80, w: 240, h: 40 },
        { x: 200, y: 220, w: 80, h: 160 }
      ],
      interactives: [
        { id: 'ore_iron', type: 'mining', name: 'Veta de Hierro', x: 120, y: 60, w: 26, h: 26, color: '#bdc3c7', hp: 3 },
        { id: 'ore_aether', type: 'mining', name: 'Esquirla de Éter', x: 520, y: 100, w: 24, h: 24, color: '#9b59b6', hp: 4 }
      ],
      exits: [
        { x: 0, y: 212, w: 32, h: 58, targetMap: 'swamp', spawnX: 570, spawnY: 240 }
      ],
      enemies: [
        { type: 'golem', name: 'Autómata Roto', x: 360, y: 180, hp: 140, maxHp: 140, atk: 22, spd: 0.8, exp: 55, color: '#95a5a6' },
        { type: 'bat', name: 'Vampiro de Mina', x: 440, y: 340, hp: 50, maxHp: 50, atk: 15, spd: 2.1, exp: 30, color: '#8e44ad' }
      ]
    }
  };

  // ==========================================
  // 5. MOTOR PRINCIPAL Y GESTOR DE ESTADO
  // ==========================================
  class GameEngine {
    constructor() {
      this.canvas = document.getElementById('gameCanvas');
      this.ctx = this.canvas.getContext('2d');

      // Máquina de estados
      this.state = 'PLAYING'; // PLAYING, DIALOG, FISHING, STASH, FORGE, PAUSE
      this.currentMapId = 'bastion';
      this.currentMap = MAPS.bastion;

      // Tiempo de juego y ciclo Día/Noche
      this.gameTicks = 0;
      this.dayTime = 0.25; // 0.0 - 1.0 (Día / Tarde / Noche)

      // Hitstop / Screenshake
      this.hitstopFrames = 0;
      this.shakeDuration = 0;
      this.shakeIntensity = 0;

      // Partículas y textos de daño flotantes
      this.particles = [];
      this.floatTexts = [];

      // Jugador
      this.player = {
        name: 'Francisco',
        classKey: 'novice',
        x: 320,
        y: 240,
        w: 22,
        h: 22,
        vx: 0,
        vy: 0,
        speed: 2.8,
        facing: 'down',
        level: 1,
        exp: 0,
        nextExp: 100,
        gold: 40,
        potions: 3,
        unallocatedStats: 0,
        stats: { str: 8, dex: 8, vit: 8, int: 8 },
        baseClassStats: { ...CLASS_REGISTRY.novice },
        hp: 100,
        maxHp: 100,
        res: 50,
        maxRes: 50,
        isAttacking: false,
        attackTimer: 0,
        attackCooldown: 0,
        isDashing: false,
        dashTimer: 0,
        dashCooldown: 0,
        iFrames: 0,
        weaponPlus: 0,
        
        // Maestrías Ocultas y Contadores de Misterio
        secretFishTrophy: 0,
        fishCatches: 0,
        oresMined: 0,
        deaths: 0,
        masteryWeapon: 0,
        masterySkills: {},
        titles: ['El Recién Llegado'],
        activeTitle: 'El Recién Llegado',
        inventory: [
          { id: 'rusty_blade', name: 'Espada Mellada', type: 'weapon', atk: 6, plus: 0 },
          { id: 'leather_vest', name: 'Chaleco de Cuero', type: 'armor', def: 4 },
          { id: 'apple', name: 'Manzana Silvestre', type: 'heal', value: 25, count: 2 }
        ],
        equipped: {
          weapon: { id: 'rusty_blade', name: 'Espada Mellada', type: 'weapon', atk: 6, plus: 0 },
          armor: { id: 'leather_vest', name: 'Chaleco de Cuero', type: 'armor', def: 4 }
        }
      };

      // Baúl Compartido Global (Stash)
      this.sharedStash = [
        { id: 'iron_bar', name: 'Lingote de Hierro', type: 'material', count: 5 },
        { id: 'old_coin', name: 'Moneda Antigua', type: 'valuable', count: 1 }
      ];

      // Contratos de Caza (Bounties)
      this.bounties = [
        { id: 'alpha_slime', name: 'Rey de las Babas', target: 'Moco de Ciénaga', count: 3, current: 0, reward: 80, done: false }
      ];

      // Sistema de Pesca
      this.fishingBar = { pos: 50, speed: 2.2, dir: 1, targetMin: 40, targetMax: 65, active: false };

      // Teclado
      this.keys = {};

      // Diálogos activos
      this.activeDialog = null;

      this.initInput();
      this.loadGame();
      this.updateHUD();
      this.toast(`Evento Activo: ${CURRENT_SEASON.name}`);
    }

    // ==========================================
    // 6. ENTRADA Y CONTROLES (PC + TÁCTIL)
    // ==========================================
    initInput() {
      window.addEventListener('keydown', (e) => {
        this.keys[e.key.toLowerCase()] = true;
        sfx.init();

        if (e.key === 'Tab') {
          e.preventDefault();
          this.togglePauseMenu();
        }
        if (e.key.toLowerCase() === 'e') {
          this.handleInteract();
        }
        if (e.key.toLowerCase() === 'q') {
          this.usePotion();
        }
        if (e.key === ' ') {
          this.startDash();
        }
        if (e.key.toLowerCase() === 'j') {
          this.performAttack();
        }
      });

      window.addEventListener('keyup', (e) => {
        this.keys[e.key.toLowerCase()] = false;
      });

      // Controles Táctiles (Mobile)
      const bindTouch = (id, key) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('touchstart', (e) => { e.preventDefault(); this.keys[key] = true; sfx.init(); });
        el.addEventListener('touchend', (e) => { e.preventDefault(); this.keys[key] = false; });
      };

      bindTouch('btn-up', 'w');
      bindTouch('btn-down', 's');
      bindTouch('btn-left', 'a');
      bindTouch('btn-right', 'd');

      const bindAction = (id, fn) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('touchstart', (e) => { e.preventDefault(); sfx.init(); fn(); });
      };

      bindAction('btn-attack', () => this.performAttack());
      bindAction('btn-dash', () => this.startDash());
      bindAction('btn-potion', () => this.usePotion());
      bindAction('btn-interact', () => this.handleInteract());

      // Pestañas del menú
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
          document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
          btn.classList.add('active');
          const target = document.getElementById(btn.getAttribute('data-tab'));
          if (target) target.classList.add('active');
        });
      });
    }

    // ==========================================
    // 7. BUCLE PRINCIPAL (TICK & RENDER)
    // ==========================================
    start() {
      const loop = () => {
        this.update();
        this.render();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    update() {
      // Hitstop Freeze
      if (this.hitstopFrames > 0) {
        this.hitstopFrames--;
        return;
      }

      // Ciclo de Día/Noche
      this.gameTicks++;
      this.dayTime = (Math.sin(this.gameTicks * 0.0005) + 1) / 2; // 0.0 a 1.0

      if (this.state === 'PLAYING') {
        this.updatePlayer();
        this.updateEnemies();
        this.checkExits();
      } else if (this.state === 'FISHING') {
        this.updateFishing();
      }

      // Partículas y texto flotante
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) this.particles.splice(i, 1);
      }

      for (let i = this.floatTexts.length - 1; i >= 0; i--) {
        const ft = this.floatTexts[i];
        ft.y -= 0.6;
        ft.alpha -= 0.02;
        if (ft.alpha <= 0) this.floatTexts.splice(i, 1);
      }

      if (this.shakeDuration > 0) this.shakeDuration--;
    }

    // ==========================================
    // 8. COMBATE, HITSTOP, DASH Y HABILIDADES
    // ==========================================
    updatePlayer() {
      const p = this.player;

      // I-Frames de dash
      if (p.iFrames > 0) p.iFrames--;
      if (p.dashCooldown > 0) p.dashCooldown--;
      if (p.attackCooldown > 0) p.attackCooldown--;

      // Movimiento
      let dx = 0;
      let dy = 0;
      if (this.keys['w'] || this.keys['arrowup']) dy -= 1;
      if (this.keys['s'] || this.keys['arrowdown']) dy += 1;
      if (this.keys['a'] || this.keys['arrowleft']) dx -= 1;
      if (this.keys['d'] || this.keys['arrowright']) dx += 1;

      if (dx !== 0 && dy !== 0) {
        dx *= 0.7071;
        dy *= 0.7071;
      }

      if (dx > 0) p.facing = 'right';
      else if (dx < 0) p.facing = 'left';
      else if (dy > 0) p.facing = 'down';
      else if (dy < 0) p.facing = 'up';

      const moveSpeed = p.isDashing ? p.speed * 2.8 : p.speed;
      const targetX = p.x + dx * moveSpeed;
      const targetY = p.y + dy * moveSpeed;

      // Colisiones con paredes
      if (!this.checkWallCollision(targetX, p.y, p.w, p.h)) {
        p.x = targetX;
      }
      if (!this.checkWallCollision(p.x, targetY, p.w, p.h)) {
        p.y = targetY;
      }

      // Temporizador de Dash
      if (p.isDashing) {
        p.dashTimer--;
        this.spawnParticle(p.x + p.w / 2, p.y + p.h / 2, 'rgba(100, 200, 255, 0.4)', 6);
        if (p.dashTimer <= 0) p.isDashing = false;
      }

      // Temporizador de Ataque
      if (p.isAttacking) {
        p.attackTimer--;
        if (p.attackTimer <= 0) p.isAttacking = false;
      }
    }

    startDash() {
      const p = this.player;
      if (p.dashCooldown > 0 || p.isDashing) return;
      if (p.res < 12) {
        this.toast('¡Sin energía suficiente!');
        return;
      }
      p.res -= 12;
      p.isDashing = true;
      p.dashTimer = 9;
      p.dashCooldown = 28;
      p.iFrames = 12; // I-Frames universales
      sfx.dash();
      this.updateHUD();
    }

    performAttack() {
      const p = this.player;
      if (p.attackCooldown > 0 || p.isAttacking) return;

      p.isAttacking = true;
      p.attackTimer = 10;
      p.attackCooldown = 18;
      sfx.slash();

      // Hitbox del arma según dirección
      let hx = p.x;
      let hy = p.y;
      const reach = 32;

      if (p.facing === 'right') { hx += p.w; hy += 2; }
      else if (p.facing === 'left') { hx -= reach; hy += 2; }
      else if (p.facing === 'down') { hy += p.h; hx += 2; }
      else if (p.facing === 'up') { hy -= reach; hx += 2; }

      // Chequear colisión con enemigos
      const enemies = this.currentMap.enemies || [];
      enemies.forEach((en) => {
        if (this.rectIntersect(hx, hy, reach, reach, en.x, en.y, 24, 24)) {
          this.damageEnemy(en);
        }
      });
    }

    damageEnemy(en) {
      const p = this.player;
      const baseAtk = (p.equipped.weapon ? p.equipped.weapon.atk : 4) + Math.floor(p.stats.str * 0.8) + (p.weaponPlus * 3);
      const isCrit = Math.random() < (0.1 + (p.stats.dex * 0.01));
      const finalDmg = isCrit ? Math.floor(baseAtk * 1.8) : baseAtk;

      en.hp -= finalDmg;
      sfx.hit();

      // GAME JUICE: Hitstop + Screenshake direccional
      this.hitstopFrames = isCrit ? 6 : 3;
      this.shakeDuration = isCrit ? 8 : 4;
      this.shakeIntensity = isCrit ? 5 : 2;

      this.addFloatText(en.x, en.y - 10, `${finalDmg}${isCrit ? '!' : ''}`, isCrit ? '#f1c40f' : '#fff');
      this.spawnParticle(en.x + 12, en.y + 12, '#e74c3c', 10);

      // Knockback direccional
      const kx = p.facing === 'right' ? 12 : (p.facing === 'left' ? -12 : 0);
      const ky = p.facing === 'down' ? 12 : (p.facing === 'up' ? -12 : 0);
      if (!this.checkWallCollision(en.x + kx, en.y + ky, 24, 24)) {
        en.x += kx;
        en.y += ky;
      }

      // Maestría de Arma por Golpe
      p.masteryWeapon += 1;
      if (p.masteryWeapon === 50) this.toast('¡Tu manejo de filo se ha vuelto más letal!');

      // Si muere el enemigo
      if (en.hp <= 0) {
        this.killEnemy(en);
      }
    }

    killEnemy(en) {
      const p = this.player;
      const expGain = CURRENT_SEASON.bonusExp ? Math.floor(en.exp * CURRENT_SEASON.bonusExp) : en.exp;
      const goldDrop = Math.floor(Math.random() * 8) + 4;
      
      p.exp += expGain;
      p.gold += goldDrop;
      this.addFloatText(en.x, en.y, `+${expGain} EXP`, '#3498db');
      this.spawnParticle(en.x + 12, en.y + 12, '#f1c40f', 16);

      // Progreso de Contratos de Caza (Bounties)
      this.bounties.forEach(b => {
        if (!b.done && b.target === en.name) {
          b.current++;
          if (b.current >= b.count) {
            b.done = true;
            p.gold += b.reward;
            this.toast(`¡Contrato Cumplido: ${b.name}! (+${b.reward} Oro)`);
            sfx.secret();
          }
        }
      });

      // Subida de Nivel
      if (p.exp >= p.nextExp) {
        p.level++;
        p.exp -= p.nextExp;
        p.nextExp = Math.floor(p.nextExp * 1.5);
        p.unallocatedStats += 3;
        p.maxHp += 12;
        p.hp = p.maxHp;
        p.maxRes += 6;
        p.res = p.maxRes;
        sfx.levelUp();
        this.toast(`¡Nivel ${p.level} alcanzado! (+3 Atributos)`);
      }

      // Eliminar del mapa actual
      const idx = this.currentMap.enemies.indexOf(en);
      if (idx !== -1) this.currentMap.enemies.splice(idx, 1);
      this.updateHUD();
    }

    updateEnemies() {
      const p = this.player;
      const enemies = this.currentMap.enemies || [];

      enemies.forEach((en) => {
        const dist = Math.hypot(p.x - en.x, p.y - en.y);
        // Rango de agresión
        if (dist < 180 && dist > 14) {
          const angle = Math.atan2(p.y - en.y, p.x - en.x);
          const nx = en.x + Math.cos(angle) * en.spd;
          const ny = en.y + Math.sin(angle) * en.spd;
          if (!this.checkWallCollision(nx, ny, 24, 24)) {
            en.x = nx;
            en.y = ny;
          }
        }

        // Ataque al jugador si está encima
        if (dist < 20 && p.iFrames <= 0) {
          this.damagePlayer(en.atk);
        }
      });
    }

    damagePlayer(rawDmg) {
      const p = this.player;
      const def = (p.equipped.armor ? p.equipped.armor.def : 0) + Math.floor(p.stats.vit * 0.5);
      const finalDmg = Math.max(1, rawDmg - def);

      p.hp -= finalDmg;
      p.iFrames = 25; // Inmunidad tras golpe
      sfx.hit();
      this.shakeDuration = 6;
      this.shakeIntensity = 4;
      this.addFloatText(p.x, p.y - 12, `-${finalDmg}`, '#e74c3c');

      if (p.hp <= 0) {
        this.handlePlayerDeath();
      }
      this.updateHUD();
    }

    // ==========================================
    // 9. MUERTE, SAQUEO Y PERSISTENCIA BRUTAL
    // ==========================================
    handlePlayerDeath() {
      const p = this.player;
      p.deaths++;
      sfx.forgeFail();

      // Saqueo de oro (pierdes el 30%)
      const lostGold = Math.floor(p.gold * 0.3);
      p.gold -= lostGold;

      // Posible pérdida de un objeto común no equipado
      let lostItemName = null;
      if (p.inventory.length > 0 && Math.random() < 0.4) {
        const randIdx = Math.floor(Math.random() * p.inventory.length);
        lostItemName = p.inventory[randIdx].name;
        p.inventory.splice(randIdx, 1);
      }

      // Reaparición en la cama del Bastión
      this.currentMapId = 'bastion';
      this.currentMap = MAPS.bastion;
      p.x = 240;
      p.y = 120;
      p.hp = Math.floor(p.maxHp * 0.5); // Reanimado a media vida
      p.res = p.maxRes;

      // Evaluación de Ruta Secreta del Infortunio / Cáscara Vacía
      if (p.deaths >= 7 && p.classKey === 'novice') {
        p.classKey = 'broken_husk';
        p.baseClassStats = { ...CLASS_REGISTRY.broken_husk };
        sfx.secret();
        this.showDialog('Destino Roto', 'La muerte repetida ha desgarrado tu espíritu. Te levantas como una Cáscara Vacía. Tus estadísticas han sido desfiguradas por el abismo.');
      } else {
        const msg = `Caíste inconsciente y fuiste arrastrado a la posada. Los carroñeros te despojaron de ${lostGold} monedas de oro${lostItemName ? ` y se llevaron tu [${lostItemName}]` : ''}.`;
        this.showDialog('Despertar Amargo', msg);
      }

      this.saveGame();
      this.updateHUD();
    }

    // ==========================================
    // 10. MINIJUEGO DE PESCA Y CLASE SECRETA
    // ==========================================
    startFishing() {
      this.state = 'FISHING';
      this.fishingBar.pos = 50;
      this.fishingBar.dir = 1;
      this.fishingBar.active = true;
      this.toast('¡Presiona [ESPACIO] o [TOCA] en la zona verde!');
      sfx.fishBite();
    }

    updateFishing() {
      const fb = this.fishingBar;
      fb.pos += fb.speed * fb.dir;
      if (fb.pos >= 90) { fb.pos = 90; fb.dir = -1; }
      if (fb.pos <= 10) { fb.pos = 10; fb.dir = 1; }

      // Input de parada
      if (this.keys[' '] || this.keys['e']) {
        this.keys[' '] = false;
        this.keys['e'] = false;
        this.resolveFishing();
      }
    }

    resolveFishing() {
      const fb = this.fishingBar;
      const hit = fb.pos >= fb.targetMin && fb.pos <= fb.targetMax;
      const p = this.player;

      this.state = 'PLAYING';

      if (hit) {
        sfx.forgeSuccess();
        p.fishCatches++;
        
        // Tabla de pesca orgánica
        const roll = Math.random();
        if (roll < 0.5) {
          p.inventory.push({ id: 'trout', name: 'Carpa Escamada', type: 'heal', value: 35, count: 1 });
          this.toast('¡Pescaste una Carpa Escamada! (+35 HP)');
        } else if (roll < 0.8) {
          p.inventory.push({ id: 'old_boot', name: 'Bota Empapada', type: 'material', count: 1 });
          this.toast('Sacaste una Bota Vieja del fondo.');
        } else if (roll < 0.95) {
          p.gold += 25;
          this.toast('¡Un cofre con 25 monedas enganchado al anzuelo!');
        } else {
          // Captura Mítica Secreta: Cofre del Abismo
          p.secretFishTrophy++;
          p.inventory.push({ id: 'void_relic', name: 'Amuleto de las Profundidades', type: 'accessory', desc: 'Resuena con el rumor del océano profundo.' });
          this.toast('¡UN EXTRAÑO BRILLO SURGIÓ DEL AGUA!');
          sfx.secret();
        }

        // DISPARADOR CLASE SECRETA: Heraldo de las Mareas Sombrías (void_angler)
        if (p.fishCatches >= 5 && p.secretFishTrophy >= 1 && p.classKey !== 'void_angler') {
          this.unlockSecretFishClass();
        }
      } else {
        sfx.forgeFail();
        this.toast('El sedal se rompió... el pez escapó.');
      }
      this.updateHUD();
    }

    unlockSecretFishClass() {
      const p = this.player;
      p.classKey = 'void_angler';
      p.baseClassStats = { ...CLASS_REGISTRY.void_angler };
      p.titles.push('Heraldo de las Mareas');
      p.activeTitle = 'Heraldo de las Mareas';
      sfx.secret();
      this.showDialog('El Llamado del Abismo', 'Mientras mirabas el reflejo del agua estancada, una voz ancestral te habló desde la hondura. Ya no eres un simple vagabundo; ahora eres el Heraldo de las Mareas Sombrías. Tus atributos base han despertado.');
    }

    // ==========================================
    // 11. FORJA CON RIESGO DE ROTURA (+1 a +7)
    // ==========================================
    upgradeWeapon() {
      const p = this.player;
      const cost = (p.weaponPlus + 1) * 20;

      if (p.gold < cost) {
        this.showDialog('Ignacio el Herrero', `No tienes suficiente oro. Mejorar a +${p.weaponPlus + 1} cuesta ${cost} de oro.`);
        return;
      }

      p.gold -= cost;

      if (p.weaponPlus < 3) {
        // 100% Éxito hasta +3
        p.weaponPlus++;
        sfx.forgeSuccess();
        this.toast(`¡Arma forjada con éxito a +${p.weaponPlus}!`);
      } else if (p.weaponPlus < 7) {
        // Riesgo de fallo a partir de +4
        const chance = Math.random();
        if (chance > 0.45) {
          p.weaponPlus++;
          sfx.forgeSuccess();
          this.toast(`¡Milagro en el yunque! Arma elevada a +${p.weaponPlus}!`);
        } else if (chance > 0.15) {
          sfx.forgeFail();
          this.toast('El templado falló... los materiales se evaporaron.');
        } else {
          // Degradación / Rotura
          p.weaponPlus = Math.max(0, p.weaponPlus - 1);
          sfx.forgeFail();
          this.toast(`¡EL HIERRO CRUJIÓ! El arma se degradó a +${p.weaponPlus}.`);
        }
      } else {
        this.toast('El arma ha alcanzado el límite mortal de forja (+7).');
      }

      this.updateHUD();
    }

    // ==========================================
    // 12. DIÁLOGOS, BAÚL Y TIENDAS
    // ==========================================
    handleInteract() {
      // Si hay diálogo abierto, cerrarlo
      if (this.state === 'DIALOG') {
        this.closeDialog();
        return;
      }

      const p = this.player;
      const reachBox = { x: p.x - 14, y: p.y - 14, w: p.w + 28, h: p.h + 28 };

      // Buscar interactuable en el mapa
      const interactives = this.currentMap.interactives || [];
      for (let obj of interactives) {
        if (this.rectIntersect(reachBox.x, reachBox.y, reachBox.w, reachBox.h, obj.x, obj.y, obj.w, obj.h)) {
          if (obj.type === 'npc') {
            this.handleNPCDialog(obj);
          } else if (obj.type === 'stash') {
            this.openStash();
          } else if (obj.type === 'fishing_spot') {
            this.startFishing();
          } else if (obj.type === 'mining') {
            this.mineNode(obj);
          } else if (obj.type === 'gathering') {
            this.gatherNode(obj);
          } else if (obj.type === 'bounty') {
            this.openBountyBoard();
          }
          return;
        }
      }
    }

    handleNPCDialog(npc) {
      if (npc.id === 'ignacio') {
        const cost = (this.player.weaponPlus + 1) * 20;
        this.showDialog('Ignacio el Herrero', `El hierro de Soltia no perdona, forastero. Puedo templar tu arma a +${this.player.weaponPlus + 1} por ${cost} de oro. A partir de +3, el fuego puede quebrar el filo. ¿Deseas arriesgarte?`, [
          { label: 'Templar Arma', action: () => this.upgradeWeapon() },
          { label: 'Volver', action: () => this.closeDialog() }
        ]);
      } else if (npc.id === 'silas') {
        this.showDialog('Silas el Erudito', 'El Éter carcome las mentes débiles del Pantano. Cuidado con los brebajes oscuros: lo que a simple vista parece vino dulce puede marchitar tus entrañas si careces de conocimiento.');
      } else if (npc.id === 'mael') {
        this.showDialog('Mael el Pescador', 'He visto siluetas con tentáculos en las noches de bruma... La gente cree que solo sacamos carpas. Si pasas suficiente tiempo frente al agua, la marea te devolverá la mirada.');
      }
    }

    mineNode(node) {
      this.player.oresMined++;
      node.hp--;
      sfx.hit();
      this.spawnParticle(node.x + 12, node.y + 12, '#bdc3c7', 6);
      if (node.hp <= 0) {
        this.player.inventory.push({ id: 'ore', name: 'Mineral Puro', type: 'material', count: 1 });
        this.toast('¡Picaste una veta de mineral!');
        sfx.forgeSuccess();
        const idx = this.currentMap.interactives.indexOf(node);
        if (idx !== -1) this.currentMap.interactives.splice(idx, 1);
      } else {
        this.toast(`Golpeaste la roca (${node.hp} golpes restantes)...`);
      }
      this.updateHUD();
    }

    gatherNode(node) {
      this.player.inventory.push({ id: 'herb', name: 'Hongo Sombrío', type: 'material', count: 1 });
      this.toast('Cosechaste un Hongo Sombrío del fango.');
      sfx.potion();
      const idx = this.currentMap.interactives.indexOf(node);
      if (idx !== -1) this.currentMap.interactives.splice(idx, 1);
      this.updateHUD();
    }

    openBountyBoard() {
      const b = this.bounties[0];
      const status = b.done ? 'COMPLETADO' : `${b.current}/${b.count}`;
      this.showDialog('Tablón de Contratos', `[SE BUSCA: ${b.name}]\nCaza 3 ejemplares de ${b.target} en el pantano.\nRecompensa: ${b.reward} Oro.\nEstado actual: ${status}`);
    }

    openStash() {
      this.state = 'STASH';
      const modal = document.getElementById('stash-modal');
      const grid = document.getElementById('stash-grid');
      modal.classList.remove('hidden');
      grid.innerHTML = '';

      this.sharedStash.forEach((it, idx) => {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.innerHTML = `<b>${it.name}</b><span style="color:#f1c40f">x${it.count || 1}</span>`;
        cell.onclick = () => {
          this.player.inventory.push(it);
          this.sharedStash.splice(idx, 1);
          this.openStash();
          this.updateHUD();
        };
        grid.appendChild(cell);
      });
    }

    closeStash() {
      document.getElementById('stash-modal').classList.add('hidden');
      this.state = 'PLAYING';
    }

    // ==========================================
    // 13. SALIDAS Y MAPA
    // ==========================================
    checkExits() {
      const p = this.player;
      const exits = this.currentMap.exits || [];
      for (let ex of exits) {
        if (this.rectIntersect(p.x, p.y, p.w, p.h, ex.x, ex.y, ex.w, ex.h)) {
          this.changeMap(ex.targetMap, ex.spawnX, ex.spawnY);
          return;
        }
      }
    }

    changeMap(mapId, spawnX, spawnY) {
      if (!MAPS[mapId]) return;
      this.currentMapId = mapId;
      this.currentMap = MAPS[mapId];
      this.player.x = spawnX;
      this.player.y = spawnY;
      this.toast(this.currentMap.name);
    }

    // ==========================================
    // 14. UI, DIÁLOGOS Y MENÚ DE PAUSA
    // ==========================================
    showDialog(speaker, text, buttons = null) {
      this.state = 'DIALOG';
      const box = document.getElementById('dialog-box');
      const spk = document.getElementById('dialog-speaker');
      const cnt = document.getElementById('dialog-content');
      spk.innerText = speaker;
      cnt.innerText = text;
      box.classList.remove('hidden');

      if (buttons && buttons.length > 0) {
        const btnContainer = document.createElement('div');
        btnContainer.style.marginTop = '8px';
        buttons.forEach(b => {
          const btn = document.createElement('button');
          btn.className = 'tab-btn';
          btn.style.marginRight = '6px';
          btn.innerText = b.label;
          btn.onclick = () => { b.action(); };
          btnContainer.appendChild(btn);
        });
        cnt.appendChild(btnContainer);
      }
    }

    closeDialog() {
      document.getElementById('dialog-box').classList.add('hidden');
      this.state = 'PLAYING';
    }

    togglePauseMenu() {
      const menu = document.getElementById('pause-menu');
      if (this.state === 'PAUSE') {
        menu.classList.add('hidden');
        this.state = 'PLAYING';
      } else {
        this.state = 'PAUSE';
        menu.classList.remove('hidden');
        this.updateStatsTab();
        this.updateInventoryTab();
      }
    }

    updateStatsTab() {
      const p = this.player;
      const cls = CLASS_REGISTRY[p.classKey] || CLASS_REGISTRY.novice;
      document.getElementById('stats-title').innerText = `${p.name} - ${cls.name}`;
      document.getElementById('stats-details').innerHTML = `
        <b>Nivel:</b> ${p.level} | <b>EXP:</b> ${p.exp}/${p.nextExp}<br>
        <b>Título:</b> <span class="gold-txt">${p.activeTitle}</span><br>
        <b>Arma Forjada:</b> +${p.weaponPlus} | <b>Muertes:</b> ${p.deaths}<br>
        <b>Recurso:</b> ${cls.resType} (${p.res}/${p.maxRes})<br>
        <i>"${cls.desc}"</i>
      `;
      const allocBox = document.getElementById('stat-allocation');
      if (p.unallocatedStats > 0) {
        allocBox.classList.remove('hidden');
        document.getElementById('stat-points').innerText = p.unallocatedStats;
        document.getElementById('stat-str').innerText = p.stats.str;
        document.getElementById('stat-dex').innerText = p.stats.dex;
        document.getElementById('stat-vit').innerText = p.stats.vit;
        document.getElementById('stat-int').innerText = p.stats.int;
      } else {
        allocBox.classList.add('hidden');
      }
    }

    addStat(type) {
      if (this.player.unallocatedStats <= 0) return;
      this.player.unallocatedStats--;
      this.player.stats[type]++;
      if (type === 'vit') { this.player.maxHp += 8; this.player.hp += 8; }
      if (type === 'int') { this.player.maxRes += 5; this.player.res += 5; }
      this.updateStatsTab();
      this.updateHUD();
    }

    updateInventoryTab() {
      const grid = document.getElementById('inventory-grid');
      grid.innerHTML = '';
      this.player.inventory.forEach((it, idx) => {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.innerHTML = `<b>${it.name}</b><span style="font-size:9px;color:#aaa">${it.type}</span>`;
        cell.onclick = () => {
          document.getElementById('item-inspect').innerHTML = `
            <b>${it.name}</b> (${it.type})<br>
            ${it.atk ? `Ataque: +${it.atk}<br>` : ''}
            ${it.def ? `Defensa: +${it.def}<br>` : ''}
            ${it.value ? `Efecto: Cura ${it.value} HP<br>` : ''}
            <button onclick="game.useItem(${idx})">Usar / Equipar</button>
          `;
        };
        grid.appendChild(cell);
      });
    }

    useItem(idx) {
      const it = this.player.inventory[idx];
      if (!it) return;
      if (it.type === 'heal') {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + it.value);
        sfx.potion();
        this.toast(`Usaste ${it.name}.`);
        this.player.inventory.splice(idx, 1);
      } else if (it.type === 'weapon') {
        this.player.equipped.weapon = it;
        this.toast(`Equipaste ${it.name}.`);
      } else if (it.type === 'armor') {
        this.player.equipped.armor = it;
        this.toast(`Equipaste ${it.name}.`);
      }
      this.updateInventoryTab();
      this.updateHUD();
    }

    usePotion() {
      const p = this.player;
      if (p.potions > 0 && p.hp < p.maxHp) {
        p.potions--;
        p.hp = Math.min(p.maxHp, p.hp + 50);
        sfx.potion();
        this.toast('Bebiste una Poción Carmesí (+50 HP)');
        this.updateHUD();
      }
    }

    updateHUD() {
      const p = this.player;
      const cls = CLASS_REGISTRY[p.classKey] || CLASS_REGISTRY.novice;
      document.getElementById('hud-name').innerText = p.name;
      document.getElementById('hud-class').innerText = cls.name;
      document.getElementById('hp-bar').style.width = `${Math.max(0, (p.hp / p.maxHp) * 100)}%`;
      document.getElementById('hp-txt').innerText = `${p.hp}/${p.maxHp}`;
      document.getElementById('res-bar').style.width = `${Math.max(0, (p.res / p.maxRes) * 100)}%`;
      document.getElementById('res-txt').innerText = `${p.res}/${p.maxRes}`;
      document.getElementById('hud-lvl').innerText = p.level;
      document.getElementById('hud-gold').innerText = p.gold;
      document.getElementById('potion-count').innerText = p.potions;
      document.getElementById('hud-time').innerText = this.dayTime > 0.5 ? 'Noche' : 'Día';
    }

    toast(msg) {
      const el = document.getElementById('toast');
      el.innerText = msg;
      el.style.display = 'block';
      setTimeout(() => { el.style.display = 'none'; }, 2200);
    }

    addFloatText(x, y, text, color) {
      this.floatTexts.push({ x, y, text, color, alpha: 1.0 });
    }

    spawnParticle(x, y, color, count = 5) {
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 3,
          vy: (Math.random() - 0.5) * 3,
          color,
          life: Math.floor(Math.random() * 12) + 8
        });
      }
    }

    // ==========================================
    // 15. PERSISTENCIA: SAVE / LOAD / EXPORT
    // ==========================================
    saveGame(manual = false) {
      const saveData = {
        player: this.player,
        sharedStash: this.sharedStash,
        bounties: this.bounties,
        currentMapId: this.currentMapId,
        timestamp: Date.now()
      };
      localStorage.setItem('aethelgard_save', JSON.stringify(saveData));
      if (manual) this.toast('¡Partida guardada con éxito!');
    }

    loadGame() {
      const raw = localStorage.getItem('aethelgard_save');
      if (!raw) return;
      try {
        const data = JSON.parse(raw);
        if (data.player) this.player = data.player;
        if (data.sharedStash) this.sharedStash = data.sharedStash;
        if (data.bounties) this.bounties = data.bounties;
        if (data.currentMapId && MAPS[data.currentMapId]) {
          this.currentMapId = data.currentMapId;
          this.currentMap = MAPS[data.currentMapId];
        }
      } catch (e) {}
    }

    exportSave() {
      this.saveGame();
      const raw = localStorage.getItem('aethelgard_save');
      const io = document.getElementById('save-io');
      io.value = btoa(raw);
      this.toast('¡Código copiado al cuadro de texto inferior!');
    }

    importSave() {
      const io = document.getElementById('save-io');
      try {
        const raw = atob(io.value.trim());
        const data = JSON.parse(raw);
        localStorage.setItem('aethelgard_save', JSON.stringify(data));
        this.loadGame();
        this.updateHUD();
        this.toast('¡Partida importada correctamente!');
        this.togglePauseMenu();
      } catch (e) {
        this.toast('Error: Código de guardado inválido.');
      }
    }

    // ==========================================
    // 16. RENDERIZADOR GRÁFICO (CANVAS 2D)
    // ==========================================
    render() {
      const ctx = this.ctx;
      ctx.save();

      // Screenshake
      if (this.shakeDuration > 0) {
        const ox = (Math.random() - 0.5) * this.shakeIntensity;
        const oy = (Math.random() - 0.5) * this.shakeIntensity;
        ctx.translate(ox, oy);
      }

      // Fondo del Mapa
      ctx.fillStyle = this.currentMap.bgColor || '#111';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Dibujar Paredes
      ctx.fillStyle = '#2c3e50';
      (this.currentMap.walls || []).forEach(w => {
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.strokeStyle = '#1a252f';
        ctx.strokeRect(w.x, w.y, w.w, w.h);
      });

      // Dibujar Interactuables
      (this.currentMap.interactives || []).forEach(obj => {
        ctx.fillStyle = obj.color || '#fff';
        ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
        ctx.strokeStyle = '#000';
        ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);

        // Indicador de Nombre / E
        ctx.fillStyle = '#f1c40f';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(obj.name, obj.x + obj.w / 2, obj.y - 4);
      });

      // Dibujar Enemigos
      (this.currentMap.enemies || []).forEach(en => {
        ctx.fillStyle = en.color || '#e74c3c';
        ctx.fillRect(en.x, en.y, 24, 24);
        // Barra de vida pequeña
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(en.x, en.y - 6, 24, 3);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(en.x, en.y - 6, (en.hp / en.maxHp) * 24, 3);
      });

      // Dibujar Jugador
      const p = this.player;
      ctx.fillStyle = p.iFrames > 0 && Math.floor(this.gameTicks / 4) % 2 === 0 ? 'rgba(255,255,255,0.4)' : '#3498db';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = '#2980b9';
      ctx.strokeRect(p.x, p.y, p.w, p.h);

      // Efecto visual de Ataque (Slash)
      if (p.isAttacking) {
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (p.facing === 'right') ctx.arc(p.x + p.w, p.y + p.h / 2, 20, -Math.PI / 3, Math.PI / 3);
        if (p.facing === 'left') ctx.arc(p.x, p.y + p.h / 2, 20, (2 * Math.PI) / 3, (4 * Math.PI) / 3);
        if (p.facing === 'down') ctx.arc(p.x + p.w / 2, p.y + p.h, 20, Math.PI / 6, (5 * Math.PI) / 6);
        if (p.facing === 'up') ctx.arc(p.x + p.w / 2, p.y, 20, (7 * Math.PI) / 6, (11 * Math.PI) / 6);
        ctx.stroke();
        ctx.lineWidth = 1;
      }

      // Partículas
      this.particles.forEach(pt => {
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x, pt.y, 3, 3);
      });

      // Textos Flotantes
      this.floatTexts.forEach(ft => {
        ctx.fillStyle = ft.color;
        ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.globalAlpha = 1.0;
      });

      // Filtro de Día / Noche (Luz Ambiental)
      if (this.dayTime > 0.4) {
        const nightAlpha = (this.dayTime - 0.4) * 0.9;
        ctx.fillStyle = `rgba(5, 8, 25, ${nightAlpha})`;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }

      // Filtro de Temporada Real
      if (CURRENT_SEASON.tint) {
        ctx.fillStyle = CURRENT_SEASON.tint;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }

      // Superposición de Pesca Activa
      if (this.state === 'FISHING') {
        const fb = this.fishingBar;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(170, 200, 300, 50);
        ctx.strokeStyle = '#d4af37';
        ctx.strokeRect(170, 200, 300, 50);

        // Zona verde de éxito
        const targetW = ((fb.targetMax - fb.targetMin) / 100) * 280;
        const targetX = 180 + (fb.targetMin / 100) * 280;
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(targetX, 210, targetW, 30);

        // Aguja indicadora
        const cursorX = 180 + (fb.pos / 100) * 280;
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(cursorX - 2, 205, 4, 40);

        ctx.fillStyle = '#fff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('¡TOCA O PULSA [ESPACIO] DENTRO DE LA ZONA VERDE!', 320, 190);
      }

      ctx.restore();
    }

    // ==========================================
    // 17. UTILIDADES MATEMÁTICAS Y COLISIONES
    // ==========================================
    rectIntersect(x1, y1, w1, h1, x2, y2, w2, h2) {
      return !(x2 > x1 + w1 || x2 + w2 < x1 || y2 > y1 + h1 || y2 + h2 < y1);
    }

    checkWallCollision(x, y, w, h) {
      const walls = this.currentMap.walls || [];
      for (let wall of walls) {
        if (this.rectIntersect(x, y, w, h, wall.x, wall.y, wall.w, wall.h)) {
          return true;
        }
      }
      return false;
    }
  }

  // Inicializar globalmente
  window.addEventListener('load', () => {
    window.game = new GameEngine();
    window.game.start();
  });
})();
