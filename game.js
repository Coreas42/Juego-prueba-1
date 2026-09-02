**
 * AETHELGARD: ECHOES OF SOLTIA
 * Motor de Juego Principal (game.js)
 * Compilación completa con Baltasar, Fix de Pesca, Inventario Moderno, Esc/X y Y-Sorting
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

  function getSeasonalEvent() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    if ((month === 10 && day >= 24) || (month === 11 && day <= 2)) {
      return { id: 'halloween', name: 'Noche de Ánimas', tint: 'rgba(75, 0, 130, 0.22)', bonusExp: 1.25 };
    }
    if ((month === 12 && day >= 20) || (month === 1 && day <= 5)) {
      return { id: 'solstice', name: 'Solsticio Helado', tint: 'rgba(173, 216, 230, 0.2)', snow: true };
    }
    if ((month === 12 && day === 31) || (month === 1 && day === 1)) {
      return { id: 'newyear', name: 'Alba Primigenia', tint: 'rgba(255, 215, 0, 0.15)', goldMult: 1.5 };
    }
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
    novice: { name: 'Novato Errante', hp: 100, res: 50, str: 8, dex: 8, vit: 8, int: 8, resType: 'Energía', desc: 'Un vagabundo sin entrenamiento formal.' },
    iron_cleric: { name: 'Clérigo de Hierro', hp: 130, res: 60, str: 12, dex: 6, vit: 12, int: 8, resType: 'Fe', desc: 'Guerrero devoto con armadura tosca.' },
    shadow_thief: { name: 'Acechador Sombrío', hp: 90, res: 70, str: 7, dex: 15, vit: 7, int: 9, resType: 'Aguante', desc: 'Rápido y letal desde las esquinas.' },
    apprentice_mage: { name: 'Erudito Arcano', hp: 80, res: 100, str: 5, dex: 7, vit: 7, int: 16, resType: 'Maná', desc: 'Manipula las corrientes del Éter.' },
    bastion_guard: { name: 'Escudero del Bastión', hp: 150, res: 40, str: 14, dex: 6, vit: 15, int: 5, resType: 'Ira', desc: 'Muralla viviente ante las bestias.' },

    gladiator: { name: 'Gladiador de Sangre', hp: 180, res: 60, str: 22, dex: 14, vit: 18, int: 6, resType: 'Ira', desc: 'Invicto en los fosos subterráneos.' },
    templar: { name: 'Inquisidor Solar', hp: 160, res: 80, str: 18, dex: 10, vit: 16, int: 14, resType: 'Fe', desc: 'Purifica monstruos con fuego sagrado.' },
    assassin: { name: 'Sombra Mortífera', hp: 110, res: 90, str: 12, dex: 25, vit: 10, int: 11, resType: 'Aguante', desc: 'Golpea puntos vitales con precisión quirúrgica.' },
    arcanist: { name: 'Archimago del Vacío', hp: 95, res: 140, str: 6, dex: 10, vit: 9, int: 26, resType: 'Maná', desc: 'Desgarra el espacio con relámpagos etéreos.' },
    ranger: { name: 'Cazador de Bestias', hp: 125, res: 80, str: 15, dex: 20, vit: 13, int: 8, resType: 'Aguante', desc: 'Maestro rastreador del Pantano.' },

    corrupted_knight: { name: 'Caballero Voraz', hp: 210, res: 30, str: 26, dex: 8, vit: 20, int: 4, resType: 'Hambre', desc: 'Su armadura se ha soldado a su propia piel.' },
    blood_heretic: { name: 'Hereje de Sangre', hp: 140, res: 90, str: 10, dex: 14, vit: 12, int: 22, resType: 'Corrupción', desc: 'Sacrifica su vitalidad a cambio de poder prohibido.' },
    wraith: { name: 'Aparición Maldita', hp: 80, res: 130, str: 5, dex: 24, vit: 6, int: 23, resType: 'Éter', desc: 'Apenas roza el plano mortal; frágil pero evasivo.' },
    rot_druid: { name: 'Chamán de la Podredumbre', hp: 145, res: 85, str: 12, dex: 9, vit: 17, int: 18, resType: 'Esporas', desc: 'Emite toxinas que asfixian a todo ser viviente.' },

    vagabond_king: { name: 'Señor del Infortunio', hp: 115, res: 75, str: 13, dex: 13, vit: 13, int: 13, resType: 'Azar', desc: 'El destino baraja sus golpes: daño nulo o aniquilación.' },
    gambler: { name: 'Tahúr de la Cripta', hp: 100, res: 80, str: 9, dex: 18, vit: 10, int: 15, resType: 'Suerte', desc: 'Lanza monedas que detonan o curan según el azar.' },
    broken_husk: { name: 'Cáscara Vacía', hp: 70, res: 20, str: 28, dex: 5, vit: 5, int: 2, resType: 'Desesperación', desc: 'Residuo de un héroe quebrado tras múltiples muertes.' },

    aether_smith: { name: 'Forjador del Cosmos', hp: 170, res: 70, str: 20, dex: 12, vit: 19, int: 15, resType: 'Ignición', desc: 'Armas forjadas con fragmentos de meteoritos.' },
    crypt_keeper: { name: 'Custodio del Sepulcro', hp: 150, res: 90, str: 16, dex: 11, vit: 15, int: 16, resType: 'Resonancia', desc: 'Guardián de los sellos arcanos.' },

    void_angler: { name: 'Heraldo de las Mareas Sombrías', hp: 135, res: 95, str: 14, dex: 21, vit: 14, int: 17, resType: 'Profundidad', desc: 'Comprendió el rumor que duerme en el fondo del agua.' },
    silent_one: { name: 'El Innominado', hp: 200, res: 100, str: 20, dex: 20, vit: 20, int: 20, resType: 'Trascendencia', desc: 'Aquel que no rindió culto a ningún dios.' }
  };

  // ==========================================
  // 4. MAPAS DEL MUNDO
  // ==========================================
  const MAPS = {
    bastion: {
      id: 'bastion',
      name: 'Bastión del Alba (Pueblo)',
      bgColor: '#141722',
      walls: [
        { x: 0, y: 0, w: 640, h: 32 },
        { x: 0, y: 448, w: 640, h: 32 },
        { x: 0, y: 32, w: 32, h: 416 },
        { x: 608, y: 32, w: 32, h: 180 },
        { x: 608, y: 270, w: 32, h: 180 },
        { x: 120, y: 80, w: 100, h: 80 },
        { x: 420, y: 80, w: 120, h: 80 }
      ],
      interactives: [
        { id: 'ignacio', type: 'npc', name: 'Ignacio el Herrero', x: 170, y: 170, w: 28, h: 28, color: '#e67e22' },
        { id: 'silas', type: 'npc', name: 'Silas el Erudito', x: 280, y: 100, w: 28, h: 28, color: '#9b59b6' },
        { id: 'mael', type: 'npc', name: 'Mael el Pescador', x: 500, y: 360, w: 28, h: 28, color: '#2980b9' },
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
      bgColor: '#0e1811',
      walls: [
        { x: 0, y: 0, w: 640, h: 32 },
        { x: 0, y: 448, w: 640, h: 32 },
        { x: 0, y: 32, w: 32, h: 180 },
        { x: 0, y: 270, w: 32, h: 180 },
        { x: 608, y: 32, w: 32, h: 180 },
        { x: 608, y: 270, w: 32, h: 180 },
        { x: 160, y: 120, w: 60, h: 90 },
        { x: 380, y: 250, w: 80, h: 80 }
      ],
      interactives: [
        { id: 'herb_node', type: 'gathering', name: 'Hongo Sombrío', x: 260, y: 90, w: 24, h: 24, color: '#2ecc71', hp: 1 },
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
      bgColor: '#161111',
      walls: [
        { x: 0, y: 0, w: 640, h: 32 },
        { x: 0, y: 448, w: 640, h: 32 },
        { x: 0, y: 32, w: 32, h: 180 },
        { x: 0, y: 270, w: 32, h: 180 },
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
  // 5. MOTOR PRINCIPAL
  // ==========================================
  class GameEngine {
    constructor() {
      this.canvas = document.getElementById('gameCanvas');
      this.ctx = this.canvas.getContext('2d');

      this.state = 'PLAYING'; // PLAYING, DIALOG, FISHING, STASH, PAUSE
      this.currentMapId = 'bastion';
      this.currentMap = MAPS.bastion;

      this.gameTicks = 0;
      this.dayTime = 0.25;

      this.hitstopFrames = 0;
      this.shakeDuration = 0;
      this.shakeIntensity = 0;

      this.particles = [];
      this.floatTexts = [];

      // Filtro activo de inventario
      this.currentInventoryFilter = 'all';

      // Anti-spam para tecla E
      this.keyEProcessed = false;

      this.player = {
        name: 'Francisco',
        classKey: 'novice',
        x: 320,
        y: 240,
        w: 22,
        h: 22,
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

        secretFishTrophy: 0,
        fishCatches: 0,
        oresMined: 0,
        deaths: 0,
        masteryWeapon: 0,
        activeTitle: 'El Recién Llegado',

        // Mochila
        inventory: [
          { uid: 1, id: 'rusty_blade', name: 'Espada Mellada', category: 'equip', type: 'weapon', atk: 6, plus: 0 },
          { uid: 2, id: 'leather_vest', name: 'Chaleco de Cuero', category: 'equip', type: 'armor', def: 4 },
          { uid: 3, id: 'apple', name: 'Manzana Silvestre', category: 'consumable', type: 'heal', value: 25, count: 2 },
          { uid: 4, id: 'iron_ore', name: 'Mineral Puro', category: 'material', type: 'ore', count: 1 }
        ],

        // Slots de equipo
        equipped: {
          weapon: { uid: 1, id: 'rusty_blade', name: 'Espada Mellada', category: 'equip', type: 'weapon', atk: 6, plus: 0 },
          armor: { uid: 2, id: 'leather_vest', name: 'Chaleco de Cuero', category: 'equip', type: 'armor', def: 4 },
          accessory: null
        }
      };

      this.sharedStash = [
        { uid: 101, id: 'iron_bar', name: 'Lingote de Hierro', category: 'material', type: 'material', count: 5 },
        { uid: 102, id: 'old_coin', name: 'Moneda Antigua', category: 'material', type: 'valuable', count: 1 }
      ];

      this.bounties = [
        { id: 'alpha_slime', name: 'Rey de las Babas', target: 'Moco de Ciénaga', count: 3, current: 0, reward: 80, done: false }
      ];

      // Minijuego de pesca
      this.fishingBar = { pos: 50, speed: 2.2, dir: 1, targetMin: 38, targetMax: 62, active: false };

      this.keys = {};
      this.initInput();
      this.loadGame();
      this.updateHUD();
      this.toast(`Temporada: ${CURRENT_SEASON.name}`);
    }

    // ==========================================
    // 6. ENTRADAS (TECLADO / ESCAPE / TÁCTIL)
    // ==========================================
    initInput() {
      window.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        sfx.init();

        // Tecla Escape universal para cerrar cualquier menú, baúl o diálogo
        if (e.key === 'Escape') {
          e.preventDefault();
          this.closeAllModals();
          return;
        }

        // Tecla Tab
        if (e.key === 'Tab') {
          e.preventDefault();
          this.togglePauseMenu();
          return;
        }

        // Si estamos pescando: AISLAR ESPACIO para no castear dash
        if (this.state === 'FISHING') {
          if (e.key === ' ' || k === 'e') {
            e.preventDefault();
            this.resolveFishing();
          }
          return;
        }

        // Anti-spam en interacción con tecla E
        if (k === 'e') {
          if (!this.keyEProcessed) {
            this.keyEProcessed = true;
            this.handleInteract();
          }
          return;
        }

        if (k === 'q') {
          this.usePotion();
          return;
        }

        if (e.key === ' ') {
          e.preventDefault();
          this.startDash();
          return;
        }

        if (k === 'j') {
          this.performAttack();
          return;
        }

        this.keys[k] = true;
      });

      window.addEventListener('keyup', (e) => {
        const k = e.key.toLowerCase();
        if (k === 'e') {
          this.keyEProcessed = false;
        }
        this.keys[k] = false;
      });

      // Táctiles
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
      bindAction('btn-dash', () => {
        if (this.state === 'FISHING') this.resolveFishing();
        else this.startDash();
      });
      bindAction('btn-potion', () => this.usePotion());
      bindAction('btn-interact', () => {
        if (this.state === 'FISHING') this.resolveFishing();
        else this.handleInteract();
      });

      // Pestañas
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
          document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
          btn.classList.add('active');
          const target = document.getElementById(btn.getAttribute('data-tab'));
          if (target) target.classList.add('active');
        });
      });
    }

    closeAllModals() {
      if (this.state === 'PAUSE') {
        document.getElementById('pause-menu').classList.add('hidden');
        this.state = 'PLAYING';
      }
      if (this.state === 'STASH') {
        this.closeStash();
      }
      if (this.state === 'DIALOG') {
        this.closeDialog();
      }
    }

    // ==========================================
    // 7. BUCLE Y CICLOS
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
      if (this.hitstopFrames > 0) {
        this.hitstopFrames--;
        return;
      }

      this.gameTicks++;
      this.dayTime = (Math.sin(this.gameTicks * 0.0004) + 1) / 2;

      if (this.state === 'PLAYING') {
        this.updatePlayer();
        this.updateEnemies();
        this.checkExits();
      } else if (this.state === 'FISHING') {
        this.updateFishing();
      }

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
    // 8. COMBATE Y MOVIMIENTO
    // ==========================================
    updatePlayer() {
      const p = this.player;

      if (p.iFrames > 0) p.iFrames--;
      if (p.dashCooldown > 0) p.dashCooldown--;
      if (p.attackCooldown > 0) p.attackCooldown--;

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

      if (!this.checkWallCollision(targetX, p.y, p.w, p.h)) p.x = targetX;
      if (!this.checkWallCollision(p.x, targetY, p.w, p.h)) p.y = targetY;

      if (p.isDashing) {
        p.dashTimer--;
        this.spawnParticle(p.x + p.w / 2, p.y + p.h / 2, 'rgba(100, 200, 255, 0.4)', 5);
        if (p.dashTimer <= 0) p.isDashing = false;
      }

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
      p.dashCooldown = 26;
      p.iFrames = 12;
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

      let hx = p.x;
      let hy = p.y;
      const reach = 34;

      if (p.facing === 'right') { hx += p.w; hy += 2; }
      else if (p.facing === 'left') { hx -= reach; hy += 2; }
      else if (p.facing === 'down') { hy += p.h; hx += 2; }
      else if (p.facing === 'up') { hy -= reach; hx += 2; }

      const enemies = this.currentMap.enemies || [];
      enemies.forEach((en) => {
        if (this.rectIntersect(hx, hy, reach, reach, en.x, en.y, 24, 24)) {
          this.damageEnemy(en);
        }
      });
    }

    damageEnemy(en) {
      const p = this.player;
      const weaponAtk = p.equipped.weapon ? (p.equipped.weapon.atk + (p.weaponPlus * 3)) : 4;
      const baseAtk = weaponAtk + Math.floor(p.stats.str * 0.85);
      const isCrit = Math.random() < (0.1 + (p.stats.dex * 0.012));
      const finalDmg = isCrit ? Math.floor(baseAtk * 1.8) : baseAtk;

      en.hp -= finalDmg;
      sfx.hit();

      this.hitstopFrames = isCrit ? 6 : 3;
      this.shakeDuration = isCrit ? 8 : 4;
      this.shakeIntensity = isCrit ? 5 : 2;

      this.addFloatText(en.x, en.y - 10, `${finalDmg}${isCrit ? '!' : ''}`, isCrit ? '#f1c40f' : '#fff');
      this.spawnParticle(en.x + 12, en.y + 12, '#e74c3c', 8);

      const kx = p.facing === 'right' ? 12 : (p.facing === 'left' ? -12 : 0);
      const ky = p.facing === 'down' ? 12 : (p.facing === 'up' ? -12 : 0);
      if (!this.checkWallCollision(en.x + kx, en.y + ky, 24, 24)) {
        en.x += kx;
        en.y += ky;
      }

      p.masteryWeapon += 1;
      if (p.masteryWeapon === 50) this.toast('¡Tu maestría con el filo ha despertado!');

      if (en.hp <= 0) this.killEnemy(en);
    }

    killEnemy(en) {
      const p = this.player;
      const expGain = CURRENT_SEASON.bonusExp ? Math.floor(en.exp * CURRENT_SEASON.bonusExp) : en.exp;
      const goldDrop = Math.floor(Math.random() * 8) + 5;

      p.exp += expGain;
      p.gold += goldDrop;
      this.addFloatText(en.x, en.y, `+${expGain} EXP`, '#3498db');
      this.spawnParticle(en.x + 12, en.y + 12, '#f1c40f', 14);

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

      const idx = this.currentMap.enemies.indexOf(en);
      if (idx !== -1) this.currentMap.enemies.splice(idx, 1);
      this.updateHUD();
    }

    updateEnemies() {
      const p = this.player;
      const enemies = this.currentMap.enemies || [];

      enemies.forEach((en) => {
        const dist = Math.hypot(p.x - en.x, p.y - en.y);
        if (dist < 180 && dist > 14) {
          const angle = Math.atan2(p.y - en.y, p.x - en.x);
          const nx = en.x + Math.cos(angle) * en.spd;
          const ny = en.y + Math.sin(angle) * en.spd;
          if (!this.checkWallCollision(nx, ny, 24, 24)) {
            en.x = nx;
            en.y = ny;
          }
        }

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
      p.iFrames = 25;
      sfx.hit();
      this.shakeDuration = 6;
      this.shakeIntensity = 4;
      this.addFloatText(p.x, p.y - 12, `-${finalDmg}`, '#e74c3c');

      if (p.hp <= 0) this.handlePlayerDeath();
      this.updateHUD();
    }

    handlePlayerDeath() {
      const p = this.player;
      p.deaths++;
      sfx.forgeFail();

      const lostGold = Math.floor(p.gold * 0.3);
      p.gold -= lostGold;

      this.currentMapId = 'bastion';
      this.currentMap = MAPS.bastion;
      p.x = 240;
      p.y = 120;
      p.hp = Math.floor(p.maxHp * 0.5);
      p.res = p.maxRes;

      if (p.deaths >= 7 && p.classKey === 'novice') {
        p.classKey = 'broken_husk';
        p.baseClassStats = { ...CLASS_REGISTRY.broken_husk };
        sfx.secret();
        this.showDialog('Destino Roto', 'La muerte repetida quebró tu alma. Renaces como Cáscara Vacía.');
      } else {
        this.showDialog('Despertar Amargo', `Despertaste herido en el Bastión tras perder ${lostGold} monedas de oro.`);
      }

      this.saveGame();
      this.updateHUD();
    }

    // ==========================================
    // 9. MINIJUEGO DE PESCA AISLADO
    // ==========================================
    startFishing() {
      this.state = 'FISHING';
      this.fishingBar.pos = 50;
      this.fishingBar.dir = 1;
      this.fishingBar.active = true;
      sfx.fishBite();
      this.toast('¡Presiona [ESPACIO] o [E] en la zona verde!');
    }

    updateFishing() {
      const fb = this.fishingBar;
      fb.pos += fb.speed * fb.dir;
      if (fb.pos >= 88) { fb.pos = 88; fb.dir = -1; }
      if (fb.pos <= 12) { fb.pos = 12; fb.dir = 1; }
    }

    resolveFishing() {
      const fb = this.fishingBar;
      const hit = fb.pos >= fb.targetMin && fb.pos <= fb.targetMax;
      const p = this.player;

      this.state = 'PLAYING';

      if (hit) {
        sfx.forgeSuccess();
        p.fishCatches++;

        const roll = Math.random();
        if (roll < 0.5) {
          p.inventory.push({ uid: Date.now(), id: 'trout', name: 'Carpa Escamada', category: 'consumable', type: 'heal', value: 35, count: 1 });
          this.toast('¡Pescaste una Carpa Escamada! (+35 HP)');
        } else if (roll < 0.8) {
          p.inventory.push({ uid: Date.now(), id: 'old_boot', name: 'Bota Empapada', category: 'material', type: 'material', count: 1 });
          this.toast('Sacaste una Bota Vieja del fondo fangoso.');
        } else if (roll < 0.95) {
          p.gold += 30;
          this.toast('¡Cofre recuperado! +30 de Oro.');
        } else {
          p.secretFishTrophy++;
          p.inventory.push({ uid: Date.now(), id: 'void_relic', name: 'Amuleto de las Profundidades', category: 'equip', type: 'accessory', desc: 'Resuena con el rumor del océano.' });
          this.toast('¡UN EXTRAÑO BRILLO SURGIÓ DEL AGUA!');
          sfx.secret();
        }

        if (p.fishCatches >= 5 && p.secretFishTrophy >= 1 && p.classKey !== 'void_angler') {
          p.classKey = 'void_angler';
          p.baseClassStats = { ...CLASS_REGISTRY.void_angler };
          p.activeTitle = 'Heraldo de las Mareas';
          sfx.secret();
          this.showDialog('El Llamado del Abismo', 'La voz de las aguas profundas te ha bautizado como su Heraldo.');
        }
      } else {
        sfx.forgeFail();
        this.toast('El sedal se rompió... el pez escapó.');
      }
      this.updateHUD();
    }

    // ==========================================
    // 10. BALTASAR EL DESTERRADO Y DIÁLOGOS
    // ==========================================
    handleInteract() {
      if (this.state === 'DIALOG') {
        this.closeDialog();
        return;
      }

      const p = this.player;
      const reach = { x: p.x - 14, y: p.y - 14, w: p.w + 28, h: p.h + 28 };

      const interactives = this.currentMap.interactives || [];
      for (let obj of interactives) {
        if (this.rectIntersect(reach.x, reach.y, reach.w, reach.h, obj.x, obj.y, obj.w, obj.h)) {
          if (obj.type === 'npc') this.handleNPCDialog(obj);
          else if (obj.type === 'stash') this.openStash();
          else if (obj.type === 'fishing_spot') this.startFishing();
          else if (obj.type === 'mining') this.mineNode(obj);
          else if (obj.type === 'gathering') this.gatherNode(obj);
          else if (obj.type === 'bounty') this.openBountyBoard();
          return;
        }
      }
    }

    handleNPCDialog(npc) {
      if (npc.id === 'baltasar') {
        this.showDialog('Baltasar el Desterrado', 'El velo entre mundos se desgarra, forastero. Traigo reliquias que la iglesia quemaría en la hoguera. Te costarán una fortuna en oro o tus baratijas más raras.', [
          { label: 'Comprar Elixir del Leteo (250 Oro)', action: () => this.buyBaltasarGold('leteo', 250) },
          { label: 'Trueque: Amuleto por Piedra de Afilar Sombría', action: () => this.barterBaltasar('void_relic', 'sharp_stone') },
          { label: 'Trueque: Bota Vieja + Hongo por Poción Mayor', action: () => this.barterBaltasarBoot() },
          { label: 'Marcharse', action: () => this.closeDialog() }
        ]);
      } else if (npc.id === 'ignacio') {
        const cost = (this.player.weaponPlus + 1) * 20;
        this.showDialog('Ignacio el Herrero', `Puedo templar tu arma a +${this.player.weaponPlus + 1} por ${cost} de oro. A partir de +3, el fuego del yunque puede romperla.`, [
          { label: `Templar (+${this.player.weaponPlus + 1})`, action: () => this.upgradeWeapon() },
          { label: 'Volver', action: () => this.closeDialog() }
        ]);
      } else if (npc.id === 'silas') {
        this.showDialog('Silas el Erudito', 'El Éter no es magia, forastero; es la herida sangrante del mundo. Cuida tus pasos en el fango.');
      } else if (npc.id === 'mael') {
        this.showDialog('Mael el Pescador', 'El agua no devuelve lo que traga a menos que sepas escuchar su silencio.');
      }
    }

    buyBaltasarGold(itemKey, cost) {
      if (this.player.gold < cost) {
        this.toast('No tienes suficiente oro para el precio de Baltasar.');
        return;
      }
      this.player.gold -= cost;
      if (itemKey === 'leteo') {
        this.player.unallocatedStats += (this.player.level - 1) * 3;
        this.player.stats = { str: 8, dex: 8, vit: 8, int: 8 };
        sfx.secret();
        this.toast('¡Bebiste el Elixir del Leteo! Tus atributos fueron purificados.');
      }
      this.closeDialog();
      this.updateHUD();
    }

    barterBaltasar(requiredId, rewardKey) {
      const idx = this.player.inventory.findIndex(it => it.id === requiredId);
      if (idx === -1) {
        this.toast('Baltasar rechaza el trato: No tienes el objeto solicitado.');
        return;
      }
      this.player.inventory.splice(idx, 1);
      this.player.weaponPlus = Math.min(7, this.player.weaponPlus + 1);
      sfx.forgeSuccess();
      this.toast('¡Baltasar tomó la reliquia y afiló tu filo sin riesgo alguno!');
      this.closeDialog();
      this.updateHUD();
    }

    barterBaltasarBoot() {
      const bootIdx = this.player.inventory.findIndex(it => it.id === 'old_boot');
      const herbIdx = this.player.inventory.findIndex(it => it.id === 'herb');
      if (bootIdx === -1 || herbIdx === -1) {
        this.toast('Necesitas 1 Bota Empapada y 1 Hongo Sombrío.');
        return;
      }
      this.player.inventory.splice(Math.max(bootIdx, herbIdx), 1);
      this.player.inventory.splice(Math.min(bootIdx, herbIdx), 1);
      this.player.potions += 3;
      sfx.potion();
      this.toast('¡Baltasar destiló los desechos en 3 Pociones Carmesí!');
      this.closeDialog();
      this.updateHUD();
    }

    upgradeWeapon() {
      const p = this.player;
      const cost = (p.weaponPlus + 1) * 20;

      if (p.gold < cost) {
        this.toast(`Te falta oro (${cost} requerido).`);
        return;
      }

      p.gold -= cost;

      if (p.weaponPlus < 3) {
        p.weaponPlus++;
        sfx.forgeSuccess();
        this.toast(`¡Arma forjada con éxito a +${p.weaponPlus}!`);
      } else if (p.weaponPlus < 7) {
        const roll = Math.random();
        if (roll > 0.45) {
          p.weaponPlus++;
          sfx.forgeSuccess();
          this.toast(`¡Milagro en el fuego! Arma elevada a +${p.weaponPlus}!`);
        } else if (roll > 0.18) {
          sfx.forgeFail();
          this.toast('El templado falló sin romper la hoja.');
        } else {
          p.weaponPlus = Math.max(0, p.weaponPlus - 1);
          sfx.forgeFail();
          this.toast(`¡EL HIERRO CRUJIÓ! El arma cayó a +${p.weaponPlus}.`);
        }
      } else {
        this.toast('El arma ya está al límite mortal (+7).');
      }

      this.closeDialog();
      this.updateHUD();
    }

    mineNode(node) {
      this.player.oresMined++;
      node.hp--;
      sfx.hit();
      this.spawnParticle(node.x + 12, node.y + 12, '#bdc3c7', 6);
      if (node.hp <= 0) {
        this.player.inventory.push({ uid: Date.now(), id: 'iron_ore', name: 'Mineral Puro', category: 'material', type: 'material', count: 1 });
        this.toast('¡Veta extraída por completo!');
        sfx.forgeSuccess();
        const idx = this.currentMap.interactives.indexOf(node);
        if (idx !== -1) this.currentMap.interactives.splice(idx, 1);
      }
      this.updateHUD();
    }

    gatherNode(node) {
      this.player.inventory.push({ uid: Date.now(), id: 'herb', name: 'Hongo Sombrío', category: 'material', type: 'material', count: 1 });
      this.toast('Cosechaste un Hongo Sombrío.');
      sfx.potion();
      const idx = this.currentMap.interactives.indexOf(node);
      if (idx !== -1) this.currentMap.interactives.splice(idx, 1);
      this.updateHUD();
    }

    openBountyBoard() {
      const b = this.bounties[0];
      const st = b.done ? 'COMPLETADO' : `${b.current}/${b.count}`;
      this.showDialog('Tablón de Contratos', `[SE BUSCA: ${b.name}]\nCaza 3 de ${b.target} en el pantano.\nRecompensa: ${b.reward} Oro.\nEstado: ${st}`);
    }

    // ==========================================
    // 11. INVENTARIO RENOVADO (FILTROS, SLOTS, DOBLE CLIC)
    // ==========================================
    setInventoryFilter(filter) {
      this.currentInventoryFilter = filter;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      const activeBtn = Array.from(document.querySelectorAll('.filter-btn')).find(b => b.getAttribute('onclick').includes(filter));
      if (activeBtn) activeBtn.classList.add('active');
      this.updateInventoryTab();
    }

    updateInventoryTab() {
      const grid = document.getElementById('inventory-grid');
      if (!grid) return;
      grid.innerHTML = '';

      // Actualizar slots laterales
      const eq = this.player.equipped;
      document.getElementById('slot-weapon').innerText = eq.weapon ? `${eq.weapon.name} (+${this.player.weaponPlus})` : '[Vacío]';
      document.getElementById('slot-armor').innerText = eq.armor ? eq.armor.name : '[Vacío]';
      document.getElementById('slot-accessory').innerText = eq.accessory ? eq.accessory.name : '[Vacío]';

      // Filtrar elementos
      const filtered = this.player.inventory.filter(it => {
        if (this.currentInventoryFilter === 'all') return true;
        if (this.currentInventoryFilter === 'equip') return it.category === 'equip';
        if (this.currentInventoryFilter === 'consumable') return it.category === 'consumable';
        if (this.currentInventoryFilter === 'material') return it.category === 'material';
        return true;
      });

      filtered.forEach((it) => {
        const isEquipped = (eq.weapon && eq.weapon.uid === it.uid) ||
                           (eq.armor && eq.armor.uid === it.uid) ||
                           (eq.accessory && eq.accessory.uid === it.uid);

        const cell = document.createElement('div');
        cell.className = `grid-cell ${isEquipped ? 'equipped' : ''}`;
        cell.innerHTML = `
          <div>
            <b>${it.name}</b>
            ${isEquipped ? '<div class="tag-equipped">[EQUIPADO]</div>' : ''}
          </div>
          <span style="color:#888;font-size:9px">${it.count ? `x${it.count}` : it.type}</span>
        `;

        // Click simple: inspeccionar
        cell.onclick = () => {
          this.inspectItem(it);
        };

        // Doble click: equipar directo
        cell.ondblclick = () => {
          this.quickEquipItem(it);
        };

        grid.appendChild(cell);
      });
    }

    inspectItem(it) {
      const el = document.getElementById('item-inspect');
      el.innerHTML = `
        <b>${it.name}</b> (${it.type})<br>
        ${it.atk ? `Ataque: +${it.atk + (this.player.weaponPlus * 3)}<br>` : ''}
        ${it.def ? `Defensa: +${it.def}<br>` : ''}
        ${it.value ? `Efecto: Restaura ${it.value} HP<br>` : ''}
        ${it.desc ? `<i>${it.desc}</i><br>` : ''}
        <button onclick="game.quickEquipItemByUid(${it.uid})">${it.category === 'equip' ? 'Equipar / Desequipar' : 'Usar'}</button>
      `;
    }

    quickEquipItemByUid(uid) {
      const it = this.player.inventory.find(i => i.uid === uid);
      if (it) this.quickEquipItem(it);
    }

    quickEquipItem(it) {
      const eq = this.player.equipped;
      if (it.category === 'equip') {
        if (it.type === 'weapon') {
          eq.weapon = (eq.weapon && eq.weapon.uid === it.uid) ? null : it;
          sfx.slash();
          this.toast(eq.weapon ? `Equipaste ${it.name}` : `Desequipaste ${it.name}`);
        } else if (it.type === 'armor') {
          eq.armor = (eq.armor && eq.armor.uid === it.uid) ? null : it;
          sfx.dash();
          this.toast(eq.armor ? `Equipaste ${it.name}` : `Desequipaste ${it.name}`);
        } else if (it.type === 'accessory') {
          eq.accessory = (eq.accessory && eq.accessory.uid === it.uid) ? null : it;
          sfx.secret();
          this.toast(eq.accessory ? `Equipaste ${it.name}` : `Desequipaste ${it.name}`);
        }
      } else if (it.category === 'consumable' && it.type === 'heal') {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + it.value);
        sfx.potion();
        this.toast(`Consumiste ${it.name}.`);
        it.count = (it.count || 1) - 1;
        if (it.count <= 0) {
          const idx = this.player.inventory.indexOf(it);
          if (idx !== -1) this.player.inventory.splice(idx, 1);
        }
      }
      this.updateInventoryTab();
      this.updateHUD();
    }

    unequipSlot(slotName) {
      if (this.player.equipped[slotName]) {
        const item = this.player.equipped[slotName];
        this.player.equipped[slotName] = null;
        this.toast(`Desequipaste [${item.name}]`);
        sfx.dash();
        this.updateInventoryTab();
        this.updateHUD();
      }
    }

    usePotion() {
      const p = this.player;
      if (p.potions > 0 && p.hp < p.maxHp) {
        p.potions--;
        p.hp = Math.min(p.maxHp, p.hp + 50);
        sfx.potion();
        this.toast('Poción Carmesí consumida (+50 HP)');
        this.updateHUD();
      }
    }

    // ==========================================
    // 12. MAPA, SALIDAS Y BALTASAR ERRANTE
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

      // Limpiar a Baltasar si existía de mapas anteriores
      this.currentMap.interactives = this.currentMap.interactives.filter(i => i.id !== 'baltasar');

      // Aparición aleatoria de Baltasar el Desterrado (15% en zonas fuera del Bastión)
      if (mapId !== 'bastion' && Math.random() < 0.15) {
        this.currentMap.interactives.push({
          id: 'baltasar',
          type: 'npc',
          name: 'Baltasar el Desterrado',
          x: mapId === 'swamp' ? 210 : 340,
          y: mapId === 'swamp' ? 380 : 380,
          w: 28,
          h: 28,
          color: '#8e44ad'
        });
        this.toast('¡Una presencia errante acecha en las sombras!');
      }

      this.toast(this.currentMap.name);
    }

    // ==========================================
    // 13. MODALES, BAÚL Y HUD
    // ==========================================
    showDialog(speaker, text, buttons = null) {
      this.state = 'DIALOG';
      const box = document.getElementById('dialog-box');
      const spk = document.getElementById('dialog-speaker');
      const cnt = document.getElementById('dialog-content');
      const acts = document.getElementById('dialog-actions');

      spk.innerText = speaker;
      cnt.innerText = text;
      acts.innerHTML = '';

      if (buttons && buttons.length > 0) {
        buttons.forEach(b => {
          const btn = document.createElement('button');
          btn.className = 'tab-btn';
          btn.innerText = b.label;
          btn.onclick = () => { b.action(); };
          acts.appendChild(btn);
        });
      }

      box.classList.remove('hidden');
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
      const alloc = document.getElementById('stat-allocation');
      if (p.unallocatedStats > 0) {
        alloc.classList.remove('hidden');
        document.getElementById('stat-points').innerText = p.unallocatedStats;
        document.getElementById('stat-str').innerText = p.stats.str;
        document.getElementById('stat-dex').innerText = p.stats.dex;
        document.getElementById('stat-vit').innerText = p.stats.vit;
        document.getElementById('stat-int').innerText = p.stats.int;
      } else {
        alloc.classList.add('hidden');
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
      el.classList.remove('hidden');
      clearTimeout(this.toastTimeout);
      this.toastTimeout = setTimeout(() => { el.classList.add('hidden'); }, 2200);
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
    // 14. GUARDADO / PERSISTENCIA
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
      if (manual) this.toast('¡Progreso guardado!');
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
      this.toast('¡Código exportado correctamente!');
    }

    importSave() {
      const io = document.getElementById('save-io');
      try {
        const raw = atob(io.value.trim());
        const data = JSON.parse(raw);
        localStorage.setItem('aethelgard_save', JSON.stringify(data));
        this.loadGame();
        this.updateHUD();
        this.toast('¡Partida restaurada con éxito!');
        this.togglePauseMenu();
      } catch (e) {
        this.toast('Código de guardado inválido.');
      }
    }

    // ==========================================
    // 15. RENDERIZADO VISUAL MODERNO (Y-SORTING, SOMBRAS Y LUZ)
    // ==========================================
    render() {
      const ctx = this.ctx;
      ctx.save();

      if (this.shakeDuration > 0) {
        const ox = (Math.random() - 0.5) * this.shakeIntensity;
        const oy = (Math.random() - 0.5) * this.shakeIntensity;
        ctx.translate(ox, oy);
      }

      // 1. Fondo del mapa
      ctx.fillStyle = this.currentMap.bgColor || '#111';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // 2. Muros
      ctx.fillStyle = '#222b38';
      (this.currentMap.walls || []).forEach(w => {
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.strokeStyle = '#151b24';
        ctx.strokeRect(w.x, w.y, w.w, w.h);
      });

      // 3. PIPELINE DE ENTIDADES CON Y-SORTING (Profundidad Visual 2.5D)
      const renderables = [];

      (this.currentMap.interactives || []).forEach(obj => {
        renderables.push({ type: 'interactive', y: obj.y + obj.h, data: obj });
      });

      (this.currentMap.enemies || []).forEach(en => {
        renderables.push({ type: 'enemy', y: en.y + 24, data: en });
      });

      const p = this.player;
      renderables.push({ type: 'player', y: p.y + p.h, data: p });

      // Ordenar por eje Y (quien esté más abajo se dibuja encima)
      renderables.sort((a, b) => a.y - b.y);

      // 4. Dibujar entidades ordenadas
      renderables.forEach(r => {
        if (r.type === 'interactive') {
          const obj = r.data;
          this.drawShadow(ctx, obj.x + obj.w / 2, obj.y + obj.h, obj.w / 2);
          ctx.fillStyle = obj.color || '#fff';
          ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
          ctx.strokeStyle = '#000';
          ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);

          ctx.fillStyle = '#f1c40f';
          ctx.font = '9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(obj.name, obj.x + obj.w / 2, obj.y - 4);
        } else if (r.type === 'enemy') {
          const en = r.data;
          this.drawShadow(ctx, en.x + 12, en.y + 24, 11);
          ctx.fillStyle = en.color || '#e74c3c';
          ctx.fillRect(en.x, en.y, 24, 24);

          ctx.fillStyle = '#c0392b';
          ctx.fillRect(en.x, en.y - 6, 24, 3);
          ctx.fillStyle = '#2ecc71';
          ctx.fillRect(en.x, en.y - 6, (en.hp / en.maxHp) * 24, 3);
        } else if (r.type === 'player') {
          this.drawShadow(ctx, p.x + p.w / 2, p.y + p.h, 10);
          ctx.fillStyle = (p.iFrames > 0 && Math.floor(this.gameTicks / 4) % 2 === 0) ? 'rgba(255,255,255,0.4)' : '#3498db';
          ctx.fillRect(p.x, p.y, p.w, p.h);
          ctx.strokeStyle = '#1d6fa5';
          ctx.strokeRect(p.x, p.y, p.w, p.h);

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
        }
      });

      // 5. Partículas y textos flotantes
      this.particles.forEach(pt => {
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x, pt.y, 3, 3);
      });

      this.floatTexts.forEach(ft => {
        ctx.fillStyle = ft.color;
        ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.globalAlpha = 1.0;
      });

      // 6. ILUMINACIÓN DINÁMICA NOCTURNA CON RECORTE RADIAL
      if (this.dayTime > 0.4) {
        const nightAlpha = (this.dayTime - 0.4) * 0.85;

        // Crear lienzo de sombra con linterna alrededor del jugador
        const lightCanvas = document.createElement('canvas');
        lightCanvas.width = CANVAS_WIDTH;
        lightCanvas.height = CANVAS_HEIGHT;
        const lctx = lightCanvas.getContext('2d');

        lctx.fillStyle = `rgba(5, 8, 20, ${nightAlpha})`;
        lctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Recorte de luz radial en torno al jugador
        lctx.globalCompositeOperation = 'destination-out';
        const radGrad = lctx.createRadialGradient(p.x + p.w / 2, p.y + p.h / 2, 10, p.x + p.w / 2, p.y + p.h / 2, 110);
        radGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
        radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        lctx.fillStyle = radGrad;
        lctx.beginPath();
        lctx.arc(p.x + p.w / 2, p.y + p.h / 2, 110, 0, Math.PI * 2);
        lctx.fill();

        ctx.drawImage(lightCanvas, 0, 0);
      }

      // Tinte de temporada
      if (CURRENT_SEASON.tint) {
        ctx.fillStyle = CURRENT_SEASON.tint;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }

      // Superposición de pesca
      if (this.state === 'FISHING') {
        const fb = this.fishingBar;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(170, 200, 300, 50);
        ctx.strokeStyle = '#d4af37';
        ctx.strokeRect(170, 200, 300, 50);

        const targetW = ((fb.targetMax - fb.targetMin) / 100) * 280;
        const targetX = 180 + (fb.targetMin / 100) * 280;
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(targetX, 210, targetW, 30);

        const cursorX = 180 + (fb.pos / 100) * 280;
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(cursorX - 2, 205, 4, 40);

        ctx.fillStyle = '#fff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('¡PULSA [ESPACIO], [E] O BOTÓN EN LA ZONA VERDE!', 320, 190);
      }

      ctx.restore();
    }

    drawShadow(ctx, cx, cy, radius) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 2, radius, radius * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    rectIntersect(x1, y1, w1, h1, x2, y2, w2, h2) {
      return !(x2 > x1 + w1 || x2 + w2 < x1 || y2 > y1 + h1 || y2 + h2 < y1);
    }

    checkWallCollision(x, y, w, h) {
      const walls = this.currentMap.walls || [];
      for (let wall of walls) {
        if (this.rectIntersect(x, y, w, h, wall.x, wall.y, wall.w, wall.h)) return true;
      }
      return false;
    }
  }

  window.addEventListener('load', () => {
    window.game = new GameEngine();
    window.game.start();
  });
})();
