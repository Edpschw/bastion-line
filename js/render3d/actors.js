// -----------------------------------------------------------------------------
// Bastion Line — atores 3D
// Malhas procedurais de torres, inimigos e do Mestre de Obras.
// Tudo é montado a partir de primitivas com flat shading: nada de assets
// externos, e o visual fica coerente entre as peças.
// -----------------------------------------------------------------------------
import { THREE, PAL, geo, std, glow, mesh, rng, lerpAngle, damp, shade } from './core.js';

const BOX = function (w, h, d) {
  return geo('box:' + w + ':' + h + ':' + d, function () { return new THREE.BoxGeometry(w, h, d); });
};
const CYL = function (rt, rb, h, s) {
  return geo('cyl:' + rt + ':' + rb + ':' + h + ':' + s, function () { return new THREE.CylinderGeometry(rt, rb, h, s); });
};
const CONE = function (r, h, s) {
  return geo('cone:' + r + ':' + h + ':' + s, function () { return new THREE.ConeGeometry(r, h, s); });
};
const SPH = function (r, w, h) {
  return geo('sph:' + r + ':' + w + ':' + h, function () { return new THREE.SphereGeometry(r, w || 10, h || 8); });
};
const OCT = function (r) {
  return geo('oct:' + r, function () { return new THREE.OctahedronGeometry(r, 0); });
};
const ICO = function (r, d) {
  return geo('ico:' + r + ':' + d, function () { return new THREE.IcosahedronGeometry(r, d || 0); });
};

// ---------------------------------------------------------------------------
// Torres
// ---------------------------------------------------------------------------

/** Plataforma de pedra comum a todas as torres; cresce com o tier. */
function towerBase(tier) {
  const g = new THREE.Group();
  const s = 1 + (tier - 1) * 0.12;
  const slab = mesh(BOX(0.84, 0.14, 0.84), std(PAL.stoneMid, { roughness: 0.95 }), 0, 0.07, 0);
  slab.scale.set(s, 1, s);
  g.add(slab);
  const rim = mesh(BOX(0.94, 0.07, 0.94), std(PAL.stoneDark, { roughness: 1 }), 0, 0.025, 0);
  rim.scale.set(s, 1, s);
  g.add(rim);
  if (tier >= 2) {
    // Cantoneiras de pedra marcando a evolução
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      g.add(mesh(BOX(0.16, 0.2, 0.16), std(PAL.stone), Math.cos(a) * 0.38 * s, 0.17, Math.sin(a) * 0.38 * s));
    }
  }
  return g;
}

/** Corpo humanoide genérico reutilizado pelas torres (pernas, tronco, cabeça). */
function humanoid(cloth, skin, scale) {
  const g = new THREE.Group();
  const s = scale || 1;
  const clothMat = std(cloth, { roughness: 0.8 });
  const skinMat = std(skin || PAL.skin, { roughness: 0.75 });

  const legL = mesh(BOX(0.075, 0.2, 0.09), std(PAL.woodDark), -0.055, 0.1, 0);
  const legR = mesh(BOX(0.075, 0.2, 0.09), std(PAL.woodDark), 0.055, 0.1, 0);
  g.add(legL, legR);

  const torso = mesh(BOX(0.2, 0.24, 0.14), clothMat, 0, 0.32, 0);
  g.add(torso);
  const head = mesh(SPH(0.088), skinMat, 0, 0.5, 0);
  g.add(head);

  g.scale.setScalar(s);
  g.userData = { legL: legL, legR: legR, torso: torso, head: head };
  return g;
}

function buildMilitia(tier, branch, color) {
  const g = new THREE.Group();
  g.add(towerBase(tier));
  const turret = new THREE.Group();
  turret.position.y = 0.14;

  const body = humanoid(color, PAL.skin, 1 + (tier - 1) * 0.16);
  turret.add(body);

  // Elmo
  const helm = mesh(SPH(0.1, 10, 6), std(PAL.iron, { metalness: 0.45, roughness: 0.5 }), 0, 0.52, 0);
  helm.scale.set(1, 0.72, 1);
  body.add(helm);
  if (tier >= 2) {
    body.add(mesh(BOX(0.03, 0.09, 0.22), std(PAL.gold, { metalness: 0.5, roughness: 0.4 }), 0, 0.61, 0));
  }

  // Tabardo sobre o peitoral
  body.add(mesh(BOX(0.12, 0.2, 0.025), std(shade(color, 0.7), { roughness: 0.9 }), 0, 0.31, 0.078));
  body.add(mesh(BOX(0.12, 0.028, 0.03), std(PAL.gold, { metalness: 0.55, roughness: 0.4 }), 0, 0.39, 0.08));

  const arms = new THREE.Group();
  arms.position.y = 0.34;
  if (branch === 'guerreiro') {
    // Duas lâminas: ofensivo
    for (let side = -1; side <= 1; side += 2) {
      const blade = mesh(BOX(0.05, 0.4, 0.015), std(PAL.iron, { metalness: 0.6, roughness: 0.35 }), side * 0.19, 0.12, 0.06);
      blade.rotation.z = side * -0.5;
      arms.add(blade);
      arms.add(mesh(BOX(0.05, 0.09, 0.05), std(PAL.woodDark), side * 0.17, -0.06, 0.06));
    }
  } else {
    // Escudo + espada: defensivo
    const shield = mesh(BOX(0.05, 0.32 + tier * 0.06, 0.28 + tier * 0.05), std(PAL.wood, { roughness: 0.8 }), -0.18, 0.02, 0.05);
    arms.add(shield);
    arms.add(mesh(BOX(0.02, 0.12, 0.12), std(PAL.gold, { metalness: 0.5, roughness: 0.4 }), -0.21, 0.02, 0.05));
    const sword = mesh(BOX(0.045, 0.38, 0.015), std(PAL.iron, { metalness: 0.6, roughness: 0.35 }), 0.19, 0.14, 0.04);
    sword.rotation.z = -0.35;
    arms.add(sword);
  }
  body.add(arms);

  if (tier >= 3) {
    // Paliçada de pedra ao redor: "Muralha Viva"
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      const bl = mesh(BOX(0.22, 0.26, 0.12), std(PAL.stone), Math.cos(a) * 0.4, 0.13, Math.sin(a) * 0.4);
      bl.rotation.y = -a;
      g.add(bl);
    }
  }

  g.add(turret);
  g.userData = { turret: turret, body: body, arms: arms, recoil: 0, kind: 'militia' };
  return g;
}

