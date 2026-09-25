// -----------------------------------------------------------------------------
// Bastion Line — renderer 3D (ponto de entrada)
//
// O núcleo do jogo (index.html) continua rodando inteiramente em coordenadas
// lógicas 2D. Este módulo apenas *lê* esse estado a cada frame e mantém uma
// cena three.js em sincronia. Se o WebGL não estiver disponível, nada é
// anexado e o jogo segue no canvas 2D original.
// -----------------------------------------------------------------------------
import { THREE, PAL, HORIZON, makeMap, hexInt, glow, damp } from './core.js?v=campaign-art-1';
import { createSky, createLights, createBoard, createEnvironment, createIndicators } from './world.js?v=campaign-art-1';
import {
  buildTower, buildEnemy, buildWorker, buildMinion,
  animateTower, animateEnemy, animateWorker, pokeRecoil
} from './actors.js?v=campaign-art-1';
import { createEffects } from './fx.js?v=campaign-art-1';
import { createOverlay } from './overlay.js';

// Câmera calcada na de Warcraft III, cujos padrões são ângulo de ataque 304,
// campo de visão 70 e distância ao alvo 1650. Em WC3, 360 grau é a horizontal e
// 270 aponta direto para baixo, então 304 equivale a 56 graus acima do horizonte.
// O que dá o "olhar de RTS" não é a inclinação — é o campo de visão largo com a
// câmera perto: a perspectiva diverge, e o tabuleiro deixa de parecer maquete.
const PITCH = 56 * Math.PI / 180;
const FOV = 70;
const FIT_MARGIN = 0.95;               // folga ao enquadrar a janela de visão

// A câmera enquadra uma janela de VIEW_ROWS linhas por vez, não o tabuleiro
// (7×14) inteiro, e o jogador anda por ela.
const VIEW_ROWS = 7;

// Zoom e deslocamento seguem Warcraft III e Age of Empires: a RODA DÁ ZOOM nos
// dois, e quem anda pelo mapa são teclas e arrasto. O WC3 clássico vai de 1250
// a 1650 de distância — ou seja, apenas 0,76× para dentro, e o padrão já é o
// mais afastado. Aqui a faixa é mais generosa, à moda do AoE: entra bem mais
// perto, e o limite de saída é calculado para caber o tabuleiro inteiro, que é
// a visão que um tower defense exige para planejar.
const ZOOM_MIN = 0.5;                  // multiplicador da distância de enquadre
const ZOOM_WHEEL = 0.0016;             // por "tick" de roda
const ZOOM_KEY = 0.9;                  // por segundo, nas teclas +/-
const PAN_SPEED = 4.4;                 // unidades de mundo por segundo (teclado)
const PAN_SMOOTH = 0.00002;            // suavização do damp() por segundo
const DRAG_THRESHOLD = 4;              // pixels antes de um clique virar arrasto

