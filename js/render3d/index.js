// -----------------------------------------------------------------------------
// Bastion Line — renderer 3D (ponto de entrada)
//
// O núcleo do jogo (index.html) continua rodando inteiramente em coordenadas
// lógicas 2D. Este módulo apenas *lê* esse estado a cada frame e mantém uma
// cena three.js em sincronia. Se o WebGL não estiver disponível, nada é
// anexado e o jogo segue no canvas 2D original.
// -----------------------------------------------------------------------------
import { THREE, PAL, HORIZON, makeMap, hexInt, glow, damp } from './core.js';
import { createSky, createLights, createBoard, createEnvironment, createIndicators } from './world.js';
import {
  buildTower, buildEnemy, buildWorker, buildMinion,
  animateTower, animateEnemy, animateWorker, pokeRecoil
} from './actors.js';
import { preloadTowerKit } from './towerKit.js';
import { createEffects } from './fx.js';
import { createOverlay } from './overlay.js';

// Câmera calcada na de Warcraft III, cujos padrões são ângulo de ataque 304,
// campo de visão 70 e distância ao alvo 1650. Em WC3, 360 grau é a horizontal e
// 270 aponta direto para baixo, então 304 equivale a 56 graus acima do horizonte.
// O que dá o "olhar de RTS" não é a inclinação — é o campo de visão largo com a
// câmera perto: a perspectiva diverge, e o tabuleiro deixa de parecer maquete.
const PITCH = 56 * Math.PI / 180;
const FOV = 70;
const FIT_MARGIN = 0.95;               // folga ao enquadrar a janela de visão

// A câmera não precisa mais mostrar o tabuleiro (7×14) inteiro: enquadra uma
// janela de VIEW_ROWS linhas por vez, do tamanho do WC3 real, e o jogador anda
// por ela com a roda do mouse ou as setas/WASD.
const VIEW_ROWS = 7;
const PAN_SPEED = 4.4;                 // unidades de mundo por segundo (teclado)
const PAN_WHEEL = 0.0026;              // unidades de mundo por "tick" de roda
const PAN_SMOOTH = 0.00002;            // suavização do damp() por segundo

// Altura aproximada de cada inimigo em unidades locais (antes da escala do raio).
const ENEMY_HEIGHT = {
  grunt: 0.78, raider: 0.82, brute: 0.68, swarmling: 0.62,
  reaver: 0.95, orc: 0.85, wolf: 0.55, troll: 0.95,
  golem: 0.95, shaman: 0.85, harpy: 0.8, boss: 1.15
};

// Altura de voo, em células. Alta o bastante para ler como "acima do alcance
// corpo a corpo" sem sair da moldura da câmera.
const FLIGHT_ALTITUDE = 1.15;