function buildArcher(tier, branch, color) {
  const g = new THREE.Group();
  g.add(towerBase(tier));

  // Torre de madeira: quatro pernas + plataforma
  const h = 0.42 + (tier - 1) * 0.12;
  const legMat = std(PAL.wood, { roughness: 0.9 });
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const leg = mesh(BOX(0.06, h, 0.06), legMat, Math.cos(a) * 0.27, 0.14 + h / 2, Math.sin(a) * 0.27);
    leg.rotation.y = -a;
    leg.rotation.x = Math.sin(a) * 0.08;
    leg.rotation.z = -Math.cos(a) * 0.08;
    g.add(leg);
  }
  g.add(mesh(BOX(0.66, 0.06, 0.66), std(PAL.woodDark, { roughness: 0.9 }), 0, 0.14 + h, 0));
  // Guarda-corpo
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    const rail = mesh(BOX(0.6, 0.05, 0.05), legMat, Math.cos(a) * 0.3, 0.26 + h, Math.sin(a) * 0.3);
    rail.rotation.y = -a;
    g.add(rail);
  }

  const turret = new THREE.Group();
  turret.position.y = 0.17 + h;
  const body = humanoid(color, PAL.skin, 0.92 + (tier - 1) * 0.08);
  turret.add(body);
  // Capuz
  body.add(mesh(CONE(0.11, 0.16, 6), std(color, { roughness: 0.85 }), 0, 0.54, 0));

  const arms = new THREE.Group();
  arms.position.y = 0.33;
  if (branch === 'francoatiradora') {
    // Besta pesada
    const stock = mesh(BOX(0.07, 0.07, 0.42), std(PAL.woodDark), 0, 0.02, 0.14);
    arms.add(stock);
    arms.add(mesh(BOX(0.36, 0.035, 0.035), std(PAL.iron, { metalness: 0.5, roughness: 0.4 }), 0, 0.04, 0.3));
    if (tier >= 3) arms.add(mesh(CYL(0.03, 0.03, 0.14, 6), std(PAL.gold, { metalness: 0.6, roughness: 0.3 }), 0.05, 0.09, 0.16));
  } else {
    // Arco longo
    const bow = new THREE.Mesh(
      geo('bow', function () { return new THREE.TorusGeometry(0.19, 0.016, 5, 12, Math.PI * 1.15); }),
      std(PAL.woodDark, { roughness: 0.8 })
    );
    bow.position.set(0.02, 0.03, 0.18);
    bow.rotation.set(0, Math.PI / 2, Math.PI / 2 + 0.58);
    bow.castShadow = true;
    arms.add(bow);
    const string = mesh(BOX(0.008, 0.36, 0.008), std(PAL.cloth), 0.02, 0.03, 0.15);
    arms.add(string);
  }
  body.add(arms);
  g.add(turret);

  if (tier >= 3) {
    // Telhado cônico com estandarte, na linha das torres de guarda humanas
    const roof = mesh(CONE(0.52, 0.34, 6), std(0x4a5a7a, { roughness: 0.85 }), 0, 0.85 + h, 0);
    g.add(roof);
    g.add(mesh(CYL(0.012, 0.012, 0.3, 5), std(PAL.woodDark), 0, 1.15 + h, 0));
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.13), std(0x2f5fa8, {
      roughness: 0.9, side: THREE.DoubleSide
    }));
    banner.position.set(0.1, 1.24 + h, 0);
    banner.castShadow = false;
    g.add(banner);
  }

  g.userData = { turret: turret, body: body, arms: arms, recoil: 0, kind: 'archer' };
  return g;
}