// Altura aproximada de cada inimigo em unidades locais (antes da escala do raio).
const ENEMY_HEIGHT = {
  grunt: 0.78, raider: 0.82, brute: 0.68, swarmling: 0.62,
  reaver: 0.95, orc: 0.85, wolf: 0.55, troll: 0.95,
  golem: 0.95, shaman: 0.85, assassin: 0.8, harpy: 0.8,
  warlord: 1.1, boss: 1.15, deathking: 1.1
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
  let panX = 0, panXTarget = 0;
  let zoom = 1, zoomTarget = 1, zoomMax = 1;
  let panLimitX = 0;
  const drag = { ativo: false, botao: -1, x: 0, y: 0, andou: 0 };
  const keys = { up: false, down: false, left: false, right: false, zoomIn: false, zoomOut: false };

  let lastTime = 0;
  let resizeObserver = null;
  let onKeyDown = null, onKeyUp = null;

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
    renderer.toneMappingExposure = 1.08;
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
    // Como no WC3, a visão inicial já é a mais afastada: o jogador vê o campo
    // inteiro e aproxima quando quiser.
    reenquadrar();
    updateCameraPosition(null);
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
    const target = new THREE.Vector3(0, 0.35, 0);

    // Com campo de visão largo, cada unidade de folga em volta da janela sai
    // cara: a câmera recua muito para acomodá-la. Por isso os pontos abraçam
    // só a largura do tabuleiro e a altura da janela visível.
    const ex = map.halfW + 0.55;
    function pontos(halfRows) {
      const out = [];
      for (let sx = -1; sx <= 1; sx += 2) {
        out.push(new THREE.Vector3(sx * ex, 0, -halfRows));
        out.push(new THREE.Vector3(sx * ex, 0.9, -halfRows));
        out.push(new THREE.Vector3(sx * ex, 0, halfRows));
        out.push(new THREE.Vector3(sx * ex, 0.9, halfRows));
      }
      return out;
    }
    let pts = pontos(VIEW_ROWS / 2);

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

    function busca() {
      let lo = 4, hi = 90;
      if (!fits(hi)) return hi;
      for (let i = 0; i < 34; i++) {
        const midDist = (lo + hi) / 2;
        if (fits(midDist)) hi = midDist; else lo = midDist;
      }
      return hi;
    }

    camDistance = busca();

    // O limite de afastamento não é um número escolhido a dedo: é a distância
    // em que o tabuleiro inteiro cabe, dividida pela da janela. Assim continua
    // certo em qualquer proporção de tela.
    pts = pontos(map.halfH + 0.5);
    zoomMax = Math.max(1.05, busca() / camDistance);
    zoomTarget = Math.min(zoomMax, Math.max(ZOOM_MIN, zoomTarget));

    aplicarLimitesDePasseio();

    // A sombra acompanha o tabuleiro inteiro, não a janela visível.
    lights.key.target.position.set(0, 0, 0);
    lights.key.target.updateMatrixWorld();
  }

  /** Aplica a posição de câmera atual (distância fixa + passeio suavizado). */
  /**
   * Quanto dá para passear depende do zoom: afastado até o tabuleiro inteiro
   * caber, não há para onde ir; aproximado, sobra mapa dos dois lados. Calcular
   * a partir da janela visível evita o passeio para o vazio.
   */
  function aplicarLimitesDePasseio() {
    const linhasVisiveis = VIEW_ROWS * zoomTarget;
    panLimit = Math.max(0, map.halfH - linhasVisiveis / 2 + 0.4);
    // Na largura só há o que percorrer quando a janela fica menor que o tabuleiro.
    const colunasVisiveis = (map.COLS + 1.1) * zoomTarget;
    panLimitX = Math.max(0, map.halfW - colunasVisiveis / 2 + 0.3);
    panZTarget = Math.min(panLimit, Math.max(-panLimit, panZTarget));
    panXTarget = Math.min(panLimitX, Math.max(-panLimitX, panXTarget));
  }

  function updateCameraPosition(dt) {
    if (dt === null) {
      panZ = panZTarget; panX = panXTarget; zoom = zoomTarget;
    } else {
      panZ = damp(panZ, panZTarget, PAN_SMOOTH, dt);
      panX = damp(panX, panXTarget, PAN_SMOOTH, dt);
      zoom = damp(zoom, zoomTarget, PAN_SMOOTH, dt);
    }
    const target = new THREE.Vector3(panX, 0.35, 0.55 + panZ);
    camera.position.copy(target).addScaledVector(camDir, camDistance * zoom);
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
  }

  /** Ponto do chão sob um pixel da tela, ou null se o raio não encontrar o plano. */
  function pontoNoChao(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    return raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3());
  }

  /**
   * Zoom mantendo sob o cursor o ponto que já estava lá — é como o Age of
   * Empires se comporta, e sem isso aproximar joga o alvo para fora da tela.
   */
  function aplicarZoom(delta, clientX, clientY) {
    const antes = zoomTarget;
    zoomTarget = Math.min(zoomMax, Math.max(ZOOM_MIN, zoomTarget + delta));
    if (zoomTarget === antes) return;

    if (clientX !== undefined) {
      const p = pontoNoChao(clientX, clientY);
      if (p) {
        const f = 1 - zoomTarget / antes;
        panXTarget += (p.x - panXTarget) * f;
        panZTarget += (p.z - 0.55 - panZTarget) * f;
      }
    }
    aplicarLimitesDePasseio();
  }

  function reenquadrar() {
    zoomTarget = zoomMax;
    panXTarget = 0;
    panZTarget = 0;
    aplicarLimitesDePasseio();
  }

  /**
   * Controles de câmera, no arranjo que Warcraft III e Age of Empires usam: a
   * roda dá zoom, e quem anda pelo mapa são as teclas e o arrasto.
   *
   * Não há rolagem de borda, que os dois têm. Neles a interface é uma barra
   * sólida que barra o ponteiro; aqui os painéis flutuam sobre o tabuleiro, e
   * a câmera sairia andando toda vez que o jogador fosse até a loja.
   */
  function setupCameraControls() {
    const el = renderer.domElement;

    el.addEventListener('wheel', function (e) {
      e.preventDefault();
      aplicarZoom(e.deltaY * ZOOM_WHEEL, e.clientX, e.clientY);
    }, { passive: false });

    // Botão do meio ou direito arrastam. O esquerdo fica livre para o jogo.
    el.addEventListener('pointerdown', function (e) {
      if (e.button !== 1 && e.button !== 2) return;
      drag.ativo = true; drag.botao = e.button;
      drag.x = e.clientX; drag.y = e.clientY; drag.andou = 0;
      el.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    el.addEventListener('pointermove', function (e) {
      if (!drag.ativo) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      drag.andou += Math.abs(dx) + Math.abs(dy);
      // Converte pixels em unidades de mundo pela escala atual da cena.
      const escala = camDistance * zoom / Math.max(1, container.clientHeight) * 1.9;
      panXTarget -= dx * escala;
      panZTarget -= dy * escala / Math.sin(PITCH);
      aplicarLimitesDePasseio();
    });
    function soltar(e) {
      if (!drag.ativo) return;
      const eraDireito = drag.botao === 2;
      const andou = drag.andou;
      drag.ativo = false;
      try { el.releasePointerCapture(e.pointerId); } catch (err) { /* já solto */ }
      // Clique direito parado cancela a construção; com arrasto, era câmera.
      if (eraDireito && andou <= DRAG_THRESHOLD && game.cancelPlacing) game.cancelPlacing();
    }
    el.addEventListener('pointerup', soltar);
    el.addEventListener('pointercancel', soltar);

    // O menu de contexto é sempre engolido: no Chrome ele dispara no PRESSIONAR,
    // antes de existir qualquer arrasto, então não dá para decidir aqui se o
    // gesto era câmera ou cancelamento. Quem decide é o soltar, acima.
    el.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      e.stopPropagation();
    }, true);

    // Toque: um dedo é do jogo, dois dedos são da câmera (pinça e arrasto).
    const toques = new Map();
    let pinca = 0, centro = null;
    el.addEventListener('touchstart', function (e) {
      for (const t of e.changedTouches) toques.set(t.identifier, t);
      if (toques.size === 2) { pinca = distTouches(e.touches); centro = centroTouches(e.touches); }
    }, { passive: true });
    el.addEventListener('touchmove', function (e) {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const d = distTouches(e.touches), c = centroTouches(e.touches);
      if (pinca > 0 && d > 0) aplicarZoom((pinca - d) * 0.004, c.x, c.y);
      if (centro) {
        const escala = camDistance * zoom / Math.max(1, container.clientHeight) * 1.9;
        panXTarget -= (c.x - centro.x) * escala;
        panZTarget -= (c.y - centro.y) * escala / Math.sin(PITCH);
        aplicarLimitesDePasseio();
      }
      pinca = d; centro = c;
    }, { passive: false });
    function fimToque(e) {
      for (const t of e.changedTouches) toques.delete(t.identifier);
      if (toques.size < 2) { pinca = 0; centro = null; }
    }
    el.addEventListener('touchend', fimToque, { passive: true });
    el.addEventListener('touchcancel', fimToque, { passive: true });

    onKeyDown = function (e) {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = true;
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = true;
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
      else if (e.code === 'Equal' || e.code === 'NumpadAdd') keys.zoomIn = true;
      else if (e.code === 'Minus' || e.code === 'NumpadSubtract') keys.zoomOut = true;
      else if (e.code === 'Home') { reenquadrar(); }
      else return;
      e.preventDefault();
    };
    onKeyUp = function (e) {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = false;
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = false;
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
      else if (e.code === 'Equal' || e.code === 'NumpadAdd') keys.zoomIn = false;
      else if (e.code === 'Minus' || e.code === 'NumpadSubtract') keys.zoomOut = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  }

  function distTouches(t) {
    return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  }
  function centroTouches(t) {
    return { x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 };
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
        if (e.fx.cloaked && !u.ignoresCloak) continue;
        if (e.flying ? u.targets === 'ground' : u.targets === 'air') continue;
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
        healing: e.fx.healing,
        cloaked: e.fx.cloaked
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
      // Quem está oculto não mostra barra: era ela que entregava a posição
      // exata do Assassino, apesar de a malha já sumir.
      if (e.fx.cloaked) continue;
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
    // Limita o passo em vez de substituí-lo: trocar um frame longo por 0,016
    // fazia a câmera arrastar quase parada em máquina lenta, já que o passo do
    // teclado é proporcional a dt.
    if (!(dt > 0)) dt = 0.016;
    else if (dt > 0.05) dt = 0.05;
    lastTime = perfNow;

    // O passo do teclado acompanha o zoom: aproximado, andar depressa demais
    // desorienta; afastado, andar devagar demais arrasta.
    const passo = PAN_SPEED * dt * zoom;
    if (keys.up) panZTarget -= passo;
    if (keys.down) panZTarget += passo;
    if (keys.left) panXTarget -= passo;
    if (keys.right) panXTarget += passo;
    if (keys.zoomIn) aplicarZoom(-ZOOM_KEY * dt);
    if (keys.zoomOut) aplicarZoom(ZOOM_KEY * dt);
    if (keys.up || keys.down || keys.left || keys.right) aplicarLimitesDePasseio();
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
    if (onKeyDown) { window.removeEventListener('keydown', onKeyDown); onKeyDown = null; }
    if (onKeyUp) { window.removeEventListener('keyup', onKeyUp); onKeyUp = null; }
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
  const ok = game.attachRenderer(createRenderer3D());
  if (ok) console.info('[Bastion Line] renderer 3D ativo (three.js).');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

export { createRenderer3D };
