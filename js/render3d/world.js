// -----------------------------------------------------------------------------
// Bastion Line — cenário 3D
// Céu, luzes, tabuleiro, ambientação e indicadores de construção.
// -----------------------------------------------------------------------------
import { THREE, PAL, HORIZON, geo, std, glow, mesh, rng, lerp } from './core.js';

const SKY_VERT = [
  'varying vec3 vPos;',
  'void main(){',
  '  vPos = position;',
  '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
  '}'
].join('\n');

const SKY_FRAG = [
  'uniform vec3 topColor;',
  'uniform vec3 midColor;',
  'uniform vec3 botColor;',
  'varying vec3 vPos;',
  'void main(){',
  '  float h = normalize(vPos).y;',
  '  vec3 c = mix(botColor, midColor, smoothstep(-0.25, 0.18, h));',
  '  c = mix(c, topColor, smoothstep(0.12, 0.72, h));',
  '  gl_FragColor = vec4(c, 1.0);',
  '}'
].join('\n');

/** Domo de céu em degradê: crepúsculo quente no horizonte, azul profundo no topo. */
export function createSky() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x435e72) },
      midColor: { value: new THREE.Color(HORIZON) },
      botColor: { value: new THREE.Color(0xc2aa84) }
    },
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(120, 24, 12), material);
  dome.frustumCulled = false;
  return dome;
}

/** Luz do fim de tarde: key direcional com sombra, preenchimento frio e hemisférica. */
export function createLights(scene, map) {
  const hemi = new THREE.HemisphereLight(0xd4dfdd, 0x4c583c, 1.25);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffe5ba, 2.45);
  key.position.set(-7, 14, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.autoUpdate = true;
  key.shadow.bias = -0.0009;
  key.shadow.normalBias = 0.022;

  const cam = key.shadow.camera;
  cam.near = 1;
  cam.far = 46;
  // Mantém o volume de sombra colado no tabuleiro: mais nitidez por texel e
  // menos objetos de cenário entrando no passe de sombra a cada frame.
  cam.left = -(map.halfW + 4.5);
  cam.right = map.halfW + 4.5;
  cam.top = map.halfH + 4.5;
  cam.bottom = -(map.halfH + 4.5);
  cam.updateProjectionMatrix();
  scene.add(key);
  scene.add(key.target);

  // Preenchimento frio vindo do lado oposto, sem sombra: evita pretos chapados.
  const fill = new THREE.DirectionalLight(0x96bdcc, 0.7);
  fill.position.set(8, 7, -9);
  scene.add(fill);

  return { hemi: hemi, key: key, fill: fill };
}

// ---------------------------------------------------------------------------
// Tabuleiro
// ---------------------------------------------------------------------------

/**
 * Constrói o tabuleiro: grama nas células jogáveis e pedra nas fileiras
 * reservadas (spawn e bastião). Usa InstancedMesh — 98 células em 2 draw calls.
 */