function buildMage(tier, branch, color) {
  const g = new THREE.Group();
  g.add(towerBase(tier));

  // Pilar rúnico
  const pillar = mesh(CYL(0.2, 0.26, 0.42 + tier * 0.06, 8), std(PAL.stone, { roughness: 0.9 }), 0, 0.14 + (0.42 + tier * 0.06) / 2, 0);
  g.add(pillar);
  const runeRing = new THREE.Mesh(
    geo('rune-ring', function () { return new THREE.TorusGeometry(0.3, 0.018, 6, 24); }),
    glow(color, 0.7)
  );
  runeRing.rotation.x = Math.PI / 2;
  runeRing.position.y = 0.2;
  g.add(runeRing);

  const turret = new THREE.Group();
  turret.position.y = 0.16 + 0.42 + tier * 0.06;

  // Manto cônico + capuz
  const robe = mesh(CONE(0.19, 0.4, 8), std(color, { roughness: 0.85 }), 0, 0.2, 0);
  turret.add(robe);
  const head = mesh(SPH(0.085), std(PAL.skin), 0, 0.44, 0);
  turret.add(head);
  const hood = mesh(CONE(0.115, 0.2, 7), std(color, { roughness: 0.85 }), 0, 0.5, -0.01);
  turret.add(hood);

  // Cajado
  const staff = mesh(CYL(0.016, 0.02, 0.56, 6), std(PAL.woodDark), 0.17, 0.3, 0.04);
  staff.rotation.z = -0.12;
  turret.add(staff);

  // Orbe flutuante — girando e pulsando
  const orbColor = branch === 'piromante' ? PAL.ember : color;
  const orb = new THREE.Mesh(ICO(0.1, 0), std(orbColor, {
    emissive: orbColor, emissiveIntensity: 1.5, roughness: 0.3
  }));
  orb.position.set(0.17, 0.62, 0.04);
  orb.castShadow = false;
  turret.add(orb);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), glow(orbColor, 0.45));
  halo.position.copy(orb.position);
  turret.add(halo);

  // Fragmentos orbitando (mais numerosos nos tiers altos)
  const shards = [];
  const shardCount = tier >= 3 ? 5 : tier >= 2 ? 3 : 0;
  for (let i = 0; i < shardCount; i++) {
    const sh = mesh(OCT(0.045), std(orbColor, { emissive: orbColor, emissiveIntensity: 0.9, roughness: 0.35 }));
    sh.castShadow = false;
    sh.userData.angle = (i / shardCount) * Math.PI * 2;
    turret.add(sh);
    shards.push(sh);
  }

  g.add(turret);
  g.userData = { turret: turret, orb: orb, halo: halo, shards: shards, runeRing: runeRing, recoil: 0, kind: 'mage' };
  return g;
}

function buildFrost(tier, branch, color) {
  const g = new THREE.Group();
  g.add(towerBase(tier));

  // Base congelada
  const ice = mesh(CYL(0.34, 0.4, 0.12, 8), std(0xbfe6e2, { roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.85 }), 0, 0.2, 0);
  g.add(ice);

  const turret = new THREE.Group();
  turret.position.y = 0.26;

  const crystalMat = std(color, {
    emissive: color, emissiveIntensity: 0.55,
    roughness: 0.15, metalness: 0.15, transparent: true, opacity: 0.9
  });

  // Espinha central
  const spireH = 0.45 + tier * 0.14;
  const spire = mesh(OCT(0.17), crystalMat, 0, spireH * 0.55, 0);
  spire.scale.set(0.8, spireH * 3.0, 0.8);
  turret.add(spire);

  // Cristais satélites
  const sats = [];
  const satCount = branch === 'cristalina' ? 5 + tier : 3 + tier;
  for (let i = 0; i < satCount; i++) {
    const a = (i / satCount) * Math.PI * 2;
    const rad = 0.24 + (i % 2) * 0.06;
    const sc = 0.5 + (i % 3) * 0.16;
    const c = mesh(OCT(0.11), crystalMat, Math.cos(a) * rad, 0.16 + sc * 0.2, Math.sin(a) * rad);
    c.scale.set(sc, sc * 2.1, sc);
    c.rotation.set((Math.random() - 0.5) * 0.3, a, (Math.random() - 0.5) * 0.3);
    turret.add(c);
    sats.push(c);
  }

  // Névoa gelada no chão
  const mist = new THREE.Mesh(new THREE.CircleGeometry(0.46, 24), glow(PAL.frost, 0.16));
  mist.rotation.x = -Math.PI / 2;
  mist.position.y = 0.16;
  g.add(mist);

  g.add(turret);
  g.userData = { turret: turret, sats: sats, mist: mist, recoil: 0, kind: 'frost' };
  return g;
}

const TOWER_BUILDERS = {
  militia: buildMilitia,
  archer: buildArcher,
  mage: buildMage,
  frost: buildFrost
};

/** Monta a malha de uma torre a partir do tipo, tier, ramo e cor do núcleo 2D. */
export function buildTower(type, tier, branch, color) {
  const build = TOWER_BUILDERS[type] || buildMilitia;
  const g = build(tier, branch, color);

  // Auréola dourada das evoluções, lida de longe.
  if (tier >= 2) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.44, 0.5, 28),
      glow(tier >= 3 ? PAL.goldLight : PAL.gold, tier >= 3 ? 0.55 : 0.35)
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.055;
    g.add(ring);
    g.userData.tierRing = ring;
  }
  g.userData.tier = tier;
  g.userData.type = type;
  g.scale.setScalar(1.2);
  return g;
}