function createRenderer3D() {
  let game, map, container;
  let renderer, scene, camera, overlay;
  let lights, board, environment, indicators, effects;

  const towerMeshes = new Map();   // unit.id  -> { group, sig }
  const enemyMeshes = new Map();   // enemy.id -> group
  const minionMeshes = new Map();  // minion.id -> group
  const ghostCache = new Map();    // tipo     -> grupo translúcido de pré-visualização
  let worker = null;
  let ghost = null;

  const pickables = [];
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const seenFX = new WeakSet();
  const camDir = new THREE.Vector3(0, Math.sin(PITCH), Math.cos(PITCH)).normalize();

  // Câmera: distância fixa (recalculada só quando a tela muda de tamanho) e
  // deslocamento ao longo do corredor (linhas), que o jogador controla.
  let camDistance = 12;
  let panLimit = 0;
  let panZ = 0, panZTarget = 0;
  const keys = { up: false, down: false };

  let lastTime = 0;
  let resizeObserver = null;

  // Qualidade adaptativa: em máquina fraca o renderer desce de degrau sozinho.
  // Só desce, nunca sobe — subir de volta causaria oscilação visível.
  const quality = { level: 0, warmup: 90, frames: 0, accum: 0 };

  // -------------------------------------------------------------------------
  // Montagem
  // -------------------------------------------------------------------------
  function mount(el, gameApi) {
    container = el;
    game = gameApi;
    map = makeMap(game.COLS, game.ROWS, game.CELL);

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    // Lança se o contexto WebGL não puder ser criado — tratado por quem chama.
    renderer.setPixelRatio(Math.min(1.6, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.16;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = 'layer3d';
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    // O tabuleiro fica entre ~9 e ~15 unidades da câmera e o chão visível acaba
    // por volta de 25: a névoa precisa caber nessa janela estreita para o cenário
    // distante chegar saturado ao horizonte sem tocar na área de jogo.
    scene.fog = new THREE.Fog(HORIZON, 16.5, 30);
    scene.add(createSky());

    camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 220);
    scene.add(camera);

    lights = createLights(scene, map);
    board = createBoard(scene, map);
    environment = createEnvironment(scene, map);
    indicators = createIndicators(scene);
    effects = createEffects(scene, map);

    worker = buildWorker();
    worker.scale.setScalar(1.12);
    worker.userData.pickTarget = { x: 0, y: 0 };
    scene.add(worker);
    pickables.push(worker);

    overlay = createOverlay(container);
    setupCameraControls();

    resize();
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(function () { resize(); });
      resizeObserver.observe(container);
    }
    lastTime = performance.now();
  }

  // -------------------------------------------------------------------------
  // Câmera e viewport
  // -------------------------------------------------------------------------

  /**
   * Calcula a distância que enquadra uma janela de VIEW_ROWS linhas — não o
   * tabuleiro inteiro (14 linhas). Busca binária sobre a distância: funciona
   * para qualquer proporção de tela. Recalculada só no resize; o passeio pelo
   * corredor é feito ajustando panZ, sem repetir essa busca a cada frame.
   */
  function fitCameraDistance() {
    const halfView = VIEW_ROWS / 2;
    const target = new THREE.Vector3(0, 0.35, 0);

    // Com campo de visão largo, cada unidade de folga em volta da janela sai
    // cara: a câmera recua muito para acomodá-la. Por isso os pontos abraçam
    // só a largura do tabuleiro e a altura da janela visível.
    const pts = [];
    const ex = map.halfW + 0.55;
    for (let sx = -1; sx <= 1; sx += 2) {
      pts.push(new THREE.Vector3(sx * ex, 0, -halfView));
      pts.push(new THREE.Vector3(sx * ex, 0.9, -halfView));
      pts.push(new THREE.Vector3(sx * ex, 0, halfView));
      pts.push(new THREE.Vector3(sx * ex, 0.9, halfView));
    }

    function fits(distance) {
      camera.position.copy(target).addScaledVector(camDir, distance);
      camera.lookAt(target);
      camera.updateMatrixWorld(true);
      camera.updateProjectionMatrix();
      for (let i = 0; i < pts.length; i++) {
        tmp.copy(pts[i]).project(camera);
        if (Math.abs(tmp.x) > FIT_MARGIN || Math.abs(tmp.y) > FIT_MARGIN) return false;
      }
      return true;
    }

    let lo = 4, hi = 60;
    if (!fits(hi)) { lo = hi; } else {
      for (let i = 0; i < 34; i++) {
        const midDist = (lo + hi) / 2;
        if (fits(midDist)) hi = midDist; else lo = midDist;
      }
    }
    camDistance = hi;

    // Até onde dá para passear: a janela não pode sair da área jogável.
    panLimit = Math.max(0, map.halfH - halfView + 0.4);
    panZTarget = Math.min(panLimit, Math.max(-panLimit, panZTarget));

    // A sombra acompanha o tabuleiro inteiro, não a janela visível.
    lights.key.target.position.set(0, 0, 0);
    lights.key.target.updateMatrixWorld();
  }

  /** Aplica a posição de câmera atual (distância fixa + passeio suavizado). */
  function updateCameraPosition(dt) {
    panZ = dt === null ? panZTarget : damp(panZ, panZTarget, PAN_SMOOTH, dt);
    const target = new THREE.Vector3(0, 0.35, 0.55 + panZ);
    camera.position.copy(target).addScaledVector(camDir, camDistance);
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
  }

  /** Roda do mouse e setas/WASD passeiam a câmera pelo corredor (eixo das linhas). */
  function setupCameraControls() {
    renderer.domElement.addEventListener('wheel', function (e) {
      e.preventDefault();
      panZTarget += e.deltaY * PAN_WHEEL;
      panZTarget = Math.min(panLimit, Math.max(-panLimit, panZTarget));
    }, { passive: false });

    window.addEventListener('keydown', function (e) {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = true;
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = true;
      else return;
      e.preventDefault();
    });
    window.addEventListener('keyup', function (e) {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = false;
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = false;
    });
  }

  function resize() {
    if (!renderer || !container) return;
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + 'px';
    renderer.domElement.style.height = h + 'px';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fitCameraDistance();
    updateCameraPosition(null);
    overlay.resize(w, h, Math.min(2, window.devicePixelRatio || 1));
  }

  /** Projeta um ponto de mundo para pixels CSS da viewport. */
  function project(v) {
    tmp2.copy(v).project(camera);
    return {
      x: (tmp2.x * 0.5 + 0.5) * container.clientWidth,
      y: (-tmp2.y * 0.5 + 0.5) * container.clientHeight,
      visible: tmp2.z < 1
    };
  }

  /** Quantos pixels CSS vale 1 unidade de mundo na posição informada. */
  function pixelsPerUnit(v) {
    const a = project(v);
    tmp.copy(v).add(tmp2.set(camera.matrixWorld.elements[0], camera.matrixWorld.elements[1], camera.matrixWorld.elements[2]));
    const b = project(tmp);
    return Math.hypot(b.x - a.x, b.y - a.y) || 1;
  }

  // -------------------------------------------------------------------------
  // Entrada: tela -> coordenadas lógicas do jogo
  // -------------------------------------------------------------------------
  function screenToLogical(clientX, clientY) {
    if (!renderer) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);

    // Clicar numa torre ou no Mestre de Obras deve valer pela célula dele,
    // não pelo chão que aparece atrás da malha.
    const hits = raycaster.intersectObjects(pickables, true);
    for (let i = 0; i < hits.length; i++) {
      let o = hits[i].object;
      while (o) {
        if (o.userData && o.userData.pickTarget) {
          return { x: o.userData.pickTarget.x, y: o.userData.pickTarget.y };
        }
        o = o.parent;
      }
    }

    const p = raycaster.ray.intersectPlane(groundPlane, tmp);
    if (!p) return null;
    return { x: map.toLogicalX(p.x), y: map.toLogicalY(p.z) };
  }

  // -------------------------------------------------------------------------
  // Sincronização de atores com o estado do jogo
  // -------------------------------------------------------------------------
  function removePickable(obj) {
    const i = pickables.indexOf(obj);
    if (i >= 0) pickables.splice(i, 1);
  }

  function towerSignature(u) {
    return u.type + '|' + u.tier + '|' + (u.branch || '-') + '|' + u.color;
  }

  /** Dá recuo às torres que acabaram de disparar neste frame. */
  function processNewShots(attackFX, units) {
    for (let i = 0; i < attackFX.length; i++) {
      const f = attackFX[i];
      if (seenFX.has(f)) continue;
      seenFX.add(f);
      if (f.kind !== 'shot') continue;
      for (let j = 0; j < units.length; j++) {
        const u = units[j];
        if (u.x === f.x1 && u.y === f.y1) {
          const entry = towerMeshes.get(u.id);
          if (entry) pokeRecoil(entry.group, 1);
          break;
        }
      }
    }
  }

  function syncTowers(units, enemies, t, dt) {
    const alive = new Set();

    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      alive.add(u.id);

      let entry = towerMeshes.get(u.id);
      const sig = towerSignature(u);
      if (!entry || entry.sig !== sig) {
        if (entry) { scene.remove(entry.group); removePickable(entry.group); }
        const g = buildTower(u.type, u.tier, u.branch, hexInt(u.color));
        g.position.set(map.x(u.x), 0, map.z(u.y));
        g.userData.pickTarget = { x: u.x, y: u.y };
        scene.add(g);
        pickables.push(g);
        entry = { group: g, sig: sig };
        towerMeshes.set(u.id, entry);
      }

      // Mira: inimigo mais próximo dentro do alcance
      let bestD2 = Infinity, tx = null, tz = null;
      const r2 = u.range * u.range;
      for (let j = 0; j < enemies.length; j++) {
        const e = enemies[j];
        const dx = e.x - u.x, dy = e.y - u.y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= r2 && d2 < bestD2) { bestD2 = d2; tx = e.x; tz = e.y; }
      }
      const gx = entry.group.position.x, gz = entry.group.position.z;
      const yaw = tx === null
        ? Math.PI                                   // em repouso, encara o portal
        : Math.atan2(map.x(tx) - gx, map.z(tz) - gz);

      animateTower(entry.group, { yaw: yaw }, t, dt);
    }

    towerMeshes.forEach(function (entry, id) {
      if (!alive.has(id)) {
        scene.remove(entry.group);
        removePickable(entry.group);
        towerMeshes.delete(id);
      }
    });
  }

  function syncEnemies(enemies, perfNow, t, dt) {
    const alive = new Set();

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      alive.add(e.id);

      let g = enemyMeshes.get(e.id);
      if (!g) {
        g = buildEnemy(e.type, hexInt(e.color), map.len(e.r),
                       e.aura ? map.len(e.aura.range) : 0);
        g.userData.height = (ENEMY_HEIGHT[e.type] || 0.8) * g.scale.y;
        scene.add(g);
        enemyMeshes.set(e.id, g);
      }

      const wx = map.x(e.x), wz = map.z(e.y);
      g.position.x = wx;
      g.position.z = wz;
      // Voadores pairam acima do tabuleiro; o resto anda no chão.
      const alt = e.flying ? FLIGHT_ALTITUDE : 0;
      g.position.y = damp(g.position.y, alt, 0.002, dt);

      // Encara o próximo ponto do caminho
      const wp = e.path[e.wpIndex];
      let yaw = g.rotation.y;
      if (wp) {
        const dx = map.x(wp.x) - wx, dz = map.z(wp.y) - wz;
        if (dx * dx + dz * dz > 1e-6) yaw = Math.atan2(dx, dz);
      }

      animateEnemy(g, {
        yaw: yaw,
        moving: !e.fx.fighting,
        speed: e.speed,
        slowed: e.fx.slowed,
        healing: e.fx.healing
      }, t, dt);
    }

    enemyMeshes.forEach(function (g, id) {
      if (!alive.has(id)) {
        scene.remove(g);
        enemyMeshes.delete(id);
      }
    });
  }

  /** Esqueletos invocados: mesma malha do cavaleiro morto, em escala menor. */
  function syncMinions(minions, t, dt) {
    const alive = new Set();
    for (let i = 0; i < minions.length; i++) {
      const m = minions[i];
      alive.add(m.id);
      let g = minionMeshes.get(m.id);
      if (!g) {
        g = buildMinion();
        scene.add(g);
        minionMeshes.set(m.id, g);
      }
      const wx = map.x(m.x), wz = map.z(m.y);
      let yaw = g.rotation.y;
      if (m.target) {
        const dx = map.x(m.target.x) - wx, dz = map.z(m.target.y) - wz;
        if (dx * dx + dz * dz > 1e-6) yaw = Math.atan2(dx, dz);
      }
      g.position.x = wx;
      g.position.z = wz;
      animateEnemy(g, { yaw: yaw, moving: !!m.moving, speed: 60, slowed: false, healing: false }, t, dt);
    }
    minionMeshes.forEach(function (g, id) {
      if (!alive.has(id)) { scene.remove(g); minionMeshes.delete(id); }
    });
  }

  function syncWorker(builder, t, dt) {
    const wx = map.x(builder.x), wz = map.z(builder.y);
    worker.position.x = wx;
    worker.position.z = wz;
    worker.userData.pickTarget.x = builder.x;
    worker.userData.pickTarget.y = builder.y;

    let yaw = Math.PI;
    if (builder.state === 'walking') {
      const dx = map.colX(builder.targetCol) - wx;
      const dz = map.rowZ(builder.targetRow) - wz;
      if (dx * dx + dz * dz > 1e-5) yaw = Math.atan2(dx, dz);
    } else if (builder.state === 'building') {
      yaw = 0;
    }

    animateWorker(worker, {
      yaw: yaw,
      walking: builder.state === 'walking',
      building: builder.state === 'building'
    }, t, dt);
  }

  /** Pré-visualização translúcida da torre a construir, presa ao cursor. */
  function syncGhost(state) {
    const type = state.placing;
    const cell = state.hoverCell;
    const canShow = type && cell && cell.row > 0 && cell.row < game.ROWS - 1 &&
      !state.grid[cell.row][cell.col];

    if (ghost) ghost.visible = false;
    if (!canShow) return;

    let g = ghostCache.get(type);
    if (!g) {
      g = buildTower(type, 1, null, hexInt(game.UNIT_BASE[type].color));
      const ghostMat = new THREE.MeshBasicMaterial({
        color: hexInt(game.UNIT_BASE[type].color),
        transparent: true, opacity: 0.42, depthWrite: false, toneMapped: false
      });
      g.traverse(function (o) {
        if (o.isMesh) { o.material = ghostMat; o.castShadow = false; o.receiveShadow = false; }
      });
      scene.add(g);
      ghostCache.set(type, g);
    }
    ghostCache.forEach(function (other) { other.visible = false; });
    g.visible = true;
    g.position.set(map.colX(cell.col), 0, map.rowZ(cell.row));
    ghost = g;
  }

  // -------------------------------------------------------------------------
  // Camada 2D: vida, dano e veterania
  // -------------------------------------------------------------------------
  function drawOverlay(state, perfNow) {
    overlay.begin();
    const ppuRef = pixelsPerUnit(tmp.set(0, 0.5, 0));

    // Barras de vida acima dos inimigos
    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i];
      const g = enemyMeshes.get(e.id);
      if (!g) continue;
      const top = (g.userData.height || 0.8) + 0.22 + (e.flying ? FLIGHT_ALTITUDE : 0);
      const p = project(tmp.set(g.position.x, top, g.position.z));
      if (!p.visible) continue;
      const scale = pixelsPerUnit(tmp.set(g.position.x, top, g.position.z)) / ppuRef;
      overlay.healthBar(p.x, p.y, Math.max(13, 26 * scale * g.scale.x), e.hp / e.maxHp);
    }

    // Vida dos esqueletos invocados
    for (let i = 0; i < state.minions.length; i++) {
      const m = state.minions[i];
      const g = minionMeshes.get(m.id);
      if (!g || m.hp >= m.maxHp) continue;
      const p = project(tmp.set(g.position.x, 0.62, g.position.z));
      if (!p.visible) continue;
      const scale = pixelsPerUnit(tmp.set(g.position.x, 0.62, g.position.z)) / ppuRef;
      overlay.healthBar(p.x, p.y, Math.max(12, 20 * scale), m.hp / m.maxHp);
    }

    // Vida das torres feridas (só aparece quando há dano a mostrar)
    for (let i = 0; i < state.units.length; i++) {
      const u = state.units[i];
      if (u.hp >= u.maxHp) continue;
      const entry = towerMeshes.get(u.id);
      if (!entry) continue;
      const p = project(tmp.set(entry.group.position.x, 1.15, entry.group.position.z));
      if (!p.visible) continue;
      const scale = pixelsPerUnit(tmp.set(entry.group.position.x, 1.15, entry.group.position.z)) / ppuRef;
      overlay.healthBar(p.x, p.y, Math.max(18, 32 * scale), u.hp / u.maxHp);
    }

    // Galões de veterania sob as torres
    for (let i = 0; i < state.units.length; i++) {
      const u = state.units[i];
      if (!u.vetLevel) continue;
      const entry = towerMeshes.get(u.id);
      if (!entry) continue;
      const p = project(tmp.set(entry.group.position.x, 0.02, entry.group.position.z + 0.42));
      if (!p.visible) continue;
      const scale = pixelsPerUnit(tmp.set(entry.group.position.x, 0.02, entry.group.position.z)) / ppuRef;
      overlay.chevrons(p.x, p.y, u.vetLevel, scale);
    }

    // Números flutuantes: sobem na vertical do mundo, não no plano do tabuleiro
    for (let i = 0; i < state.floatingTexts.length; i++) {
      const f = state.floatingTexts[i];
      const rise = (0.9 - f.life) * (f.vy || 34);    // deslocamento já aplicado em 2D
      const originY = f.y + rise;                    // posição original no tabuleiro
      const p = project(tmp.set(map.x(f.x), 0.55 + map.len(rise), map.z(originY)));
      if (!p.visible) continue;
      const scale = pixelsPerUnit(tmp.set(map.x(f.x), 0.55, map.z(originY))) / ppuRef;
      overlay.floatText(p.x, p.y, f.text, f.color, Math.max(0, Math.min(1, f.life / 0.9)), scale);
    }
  }

  // -------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------
  function render(state, perfNow) {
    const t = perfNow / 1000;
    let dt = (perfNow - lastTime) / 1000;
    if (!(dt > 0) || dt > 0.1) dt = 0.016;
    lastTime = perfNow;

    if (keys.up) panZTarget -= PAN_SPEED * dt;
    if (keys.down) panZTarget += PAN_SPEED * dt;
    if (keys.up || keys.down) panZTarget = Math.min(panLimit, Math.max(-panLimit, panZTarget));
    updateCameraPosition(dt);

    processNewShots(state.attackFX, state.units);
    syncTowers(state.units, state.enemies, t, dt);
    syncEnemies(state.enemies, perfNow, t, dt);
    syncMinions(state.minions, t, dt);
    syncWorker(state.builder, t, dt);
    syncGhost(state);

    // Indicadores no chão
    const cell = state.hoverCell;
    let hoverInfo = null, rangeInfo = null, selInfo = null;
    if (cell) {
      const buildable = cell.row > 0 && cell.row < game.ROWS - 1;
      hoverInfo = {
        x: map.colX(cell.col),
        z: map.rowZ(cell.row),
        valid: buildable && !state.grid[cell.row][cell.col],
        dim: !state.placing
      };
      if (state.placing && buildable) {
        rangeInfo = {
          x: map.colX(cell.col),
          z: map.rowZ(cell.row),
          radius: map.len(game.UNIT_BASE[state.placing].range),
          color: hexInt(game.UNIT_BASE[state.placing].color)
        };
      }
    }
    const sel = state.selectedUnit;
    if (sel) {
      selInfo = { x: map.x(sel.x), z: map.z(sel.y) };
      if (!rangeInfo) {
        rangeInfo = {
          x: map.x(sel.x), z: map.z(sel.y),
          radius: map.len(sel.range),
          color: hexInt(sel.color)
        };
      }
    }
    indicators.update(hoverInfo, rangeInfo, selInfo, t);

    environment.update(t);
    effects.update(state.attackFX, t);

    renderer.render(scene, camera);
    drawOverlay(state, perfNow);
    adaptQuality(dt);
  }

  /**
   * Observa o tempo médio de frame e reduz o custo quando o jogo não sustenta
   * ~18 fps: primeiro a resolução e o mapa de sombra, depois as sombras.
   */
  function adaptQuality(dt) {
    if (quality.level >= 2) return;
    if (quality.warmup > 0) { quality.warmup--; return; }

    quality.frames++;
    quality.accum += dt;
    if (quality.frames < 60) return;

    const avg = quality.accum / quality.frames;
    quality.frames = 0;
    quality.accum = 0;
    if (avg <= 0.055) return;   // ~18 fps ou melhor: mantém a qualidade

    if (quality.level === 0) {
      quality.level = 1;
      renderer.setPixelRatio(1);
      lights.key.shadow.mapSize.set(1024, 1024);
      if (lights.key.shadow.map) {
        lights.key.shadow.map.dispose();
        lights.key.shadow.map = null;
      }
      resize();
      console.info('[Bastion Line] desempenho baixo: resolução e sombras reduzidas.');
    } else {
      quality.level = 2;
      renderer.shadowMap.enabled = false;
      scene.traverse(function (o) { if (o.isMesh && o.material) o.material.needsUpdate = true; });
      console.info('[Bastion Line] desempenho baixo: sombras desativadas.');
    }
  }

  // -------------------------------------------------------------------------
  function dispose() {
    if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
    if (overlay) overlay.dispose();
    if (renderer) {
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    }
    towerMeshes.clear();
    enemyMeshes.clear();
    minionMeshes.clear();
    ghostCache.clear();
    pickables.length = 0;
  }

  return {
    mount: mount,
    render: render,
    resize: resize,
    screenToLogical: screenToLogical,
    dispose: dispose
  };
}

// -----------------------------------------------------------------------------
// Auto-anexo: só assume o desenho se o núcleo do jogo estiver pronto e o
// WebGL funcionar. Qualquer falha mantém o canvas 2D original no comando.
// -----------------------------------------------------------------------------
async function boot() {
  const game = window.BastionLine;
  if (!game || !game.attachRenderer) {
    console.warn('[Bastion Line] núcleo do jogo não encontrado; seguindo em 2D.');
    return;
  }
  // As torres são modelos carregados; sem eles não há o que desenhar em 3D.
  try {
    await preloadTowerKit();
  } catch (err) {
    console.warn('[Bastion Line] peças de torre indisponíveis; seguindo em 2D.', err);
    return;
  }
  const ok = game.attachRenderer(createRenderer3D());
  if (ok) console.info('[Bastion Line] renderer 3D ativo (three.js).');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

export { createRenderer3D };