export function createBoard(scene, map) {
  const group = new THREE.Group();
  const COLS = map.COLS, ROWS = map.ROWS;
  const rand = rng(0x5eed1);

  const grassCells = [];
  const roadCells = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      (r === 0 || r === ROWS - 1 ? roadCells : grassCells).push([r, c]);
    }
  }

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  // --- grama ---
  const grassGeo = geo('tile-grass', function () { return new THREE.BoxGeometry(0.98, 0.34, 0.98); });
  const grass = new THREE.InstancedMesh(grassGeo, std(0xffffff, { roughness: 0.95 }), grassCells.length);
  grass.receiveShadow = true;
  grass.castShadow = false;
  const tones = [PAL.grass, PAL.grassAlt, PAL.grass];
  for (let i = 0; i < grassCells.length; i++) {
    const r = grassCells[i][0], c = grassCells[i][1];
    dummy.position.set(map.colX(c), -0.17 + rand() * 0.035, map.rowZ(r));
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);
    color.setHex(tones[(rand() * tones.length) | 0]);
    // Variação sutil de luminância por célula — quebra o xadrez uniforme.
    color.multiplyScalar(0.98 + rand() * 0.035);
    grass.setColorAt(i, color);
  }
  grass.instanceMatrix.needsUpdate = true;
  if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
  group.add(grass);

  // --- estrada de pedra (fileiras reservadas) ---
  const roadGeo = geo('tile-road', function () { return new THREE.BoxGeometry(0.99, 0.3, 0.99); });
  const road = new THREE.InstancedMesh(roadGeo, std(0xffffff, { roughness: 0.98 }), roadCells.length);
  road.receiveShadow = true;
  const roadTones = [PAL.road, PAL.roadAlt, PAL.roadEdge];
  for (let i = 0; i < roadCells.length; i++) {
    const r = roadCells[i][0], c = roadCells[i][1];
    dummy.position.set(map.colX(c), -0.145, map.rowZ(r));
    dummy.updateMatrix();
    road.setMatrixAt(i, dummy.matrix);
    color.setHex(roadTones[(rand() * roadTones.length) | 0]);
    color.multiplyScalar(0.93 + rand() * 0.14);
    road.setColorAt(i, color);
  }
  road.instanceMatrix.needsUpdate = true;
  if (road.instanceColor) road.instanceColor.needsUpdate = true;
  group.add(road);

  // --- paralelepípedos soltos sobre a estrada, para quebrar a repetição ---
  const cobbleGeo = geo('cobble', function () { return new THREE.BoxGeometry(0.2, 0.08, 0.26); });
  const cobbles = new THREE.InstancedMesh(cobbleGeo, std(0xffffff), roadCells.length * 3);
  cobbles.receiveShadow = true;
  for (let i = 0; i < roadCells.length * 3; i++) {
    const cell = roadCells[i % roadCells.length];
    dummy.position.set(
      map.colX(cell[1]) + (rand() - 0.5) * 0.7,
      0.005,
      map.rowZ(cell[0]) + (rand() - 0.5) * 0.7
    );
    dummy.rotation.set(0, rand() * Math.PI, 0);
    dummy.scale.setScalar(0.7 + rand() * 0.7);
    dummy.updateMatrix();
    cobbles.setMatrixAt(i, dummy.matrix);
    color.setHex(PAL.stoneMid).multiplyScalar(0.8 + rand() * 0.45);
    cobbles.setColorAt(i, color);
  }
  dummy.scale.setScalar(1);
  cobbles.instanceMatrix.needsUpdate = true;
  if (cobbles.instanceColor) cobbles.instanceColor.needsUpdate = true;
  group.add(cobbles);

  // --- tufos de grama alta nas células jogáveis ---
  const tuftGeo = geo('tuft', function () { return new THREE.ConeGeometry(0.07, 0.3, 3); });
  const tufts = new THREE.InstancedMesh(tuftGeo, std(0xffffff), grassCells.length);
  tufts.castShadow = false;
  for (let i = 0; i < grassCells.length; i++) {
    const cell = grassCells[i % grassCells.length];
    dummy.position.set(
      map.colX(cell[1]) + (rand() - 0.5) * 0.72,
      0.1,
      map.rowZ(cell[0]) + (rand() - 0.5) * 0.72
    );
    dummy.rotation.set((rand() - 0.5) * 0.35, rand() * Math.PI, (rand() - 0.5) * 0.35);
    dummy.scale.set(0.62, 0.45 + rand() * 0.5, 0.62);
    dummy.updateMatrix();
    tufts.setMatrixAt(i, dummy.matrix);
    color.setHex(rand() > 0.5 ? PAL.grassDry : PAL.grassAlt).multiplyScalar(0.85 + rand() * 0.35);
    tufts.setColorAt(i, color);
  }
  dummy.scale.setScalar(1);
  tufts.instanceMatrix.needsUpdate = true;
  if (tufts.instanceColor) tufts.instanceColor.needsUpdate = true;
  group.add(tufts);

  // Manchas de terra e palha quebram a grade sem sugerir uma rota fixa.
  const patchGeo = geo('field-patch', function () { return new THREE.CircleGeometry(0.23, 7); });
  const patches = new THREE.InstancedMesh(patchGeo, std(0xffffff, { roughness: 1, side: THREE.DoubleSide }), grassCells.length);
  for (let i = 0; i < grassCells.length; i++) {
    const cell = grassCells[i];
    dummy.position.set(map.colX(cell[1]) + (rand() - 0.5) * 0.45, 0.008, map.rowZ(cell[0]) + (rand() - 0.5) * 0.45);
    dummy.rotation.set(-Math.PI / 2, 0, rand() * Math.PI);
    const size = rand() > 0.42 ? 0.5 + rand() * 0.65 : 0;
    dummy.scale.set(size, size * (0.55 + rand() * 0.5), 1);
    dummy.updateMatrix(); patches.setMatrixAt(i, dummy.matrix);
    color.setHex(rand() > 0.45 ? 0x927e5c : 0x4d6845);
    patches.setColorAt(i, color);
  }
  dummy.scale.setScalar(1);
  patches.instanceMatrix.needsUpdate = true;
  if (patches.instanceColor) patches.instanceColor.needsUpdate = true;
  patches.receiveShadow = true;
  group.add(patches);

  // --- tampa verde logo abaixo das células: as frestas viram sulcos de grama ---
  const seamCap = mesh(
    geo('seam-cap', function () { return new THREE.BoxGeometry(COLS, 0.1, ROWS); }),
    std(PAL.grassDark, { roughness: 1 }),
    0, -0.14, 0
  );
  seamCap.castShadow = false;
  group.add(seamCap);

  // --- talude de terra sob o tabuleiro, dando espessura ao "diorama" ---
  const skirt = mesh(
    geo('skirt', function () { return new THREE.BoxGeometry(COLS + 0.12, 0.7, ROWS + 0.12); }),
    std(PAL.soil, { roughness: 1 }),
    0, -0.5, 0
  );
  skirt.castShadow = false;
  group.add(skirt);

  scene.add(group);
  return group;
}