// ---------------------------------------------------------------------------
// Inimigos
// ---------------------------------------------------------------------------

function buildGoblin(color, scout) {
  const g = new THREE.Group();
  // Cabeça clara sobre corpo médio e pernas escuras: visto de cima, a silhueta
  // se separa em três faixas em vez de virar um borrão verde.
  const skin = std(color, { roughness: 0.85 });
  const skinLight = std(shade(color, 1.28), { roughness: 0.85 });
  const cloth = std(scout ? 0x8f5333 : 0x6a5230, { roughness: 0.9 });

  const legL = mesh(BOX(0.085, 0.16, 0.095), cloth, -0.06, 0.08, 0);
  const legR = mesh(BOX(0.085, 0.16, 0.095), cloth, 0.06, 0.08, 0);
  g.add(legL, legR);

  const body = mesh(BOX(0.24, 0.26, 0.19), skin, 0, 0.28, 0);
  g.add(body);
  g.add(mesh(BOX(0.16, 0.16, 0.05), cloth, 0, 0.3, 0.1)); // peitoral

  const head = mesh(SPH(0.14, 10, 8), skinLight, 0, 0.53, 0.02);
  head.scale.set(1, 0.92, 1.05);
  g.add(head);

  // Orelhas pontudas
  for (let side = -1; side <= 1; side += 2) {
    const ear = mesh(CONE(0.055, 0.17, 4), skinLight, side * 0.14, 0.56, 0);
    ear.rotation.z = side * -1.0;
    g.add(ear);
  }
  // Olhos
  for (let side = -1; side <= 1; side += 2) {
    const eye = mesh(SPH(0.028, 6, 6), std(0xffe9a8, { emissive: 0xffc94a, emissiveIntensity: 0.8 }), side * 0.06, 0.55, 0.13);
    eye.castShadow = false;
    g.add(eye);
  }

  // Presas, elmo e capa: a silhueta lê como orc, não como duende genérico
  for (let side = -1; side <= 1; side += 2) {
    const tusk = mesh(CONE(0.026, 0.1, 4), std(PAL.bone, { roughness: 0.7 }), side * 0.055, 0.47, 0.12);
    tusk.rotation.x = -0.25;
    tusk.castShadow = false;
    g.add(tusk);
  }
  if (!scout) {
    const helm = mesh(SPH(0.145, 10, 6), std(PAL.stoneDark, { metalness: 0.35, roughness: 0.55 }), 0, 0.58, 0.01);
    helm.scale.set(1, 0.58, 1);
    g.add(helm);
    for (let side = -1; side <= 1; side += 2) {
      const horn = mesh(CONE(0.035, 0.15, 4), std(PAL.bone, { roughness: 0.7 }), side * 0.13, 0.62, 0);
      horn.rotation.z = side * -0.85;
      g.add(horn);
    }
  }
  const shoulderCape = mesh(BOX(0.26, 0.22, 0.03), std(scout ? 0x4a6b33 : 0x9c3a2c, { roughness: 0.9 }), 0, 0.3, -0.11);
  shoulderCape.rotation.x = -0.14;
  g.add(shoulderCape);

  // Arma
  const armR = new THREE.Group();
  armR.position.set(0.16, 0.36, 0.02);
  armR.add(mesh(BOX(0.07, 0.16, 0.07), skin, 0, -0.06, 0));
  if (scout) {
    const dagger = mesh(BOX(0.03, 0.22, 0.012), std(PAL.iron, { metalness: 0.6, roughness: 0.35 }), 0.02, -0.18, 0.06);
    dagger.rotation.x = 0.4;
    armR.add(dagger);
  } else {
    // Machado tosco
    const haft = mesh(CYL(0.025, 0.025, 0.32, 6), std(PAL.woodDark), 0.03, -0.2, 0.05);
    haft.rotation.x = 0.35;
    armR.add(haft);
    const axeHead = mesh(BOX(0.045, 0.17, 0.13), std(PAL.iron, { metalness: 0.5, roughness: 0.45 }), 0.03, -0.33, 0.11);
    axeHead.rotation.x = 0.35;
    armR.add(axeHead);
  }
  g.add(armR);
  const armL = mesh(BOX(0.07, 0.16, 0.07), skin, -0.16, 0.28, 0.02);
  g.add(armL);

  if (scout) {
    // Penacho do batedor
    const feather = mesh(CONE(0.03, 0.2, 4), std(0xc94f3a), 0, 0.72, -0.03);
    feather.rotation.x = -0.35;
    g.add(feather);
  }

  g.userData = { legL: legL, legR: legR, armR: armR, armL: armL, head: head, body: body };
  return g;
}

function buildSlime(color, tiny) {
  const g = new THREE.Group();
  const mat = std(color, {
    roughness: 0.22, metalness: 0.05,
    transparent: true, opacity: 0.82,
    emissive: color, emissiveIntensity: 0.28
  });
  const blob = mesh(ICO(0.34, 1), mat, 0, 0.26, 0);
  blob.scale.set(1.06, 0.86, 1.06);
  g.add(blob);

  // Camada interna opaca dá volume ao gel
  const core = mesh(ICO(0.19, 0), std(color, { roughness: 0.5, emissive: color, emissiveIntensity: 0.15 }), 0, 0.22, 0);
  core.castShadow = false;
  g.add(core);

  // Olhos boiando no gel
  const eyes = [];
  for (let side = -1; side <= 1; side += 2) {
    const eye = mesh(SPH(0.058, 8, 6), std(0xf7f3e0, { roughness: 0.3 }), side * 0.11, 0.32, 0.24);
    eye.castShadow = false;
    g.add(eye);
    const pupil = mesh(SPH(0.028, 6, 6), std(0x1a2410), side * 0.11, 0.32, 0.29);
    pupil.castShadow = false;
    g.add(pupil);
    eyes.push(eye, pupil);
  }

  // Gotas escorrendo
  if (!tiny) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.6;
      const drop = mesh(SPH(0.07, 6, 5), mat, Math.cos(a) * 0.3, 0.07, Math.sin(a) * 0.3);
      drop.scale.set(1, 0.6, 1);
      g.add(drop);
    }
  }

  g.userData = { blob: blob, core: core, eyes: eyes, squash: true };
  return g;
}

function buildSkeletonKnight(color) {
  const g = new THREE.Group();
  const bone = std(PAL.bone, { roughness: 0.75 });
  const steel = std(color, { metalness: 0.55, roughness: 0.4 });
  const cloak = std(0x3a3340, { roughness: 0.95, side: THREE.DoubleSide });

  const legL = mesh(BOX(0.07, 0.22, 0.08), bone, -0.08, 0.11, 0);
  const legR = mesh(BOX(0.07, 0.22, 0.08), bone, 0.08, 0.11, 0);
  g.add(legL, legR);

  // Caixa torácica sugerida por costelas
  g.add(mesh(BOX(0.2, 0.05, 0.14), bone, 0, 0.3, 0));
  for (let i = 0; i < 3; i++) {
    g.add(mesh(BOX(0.24, 0.028, 0.16), bone, 0, 0.36 + i * 0.07, 0));
  }
  g.add(mesh(BOX(0.05, 0.26, 0.05), bone, 0, 0.42, -0.04)); // coluna

  // Peitoral e ombreiras
  g.add(mesh(BOX(0.26, 0.18, 0.17), steel, 0, 0.46, 0.02));
  for (let side = -1; side <= 1; side += 2) {
    const pauldron = mesh(SPH(0.1, 8, 6), steel, side * 0.17, 0.56, 0);
    pauldron.scale.set(1, 0.7, 1);
    g.add(pauldron);
    for (let i = 0; i < 2; i++) {
      const spike = mesh(CONE(0.026, 0.13, 4), std(PAL.stoneDark, { metalness: 0.4, roughness: 0.5 }),
        side * (0.14 + i * 0.07), 0.62, -0.03 + i * 0.06);
      spike.rotation.z = side * -0.5;
      spike.castShadow = false;
      g.add(spike);
    }
  }
  g.add(mesh(BOX(0.27, 0.03, 0.18), std(PAL.gold, { metalness: 0.6, roughness: 0.35 }), 0, 0.39, 0.02));

  // Crânio e elmo
  const head = mesh(BOX(0.16, 0.17, 0.16), bone, 0, 0.72, 0.01);
  g.add(head);
  g.add(mesh(BOX(0.18, 0.1, 0.18), steel, 0, 0.79, 0.01));
  for (let side = -1; side <= 1; side += 2) {
    const eye = mesh(BOX(0.035, 0.035, 0.02), std(0xff5a3c, { emissive: 0xff4a2c, emissiveIntensity: 2 }), side * 0.045, 0.72, 0.09);
    eye.castShadow = false;
    g.add(eye);
  }

  // Manto
  const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.5, 3, 3), cloak);
  cape.position.set(0, 0.42, -0.11);
  cape.rotation.x = 0.16;
  cape.castShadow = true;
  g.add(cape);

  // Escudo e espada
  const armL = new THREE.Group();
  armL.position.set(-0.2, 0.46, 0.04);
  const shield = mesh(BOX(0.05, 0.3, 0.26), steel, 0, -0.02, 0);
  armL.add(shield);
  armL.add(mesh(BOX(0.02, 0.1, 0.1), std(PAL.gold, { metalness: 0.6, roughness: 0.35 }), -0.035, -0.02, 0));
  g.add(armL);

  const armR = new THREE.Group();
  armR.position.set(0.2, 0.46, 0.04);
  const blade = mesh(BOX(0.05, 0.42, 0.016), std(PAL.iron, { metalness: 0.7, roughness: 0.28 }), 0, 0.12, 0);
  armR.add(blade);
  armR.add(mesh(BOX(0.16, 0.035, 0.035), std(PAL.stoneDark), 0, -0.1, 0));
  armR.rotation.x = -0.25;
  g.add(armR);

  g.userData = { legL: legL, legR: legR, armR: armR, armL: armL, head: head, cape: cape };
  return g;
}