// ---------------------------------------------------------------------------
// Ambientação em volta do tabuleiro
// ---------------------------------------------------------------------------

/** Muro baixo de pedra correndo pelas laterais jogáveis. */
function buildSideWalls(map) {
  const group = new THREE.Group();
  const rand = rng(0xb0a7);
  const blockGeo = geo('wall-block', function () { return new THREE.BoxGeometry(0.46, 0.3, 0.9); });
  const blockMat = std(PAL.stoneMid, { roughness: 0.95 });
  const stakeMat = std(PAL.woodDark, { roughness: 1 });

  for (let side = -1; side <= 1; side += 2) {
    for (let r = 0; r < map.ROWS; r++) {
      const h = 1 + ((rand() * 3) | 0);
      for (let k = 0; k < h; k++) {
        const b = mesh(blockGeo, blockMat,
          side * (map.halfW + 0.34) + (rand() - 0.5) * 0.08,
          0.13 + k * 0.26,
          map.rowZ(r) + (rand() - 0.5) * 0.12
        );
        b.rotation.y = (rand() - 0.5) * 0.14;
        b.scale.set(1, 1, 0.86 + rand() * 0.2);
        group.add(b);
      }
      if(r>0 && r<map.ROWS-1){
        const x=side*(map.halfW+0.36), z=map.rowZ(r);
        group.add(mesh(geo('palisade-stake',function(){return new THREE.CylinderGeometry(0.085,0.11,0.72,5);}),stakeMat,x,0.65,z));
        group.add(mesh(geo('palisade-point',function(){return new THREE.ConeGeometry(0.11,0.25,5);}),stakeMat,x,1.12,z));
      }
    }
    // Estandartes marcam o corredor de batalha sem ocupar células jogáveis.
    for(const row of [2,6,10]){
      const x=side*(map.halfW+0.88), z=map.rowZ(row);
      const pole=mesh(geo('campaign-pole',function(){return new THREE.CylinderGeometry(0.027,0.035,1.55,6);}),stakeMat,x,0.78,z);
      group.add(pole);
      const cloth=new THREE.Mesh(
        geo('campaign-banner',function(){return new THREE.PlaneGeometry(0.40,0.55);}),
        std(side<0?0xa54f3d:0x4d817f,{side:THREE.DoubleSide,roughness:0.9})
      );
      cloth.position.set(x+side*0.21,1.22,z);
      cloth.rotation.y=0;
      cloth.castShadow=true;group.add(cloth);
      group.add(mesh(geo('campaign-finial',function(){return new THREE.ConeGeometry(0.06,0.18,5);}),
        std(PAL.gold,{metalness:0.5,roughness:0.45}),x,1.65,z));
    }
  }
  return group;
}