function buildDragon(color) {
  const g = new THREE.Group();
  const scale = std(color, {
    metalness: 0.3, roughness: 0.2,
    emissive: color, emissiveIntensity: 0.35,
    transparent: true, opacity: 0.94
  });
  const crystal = std(0xaee6ff, { emissive: 0x7fd4ff, emissiveIntensity: 1.1, roughness: 0.1, metalness: 0.2 });

  // Patas
  const legs = [];
  for (let sx = -1; sx <= 1; sx += 2) {
    for (let sz = -1; sz <= 1; sz += 2) {
      const leg = mesh(BOX(0.1, 0.26, 0.12), scale, sx * 0.19, 0.13, sz * 0.18);
      g.add(leg);
      legs.push(leg);
    }
  }

  // Tronco
  const body = mesh(ICO(0.32, 1), scale, 0, 0.44, 0);
  body.scale.set(1.15, 0.92, 1.5);
  g.add(body);

  // Pescoço e cabeça
  const neck = new THREE.Group();
  neck.position.set(0, 0.6, 0.26);
  const neckSeg = mesh(CYL(0.1, 0.15, 0.34, 6), scale, 0, 0.12, 0.08);
  neckSeg.rotation.x = -0.6;
  neck.add(neckSeg);
  const head = mesh(BOX(0.2, 0.17, 0.3), scale, 0, 0.3, 0.26);
  neck.add(head);
  const snout = mesh(CONE(0.1, 0.22, 5), scale, 0, 0.27, 0.44);
  snout.rotation.x = Math.PI / 2;
  neck.add(snout);
  for (let side = -1; side <= 1; side += 2) {
    const horn = mesh(CONE(0.04, 0.22, 4), crystal, side * 0.08, 0.42, 0.16);
    horn.rotation.set(-0.5, 0, side * 0.3);
    horn.castShadow = false;
    neck.add(horn);
    const eye = mesh(SPH(0.032, 6, 6), std(0xfff0b0, { emissive: 0xffd45a, emissiveIntensity: 2.2 }), side * 0.08, 0.33, 0.38);
    eye.castShadow = false;
    neck.add(eye);
  }
  g.add(neck);

  // Asas membranosas
  const wings = [];
  for (let side = -1; side <= 1; side += 2) {
    const wing = new THREE.Group();
    wing.position.set(side * 0.2, 0.6, -0.02);
    const membrane = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.5, 3, 2), std(color, {
      side: THREE.DoubleSide, roughness: 0.35, metalness: 0.1,
      transparent: true, opacity: 0.72, emissive: color, emissiveIntensity: 0.25
    }));
    membrane.position.set(side * 0.38, 0.1, -0.05);
    membrane.rotation.y = side * 0.25;
    membrane.castShadow = true;
    wing.add(membrane);
    // Nervuras
    for (let i = 0; i < 3; i++) {
      const rib = mesh(BOX(0.42, 0.022, 0.022), crystal, side * 0.24, 0.16 - i * 0.1, -0.05);
      rib.rotation.z = side * (0.24 - i * 0.2);
      rib.castShadow = false;
      wing.add(rib);
    }
    g.add(wing);
    wings.push({ group: wing, side: side });
  }

  // Cauda segmentada
  const tail = new THREE.Group();
  tail.position.set(0, 0.42, -0.3);
  const tailSegs = [];
  for (let i = 0; i < 4; i++) {
    const s = 0.13 - i * 0.025;
    const seg = mesh(BOX(s * 2, s * 1.6, 0.2), scale, 0, -i * 0.02, -0.1 - i * 0.19);
    tail.add(seg);
    tailSegs.push(seg);
  }
  const barb = mesh(CONE(0.09, 0.26, 4), crystal, 0, -0.06, -0.92);
  barb.rotation.x = -Math.PI / 2;
  barb.castShadow = false;
  tail.add(barb);
  g.add(tail);

  // Cristas dorsais
  for (let i = 0; i < 4; i++) {
    const fin = mesh(CONE(0.05, 0.18, 4), crystal, 0, 0.72 - i * 0.02, 0.16 - i * 0.17);
    fin.castShadow = false;
    g.add(fin);
  }

  // Aura do chefe
  const aura = new THREE.Mesh(new THREE.CircleGeometry(0.85, 28), glow(0x6fd0ff, 0.22));
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = 0.02;
  g.add(aura);

  g.userData = { wings: wings, neck: neck, tail: tail, tailSegs: tailSegs, legs: legs, aura: aura, flying: true };
  return g;
}

const ENEMY_BUILDERS = {
  grunt: function (c) { return buildGoblin(c, false); },
  raider: function (c) { return buildGoblin(c, true); },
  brute: function (c) { return buildSlime(c, false); },
  swarmling: function (c) { return buildSlime(c, true); },
  reaver: function (c) { return buildSkeletonKnight(c); },
  boss: function (c) { return buildDragon(c); }
};

/** Malha de inimigo, já escalada para o raio lógico usado pelo núcleo do jogo. */
export function buildEnemy(type, color, radiusWorld) {
  const build = ENEMY_BUILDERS[type] || ENEMY_BUILDERS.grunt;
  const inner = build(color);

  // Casca de gelo (exibida enquanto o inimigo está lento)
  const frost = new THREE.Mesh(ICO(0.46, 0), glow(PAL.frost, 0.3));
  frost.visible = false;
  frost.castShadow = false;
  inner.add(frost);
  inner.userData.frost = frost;

  const holder = new THREE.Group();
  holder.add(inner);
  // Raio de referência das malhas acima ≈ 0.34 unidades de mundo.
  holder.scale.setScalar(Math.max(0.68, radiusWorld / 0.25));
  holder.userData = { inner: inner, parts: inner.userData, type: type };
  return holder;
}

// ---------------------------------------------------------------------------
// Mestre de Obras
// ---------------------------------------------------------------------------

export function buildWorker() {
  const g = new THREE.Group();
  const skin = std(PAL.skin, { roughness: 0.8 });
  const shirt = std(0x8a6a3a, { roughness: 0.88 });

  const legL = mesh(BOX(0.085, 0.2, 0.1), std(0x3f2f18), -0.06, 0.1, 0);
  const legR = mesh(BOX(0.085, 0.2, 0.1), std(0x3f2f18), 0.06, 0.1, 0);
  g.add(legL, legR);

  g.add(mesh(BOX(0.24, 0.26, 0.17), shirt, 0, 0.32, 0));
  g.add(mesh(BOX(0.26, 0.06, 0.19), std(PAL.woodDark), 0, 0.23, 0));

  const head = mesh(SPH(0.115, 10, 8), skin, 0, 0.55, 0);
  g.add(head);
  // Chapéu de mestre de obras
  const hat = mesh(SPH(0.13, 10, 6), std(PAL.gold, { roughness: 0.6 }), 0, 0.6, 0);
  hat.scale.set(1, 0.62, 1);
  g.add(hat);
  g.add(mesh(CYL(0.155, 0.155, 0.025, 12), std(PAL.gold, { roughness: 0.6 }), 0, 0.575, 0));

  // Braço com martelo
  const armR = new THREE.Group();
  armR.position.set(0.17, 0.4, 0.03);
  armR.add(mesh(BOX(0.07, 0.16, 0.07), skin, 0, -0.06, 0));
  const handle = mesh(CYL(0.018, 0.018, 0.3, 6), std(PAL.woodDark), 0.02, -0.2, 0.04);
  armR.add(handle);
  armR.add(mesh(BOX(0.13, 0.08, 0.08), std(PAL.iron, { metalness: 0.5, roughness: 0.45 }), 0.02, -0.34, 0.04));
  g.add(armR);
  g.add(mesh(BOX(0.07, 0.16, 0.07), skin, -0.17, 0.34, 0.03));

  g.userData = { legL: legL, legR: legR, armR: armR, head: head };
  return g;
}

// ---------------------------------------------------------------------------
// Animação
// ---------------------------------------------------------------------------

/**
 * Anima uma torre: gira o tronco na direção do alvo, respira parada e recua
 * ao disparar (o recuo é disparado por pokeRecoil()).
 */
export function animateTower(g, info, t, dt) {
  const d = g.userData;
  const anim = d.anim || (d.anim = { yaw: info.yaw, recoil: 0, phase: Math.random() * 6.28 });

  anim.yaw = lerpAngle(anim.yaw, info.yaw, 1 - Math.pow(0.0005, dt));
  g.rotation.y = anim.yaw;

  anim.recoil = Math.max(0, anim.recoil - dt * 4.5);
  const breathe = Math.sin(t * 1.9 + anim.phase) * 0.012;

  if (d.body) {
    d.body.position.y = breathe;
    d.body.rotation.x = -anim.recoil * 0.25;
  }
  if (d.arms) {
    d.arms.rotation.x = -anim.recoil * 0.85;
    d.arms.position.z = anim.recoil * 0.06;
  }
  if (d.turret) d.turret.position.z = -anim.recoil * 0.05;

  if (d.orb) {
    d.orb.position.y = 0.62 + Math.sin(t * 2.4 + anim.phase) * 0.045;
    d.orb.rotation.set(t * 0.8, t * 1.3, 0);
    const pulse = 1 + Math.sin(t * 3.4) * 0.12 + anim.recoil * 0.6;
    d.orb.scale.setScalar(pulse);
    if (d.halo) {
      d.halo.position.y = d.orb.position.y;
      d.halo.scale.setScalar(pulse * (1 + anim.recoil));
      d.halo.material.opacity = 0.3 + Math.sin(t * 3.4) * 0.08 + anim.recoil * 0.4;
    }
  }
  if (d.shards) {
    for (let i = 0; i < d.shards.length; i++) {
      const sh = d.shards[i];
      const a = sh.userData.angle + t * 1.4;
      sh.position.set(Math.cos(a) * 0.26, 0.6 + Math.sin(a * 2) * 0.05, Math.sin(a) * 0.26);
      sh.rotation.set(t * 1.7, a, 0);
    }
  }
  if (d.runeRing) {
    d.runeRing.rotation.z = t * 0.6;
    d.runeRing.material.opacity = 0.45 + Math.sin(t * 2.6) * 0.18;
  }
  if (d.sats) {
    if (d.turret) d.turret.rotation.y = t * 0.35;
    for (let i = 0; i < d.sats.length; i++) {
      d.sats[i].position.y = 0.16 + Math.sin(t * 1.7 + i) * 0.02;
    }
  }
  if (d.mist) {
    d.mist.scale.setScalar(1 + Math.sin(t * 1.5) * 0.07);
    d.mist.material.opacity = 0.12 + Math.sin(t * 2.1) * 0.05 + anim.recoil * 0.25;
  }
  if (d.tierRing) {
    d.tierRing.scale.setScalar(1 + Math.sin(t * 2.2) * 0.05);
  }
}