/** Portal de invasão: arco de pedra escura no lado do spawn, com brasas. */
function buildSpawnPortal(map) {
  const group = new THREE.Group();
  const z = -map.halfH - 1.45;
  const dark = std(PAL.stoneDark, { roughness: 1 });

  const pillarGeo = geo('portal-pillar', function () { return new THREE.BoxGeometry(0.6, 2.5, 0.7); });
  for (let side = -1; side <= 1; side += 2) {
    const p = mesh(pillarGeo, dark, side * 1.35, 1.25, z);
    p.rotation.y = side * 0.05;
    group.add(p);
    // Capitel
    group.add(mesh(geo('portal-cap', function () { return new THREE.BoxGeometry(0.82, 0.26, 0.9); }), std(PAL.stoneMid), side * 1.35, 2.62, z));
  }

  // Lintel e frontão
  group.add(mesh(geo('portal-lintel', function () { return new THREE.BoxGeometry(3.6, 0.45, 0.8); }), dark, 0, 2.95, z));
  group.add(mesh(geo('portal-crown', function () { return new THREE.ConeGeometry(0.34, 0.7, 4); }), std(PAL.stoneMid), 0, 3.52, z));

  // Véu do portal: plano aditivo pulsante (animado em update()).
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.4), glow(0x9b6ce0, 0.34));
  veil.position.set(0, 1.2, z + 0.05);
  group.add(veil);
  group.userData.veil = veil;

  // Braseiros
  const bowlGeo = geo('brazier-bowl', function () { return new THREE.CylinderGeometry(0.26, 0.14, 0.24, 8); });
  const flames = [];
  for (let side = -1; side <= 1; side += 2) {
    const x = side * 2.25;
    group.add(mesh(geo('brazier-leg', function () { return new THREE.CylinderGeometry(0.07, 0.1, 0.8, 6); }), std(PAL.ironDark), x, 0.4, z + 0.3));
    group.add(mesh(bowlGeo, std(PAL.ironDark), x, 0.9, z + 0.3));
    const flame = new THREE.Mesh(geo('flame', function () { return new THREE.ConeGeometry(0.2, 0.55, 6); }), glow(PAL.ember, 0.85));
    flame.position.set(x, 1.24, z + 0.3);
    flame.castShadow = false;
    group.add(flame);
    const light = new THREE.PointLight(0xff8a30, 6, 7, 2);
    light.position.set(x, 1.4, z + 0.3);
    group.add(light);
    flames.push({ mesh: flame, light: light, phase: side });
  }
  group.userData.flames = flames;
  return group;
}

/** Bastião do jogador: muralha, torres e portão no lado defendido. */
function buildBastion(map) {
  const group = new THREE.Group();
  const z = map.halfH + 1.45;
  const wallMat = std(PAL.stone, { roughness: 0.92 });
  const trimMat = std(PAL.stoneMid, { roughness: 0.95 });

  // Cortina de muralha com ameias
  const wallGeo = geo('bastion-wall', function () { return new THREE.BoxGeometry(map.COLS + 2.4, 1.5, 0.9); });
  group.add(mesh(wallGeo, wallMat, 0, 0.75, z));

  const merlonGeo = geo('merlon', function () { return new THREE.BoxGeometry(0.42, 0.42, 0.95); });
  const span = map.COLS + 2.0;
  const count = Math.floor(span / 0.78);
  for (let i = 0; i <= count; i++) {
    const x = -span / 2 + (i / count) * span;
    if (Math.abs(x) < 0.95) continue; // vão do portão
    group.add(mesh(merlonGeo, trimMat, x, 1.71, z));
  }

  // Portão em arco, iluminado por dentro
  // O portão fica à frente da cortina de muralha, senão some dentro dela.
  const gate = mesh(geo('gate', function () { return new THREE.BoxGeometry(1.8, 1.35, 0.18); }), std(PAL.wood, { roughness: 0.85 }), 0, 0.67, z - 0.5);
  group.add(gate);
  for (let i = -1; i <= 1; i++) {
    group.add(mesh(geo('gate-band', function () { return new THREE.BoxGeometry(1.84, 0.1, 0.06); }), std(PAL.ironDark, { metalness: 0.4, roughness: 0.5 }), 0, 0.67 + i * 0.42, z - 0.61));
  }
  const gateGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.05), glow(PAL.goldLight, 0.3));
  gateGlow.position.set(0, 0.55, z - 0.66);
  gateGlow.rotation.y = Math.PI;
  group.add(gateGlow);
  group.userData.gateGlow = gateGlow;

  // Torres nos cantos
  const towerGeo = geo('bastion-tower', function () { return new THREE.CylinderGeometry(0.5, 0.6, 2.1, 8); });
  const roofGeo = geo('bastion-roof', function () { return new THREE.ConeGeometry(0.68, 0.95, 8); });
  const banners = [];
  for (let side = -1; side <= 1; side += 2) {
    const x = side * (map.halfW + 1.5);
    group.add(mesh(towerGeo, wallMat, x, 1.05, z));
    const roof = mesh(roofGeo, std(0x4a5a7a, { roughness: 0.8 }), x, 2.55, z);
    group.add(roof);
    // Mastro + estandarte
    group.add(mesh(geo('pole', function () { return new THREE.CylinderGeometry(0.03, 0.03, 0.9, 5); }), std(PAL.woodDark), x, 3.35, z));
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.34, 6, 1), std(PAL.gold, { side: THREE.DoubleSide, roughness: 0.7 }));
    banner.position.set(x + 0.26, 3.45, z);
    banner.castShadow = true;
    group.add(banner);
    banners.push(banner);
  }
  group.userData.banners = banners;
  return group;
}