/** Marca que a torre acabou de atirar — alimenta o recuo da animação. */
export function pokeRecoil(g, amount) {
  const d = g.userData;
  const anim = d.anim || (d.anim = { yaw: 0, recoil: 0, phase: 0 });
  anim.recoil = Math.min(1, anim.recoil + (amount === undefined ? 1 : amount));
}

/** Anima um inimigo: direção de marcha, passada, flutuação e efeito de gelo. */
export function animateEnemy(holder, info, t, dt) {
  const inner = holder.userData.inner;
  const p = holder.userData.parts;
  const anim = holder.userData.anim ||
    (holder.userData.anim = { yaw: info.yaw, phase: Math.random() * 6.28 });

  anim.yaw = lerpAngle(anim.yaw, info.yaw, 1 - Math.pow(0.0015, dt));
  holder.rotation.y = anim.yaw;

  const gait = t * (6 + info.speed * 0.06) + anim.phase;
  const stride = info.moving ? 1 : 0.15;

  if (p.legL && p.legR) {
    p.legL.rotation.x = Math.sin(gait) * 0.62 * stride;
    p.legR.rotation.x = -Math.sin(gait) * 0.62 * stride;
    inner.position.y = Math.abs(Math.sin(gait)) * 0.035 * stride;
  }
  if (p.armR) p.armR.rotation.x = -Math.sin(gait) * 0.42 * stride - 0.1;
  if (p.armL) p.armL.rotation.x = Math.sin(gait) * 0.42 * stride;
  if (p.head) p.head.rotation.z = Math.sin(gait * 0.5) * 0.06;
  if (p.cape) p.cape.rotation.x = 0.16 + Math.sin(gait * 0.5) * 0.12 * stride;

  // Gosmas: saltitam e achatam
  if (p.squash) {
    const hop = Math.abs(Math.sin(gait * 0.55));
    const squash = 1 - hop * 0.16;
    inner.position.y = hop * 0.14 * stride;
    if (p.blob) {
      p.blob.scale.set(1.06 / squash, 0.86 * squash * (1 + hop * 0.2), 1.06 / squash);
      p.blob.rotation.y = t * 0.4;
    }
    if (p.core) p.core.scale.setScalar(1 + Math.sin(t * 5 + anim.phase) * 0.08);
  }

  // Dragão: paira, bate as asas e balança pescoço e cauda
  if (p.flying) {
    const flap = Math.sin(t * 5.2 + anim.phase);
    inner.position.y = 0.34 + flap * 0.075;
    for (let i = 0; i < p.wings.length; i++) {
      const w = p.wings[i];
      w.group.rotation.z = w.side * (0.35 + flap * 0.75);
      w.group.rotation.x = flap * 0.12;
    }
    if (p.neck) {
      p.neck.rotation.x = Math.sin(t * 1.6 + anim.phase) * 0.1;
      p.neck.rotation.y = Math.sin(t * 0.9) * 0.14;
    }
    if (p.tail) p.tail.rotation.y = Math.sin(t * 1.8 + anim.phase) * 0.28;
    for (let i = 0; i < p.legs.length; i++) {
      p.legs[i].rotation.x = 0.25 + Math.sin(t * 1.4 + i) * 0.08;
    }
    if (p.aura) {
      p.aura.position.y = -inner.position.y + 0.02;
      p.aura.material.opacity = 0.16 + Math.sin(t * 2.6) * 0.07;
      p.aura.scale.setScalar(1 + Math.sin(t * 2.6) * 0.06);
    }
  }

  // Congelamento
  if (p.frost) {
    p.frost.visible = info.slowed;
    if (info.slowed) {
      p.frost.scale.setScalar(1 + Math.sin(t * 7 + anim.phase) * 0.05);
      p.frost.material.opacity = 0.22 + Math.sin(t * 5) * 0.08;
    }
  }
}

/** Anima o Mestre de Obras: andar, martelar ou esperar. */
export function animateWorker(g, info, t, dt) {
  const p = g.userData;
  const anim = p.anim || (p.anim = { yaw: 0 });
  anim.yaw = lerpAngle(anim.yaw, info.yaw, 1 - Math.pow(0.002, dt));
  g.rotation.y = anim.yaw;

  if (info.walking) {
    const gait = t * 11;
    p.legL.rotation.x = Math.sin(gait) * 0.7;
    p.legR.rotation.x = -Math.sin(gait) * 0.7;
    p.armR.rotation.x = -Math.sin(gait) * 0.4;
    g.position.y = Math.abs(Math.sin(gait)) * 0.04;
  } else if (info.building) {
    // Martelada: sobe devagar, desce rápido
    const swing = (Math.sin(t * 9) + 1) / 2;
    p.armR.rotation.x = -2.0 + Math.pow(swing, 0.45) * 2.3;
    p.legL.rotation.x = p.legR.rotation.x = 0;
    g.position.y = 0;
  } else {
    p.legL.rotation.x = p.legR.rotation.x = 0;
    p.armR.rotation.x = Math.sin(t * 2) * 0.12;
    g.position.y = Math.sin(t * 2) * 0.012;
  }
}