/** Floresta, pedregulhos e montanhas distantes preenchendo o horizonte. */
function buildScenery(map) {
  const group = new THREE.Group();
  const rand = rng(0x1f0e57);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  // Chão externo: disco amplo de grama escura sob o cenário.
  const apron = new THREE.Mesh(
    geo('apron', function () { return new THREE.CircleGeometry(95, 56); }),
    std(PAL.grassDark, { roughness: 1 })
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.82;
  apron.receiveShadow = true;
  group.add(apron);

  // --- árvores (tronco + duas copas cônicas) ---
  const spots = [];
  let guard = 0;
  while (spots.length < 86 && guard++ < 6000) {
    const a = rand() * Math.PI * 2;
    const rad = 5.5 + rand() * rand() * 26;
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad * 0.85;
    // Mantém o tabuleiro e a moldura imediata livres.
    if (Math.abs(x) < map.halfW + 3.4 && Math.abs(z) < map.halfH + 3.4) continue;
    spots.push([x, z, 0.65 + rand() * 0.85, rand() > 0.67]);
  }

  const trunks = new THREE.InstancedMesh(
    geo('trunk', function () { return new THREE.CylinderGeometry(0.11, 0.17, 1.1, 5); }),
    std(PAL.woodDark, { roughness: 1 }), spots.length);
  const crownsLow = new THREE.InstancedMesh(
    geo('crown', function () { return new THREE.ConeGeometry(0.72, 1.25, 6); }),
    std(0xffffff, { roughness: 0.95 }), spots.length);
  const crownsTop = new THREE.InstancedMesh(
    geo('crown-top', function () { return new THREE.ConeGeometry(0.5, 1.1, 6); }),
    std(0xffffff, { roughness: 0.95 }), spots.length);
  const oakSpots = spots.filter(function(s){ return s[3]; });
  const oaks = new THREE.InstancedMesh(
    geo('oak-crown', function(){ return new THREE.DodecahedronGeometry(0.72,0); }),
    std(0xffffff, { roughness: 0.96 }), oakSpots.length * 2);
  trunks.castShadow = crownsLow.castShadow = crownsTop.castShadow = true;
  oaks.castShadow = true;
  let oakIndex=0;

  for (let i = 0; i < spots.length; i++) {
    const x = spots[i][0], z = spots[i][1], s = spots[i][2];
    const tilt = (rand() - 0.5) * 0.09;
    dummy.rotation.set(tilt, rand() * Math.PI, tilt);

    dummy.position.set(x, -0.82 + 0.55 * s, z);
    dummy.scale.setScalar(s);
    dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, -0.82 + 1.35 * s, z);
    if(spots[i][3]) dummy.scale.setScalar(0);
    dummy.updateMatrix(); crownsLow.setMatrixAt(i, dummy.matrix);
    color.setHex(PAL.leaf).multiplyScalar(0.72 + rand() * 0.6);
    crownsLow.setColorAt(i, color);

    dummy.position.set(x, -0.82 + 2.1 * s, z);
    dummy.updateMatrix(); crownsTop.setMatrixAt(i, dummy.matrix);
    color.setHex(PAL.leafAlt).multiplyScalar(0.75 + rand() * 0.6);
    crownsTop.setColorAt(i, color);
    if(spots[i][3]){
      dummy.scale.setScalar(s);
      for(let k=0;k<2;k++){
        dummy.position.set(x+(k?0.31:-0.24)*s, -0.82+(k?1.88:1.53)*s,z+(k?-0.2:0.22)*s);
        dummy.rotation.set(0,rand()*Math.PI,0);
        dummy.scale.set(s*(k?0.72:0.9),s*(k?0.62:0.75),s*(k?0.78:0.95));
        dummy.updateMatrix();oaks.setMatrixAt(oakIndex,dummy.matrix);
        color.setHex(k?PAL.leafAlt:PAL.leaf).multiplyScalar(0.88+rand()*0.22);
        oaks.setColorAt(oakIndex++,color);
      }
    }
  }
  dummy.scale.setScalar(1);
  [trunks, crownsLow, crownsTop, oaks].forEach(function (m) {
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    group.add(m);
  });

  // --- pedregulhos ---
  const rocks = new THREE.InstancedMesh(
    geo('rock', function () { return new THREE.IcosahedronGeometry(0.42, 0); }),
    std(0xffffff, { roughness: 1 }), 64);
  rocks.castShadow = rocks.receiveShadow = true;
  for (let i = 0; i < 64; i++) {
    const a = rand() * Math.PI * 2;
    const rad = 5.0 + rand() * 22;
    let x = Math.cos(a) * rad, z = Math.sin(a) * rad * 0.9;
    if (Math.abs(x) < map.halfW + 1.4 && Math.abs(z) < map.halfH + 1.6) { x += Math.sign(x || 1) * 3; }
    dummy.position.set(x, -0.85 + rand() * 0.2, z);
    dummy.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    dummy.scale.set(0.5 + rand(), 0.4 + rand() * 0.7, 0.5 + rand());
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
    color.setHex(PAL.stoneMid).multiplyScalar(0.7 + rand() * 0.55);
    rocks.setColorAt(i, color);
  }
  dummy.scale.setScalar(1);
  rocks.instanceMatrix.needsUpdate = true;
  if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
  group.add(rocks);

  // --- montanhas do horizonte (sem sombra, só silhueta) ---
  const peaks = new THREE.InstancedMesh(
    geo('peak', function () { return new THREE.ConeGeometry(4.5, 9, 5); }),
    std(0xffffff, { roughness: 1 }), 44);
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2 + rand() * 0.16;
    const rad = 34 + rand() * 14;
    const s = 1.1 + rand() * 1.7;
    dummy.position.set(Math.cos(a) * rad, -0.9 + 4.5 * s, Math.sin(a) * rad);
    dummy.rotation.set(0, rand() * Math.PI, 0);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    peaks.setMatrixAt(i, dummy.matrix);
    color.setHex(0x55707f).multiplyScalar(0.8 + rand() * 0.45);
    peaks.setColorAt(i, color);
  }
  dummy.scale.setScalar(1);
  peaks.instanceMatrix.needsUpdate = true;
  if (peaks.instanceColor) peaks.instanceColor.needsUpdate = true;
  group.add(peaks);

  return group;
}

/** Monta toda a ambientação e devolve o que precisa ser animado por frame. */
export function createEnvironment(scene, map) {
  const group = new THREE.Group();
  const portal = buildSpawnPortal(map);
  const bastion = buildBastion(map);
  group.add(buildScenery(map));
  group.add(buildSideWalls(map));
  group.add(portal);
  group.add(bastion);
  scene.add(group);

  return {
    group: group,
    update: function (t) {
      const flames = portal.userData.flames;
      for (let i = 0; i < flames.length; i++) {
        const f = flames[i];
        const flick = 0.72 + Math.sin(t * 9 + f.phase * 2.1) * 0.16 + Math.sin(t * 23.7 + f.phase) * 0.09;
        f.mesh.scale.set(0.85 + flick * 0.3, flick * 1.35, 0.85 + flick * 0.3);
        f.mesh.material.opacity = 0.62 + flick * 0.3;
        f.light.intensity = 3.4 + flick * 4.2;
      }
      const veil = portal.userData.veil;
      veil.material.opacity = 0.24 + Math.sin(t * 1.7) * 0.08;
      veil.scale.set(1 + Math.sin(t * 2.3) * 0.02, 1 + Math.sin(t * 1.9) * 0.03, 1);

      bastion.userData.gateGlow.material.opacity = 0.22 + Math.sin(t * 2.4) * 0.06;
      const banners = bastion.userData.banners;
      for (let i = 0; i < banners.length; i++) {
        banners[i].rotation.y = Math.sin(t * 1.6 + i) * 0.34;
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Indicadores de construção e seleção
// ---------------------------------------------------------------------------

/** Cria os marcadores no chão: célula sob o cursor, alcance e seleção. */
export function createIndicators(scene) {
  const group = new THREE.Group();

  // Célula sob o cursor
  const hoverMat = glow(0xffffff, 0.3).clone();
  const hover = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.94), hoverMat);
  hover.rotation.x = -Math.PI / 2;
  hover.position.y = 0.035;
  hover.visible = false;
  group.add(hover);

  // Contorno da célula, para leitura clara da grade
  const hoverEdge = new THREE.Mesh(
    new THREE.RingGeometry(0.62, 0.68, 4, 1),
    glow(0xffffff, 0.55).clone()
  );
  hoverEdge.rotation.x = -Math.PI / 2;
  hoverEdge.rotation.z = Math.PI / 4;
  hoverEdge.position.y = 0.04;
  hoverEdge.visible = false;
  group.add(hoverEdge);

  // Alcance: anel + disco tênue (geometria unitária, escalada pelo alcance)
  const rangeRing = new THREE.Mesh(
    new THREE.RingGeometry(0.965, 1.0, 64),
    glow(0xeae3c8, 0.5).clone()
  );
  rangeRing.rotation.x = -Math.PI / 2;
  rangeRing.position.y = 0.03;
  rangeRing.visible = false;
  group.add(rangeRing);

  const rangeFill = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48),
    glow(0xeae3c8, 0.055).clone()
  );
  rangeFill.rotation.x = -Math.PI / 2;
  rangeFill.position.y = 0.025;
  rangeFill.visible = false;
  group.add(rangeFill);

  // Seleção: anel tracejado girando sob a torre escolhida
  const selection = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.5, 16, 1, 0, Math.PI * 2),
    glow(PAL.goldLight, 0.75).clone()
  );
  selection.rotation.x = -Math.PI / 2;
  selection.position.y = 0.045;
  selection.visible = false;
  group.add(selection);

  scene.add(group);

  return {
    group: group,
    /**
     * @param {?{x:number,z:number,valid:boolean}} hoverInfo célula sob o cursor
     * @param {?{x:number,z:number,radius:number,color:number}} rangeInfo alcance a exibir
     * @param {?{x:number,z:number}} selInfo torre selecionada
     */
    update: function (hoverInfo, rangeInfo, selInfo, t) {
      if (hoverInfo) {
        const tint = hoverInfo.valid ? 0x9ede6a : 0xe06a55;
        hover.visible = hoverEdge.visible = true;
        hover.position.set(hoverInfo.x, 0.035, hoverInfo.z);
        hoverEdge.position.set(hoverInfo.x, 0.04, hoverInfo.z);
        hover.material.color.setHex(tint);
        hoverEdge.material.color.setHex(tint);
        // Fora do modo de construção o realce fica discreto, só como feedback.
        const dim = hoverInfo.dim ? 0.32 : 1;
        const pulse = 0.5 + Math.sin(t * 6) * 0.5;
        hover.material.opacity = (0.1 + pulse * 0.12) * dim;
        hoverEdge.material.opacity = (0.35 + pulse * 0.3) * dim;
      } else {
        hover.visible = hoverEdge.visible = false;
      }

      if (rangeInfo) {
        rangeRing.visible = rangeFill.visible = true;
        rangeRing.position.set(rangeInfo.x, 0.03, rangeInfo.z);
        rangeFill.position.set(rangeInfo.x, 0.025, rangeInfo.z);
        rangeRing.scale.setScalar(rangeInfo.radius);
        rangeFill.scale.setScalar(rangeInfo.radius);
        rangeRing.material.color.setHex(rangeInfo.color);
        rangeFill.material.color.setHex(rangeInfo.color);
        rangeRing.material.opacity = 0.35 + Math.sin(t * 3.2) * 0.1;
      } else {
        rangeRing.visible = rangeFill.visible = false;
      }

      if (selInfo) {
        selection.visible = true;
        selection.position.set(selInfo.x, 0.045, selInfo.z);
        selection.rotation.z = t * 0.9;
        selection.scale.setScalar(1 + Math.sin(t * 4) * 0.04);
      } else {
        selection.visible = false;
      }
    }
  };
}
