// -----------------------------------------------------------------------------
// Bastion Line — atores 3D
// Malhas procedurais de torres, inimigos e do Mestre de Obras.
// Tudo é montado a partir de primitivas com flat shading: nada de assets
// externos, e o visual fica coerente entre as peças.
// -----------------------------------------------------------------------------
import { THREE, PAL, geo, std, glow, glowTexture, mesh, rng, lerpAngle, damp, shade } from './core.js';
import { piece, stackPieces } from './towerKit.js';

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
// A arquitetura vem do Castle Kit (Kenney, CC0): peças empilháveis de pedra,
// madeira e telhado. Quem ocupa a torre continua procedural — o soldado, a
// arqueira, o orbe do mago e os cristais são o que se mexe, e é por eles que
// se lê o tipo e a evolução à distância.

// Uma peça do kit nasce como um cubo de ~1 unidade, do tamanho de uma casa do
// tabuleiro. Reduzir por igual deixaria a torre fina demais para a casa; a
// altura encolhe mais que a largura, e o torreão fica atarracado — o que
// também evita que uma torre alta esconda os inimigos atrás dela.
const KIT_W = 0.62;
const KIT_H = 0.4;
const OCCUPANT_SCALE = 0.62;

/** Corpo humanoide genérico usado pelos ocupantes (pernas, tronco, cabeça). */
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

/** Soldado da Milícia: elmo, tabardo e o par de armas do ramo escolhido. */
function militiaOccupant(tier, branch, color) {
  const body = humanoid(color, PAL.skin, 1 + (tier - 1) * 0.1);

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
    const shield = mesh(BOX(0.05, 0.32 + tier * 0.04, 0.26 + tier * 0.04), std(PAL.wood, { roughness: 0.8 }), -0.18, 0.02, 0.05);
    arms.add(shield);
    arms.add(mesh(BOX(0.02, 0.12, 0.12), std(PAL.gold, { metalness: 0.5, roughness: 0.4 }), -0.21, 0.02, 0.05));
    const sword = mesh(BOX(0.045, 0.38, 0.015), std(PAL.iron, { metalness: 0.6, roughness: 0.35 }), 0.19, 0.14, 0.04);
    sword.rotation.z = -0.35;
    arms.add(sword);
  }
  body.add(arms);

  return { root: body, body: body, arms: arms };
}

/** Arqueira encapuzada: arco longo ou besta pesada, conforme o ramo. */
function archerOccupant(tier, branch, color) {
  const body = humanoid(color, PAL.skin, 0.92 + (tier - 1) * 0.06);
  body.add(mesh(CONE(0.11, 0.16, 6), std(color, { roughness: 0.85 }), 0, 0.54, 0));

  const arms = new THREE.Group();
  arms.position.y = 0.33;
  if (branch === 'francoatiradora') {
    // Besta pesada
    arms.add(mesh(BOX(0.07, 0.07, 0.36), std(PAL.woodDark), 0, 0.02, 0.12));
    arms.add(mesh(BOX(0.32, 0.035, 0.035), std(PAL.iron, { metalness: 0.5, roughness: 0.4 }), 0, 0.04, 0.26));
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
    arms.add(mesh(BOX(0.008, 0.36, 0.008), std(PAL.cloth), 0.02, 0.03, 0.15));
  }
  body.add(arms);

  return { root: body, body: body, arms: arms };
}

/** Orbe do Mago: o que pulsa, gira e denuncia o ramo pela cor. */
function mageOccupant(tier, branch, color) {
  const root = new THREE.Group();
  const orbColor = branch === 'piromante' ? PAL.ember : color;

  const orb = new THREE.Mesh(ICO(0.1, 0), std(orbColor, {
    emissive: orbColor, emissiveIntensity: 1.5, roughness: 0.3
  }));
  orb.position.set(0, 0.16, 0);
  orb.castShadow = false;
  root.add(orb);

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: orbColor, transparent: true, opacity: 0.45,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  }));
  halo.scale.setScalar(0.46);
  halo.position.copy(orb.position);
  root.add(halo);

  const shards = [];
  const shardCount = tier >= 3 ? 5 : tier >= 2 ? 3 : 0;
  for (let i = 0; i < shardCount; i++) {
    const sh = mesh(OCT(0.045), std(orbColor, { emissive: orbColor, emissiveIntensity: 0.9, roughness: 0.35 }));
    sh.castShadow = false;
    sh.userData.angle = (i / shardCount) * Math.PI * 2;
    root.add(sh);
    shards.push(sh);
  }

  return { root: root, orb: orb, halo: halo, shards: shards, orbY: 0.16 };
}

/** Cristais da Gélida: crescem em número com o tier e giram devagar. */
function frostOccupant(tier, branch, color) {
  const root = new THREE.Group();
  const crystalMat = std(color, {
    emissive: color, emissiveIntensity: 0.55,
    roughness: 0.15, metalness: 0.15, transparent: true, opacity: 0.9
  });

  const spireH = 0.34 + tier * 0.1;
  const spire = mesh(OCT(0.13), crystalMat, 0, spireH * 0.5, 0);
  spire.scale.set(0.8, spireH * 3.2, 0.8);
  root.add(spire);

  const sats = [];
  const satCount = branch === 'cristalina' ? 4 + tier : 2 + tier;
  for (let i = 0; i < satCount; i++) {
    const a = (i / satCount) * Math.PI * 2;
    const rad = 0.16 + (i % 2) * 0.04;
    const sc = 0.42 + (i % 3) * 0.13;
    const c = mesh(OCT(0.1), crystalMat, Math.cos(a) * rad, 0.1 + sc * 0.18, Math.sin(a) * rad);
    c.scale.set(sc, sc * 2.1, sc);
    c.rotation.set(0, a, 0);
    c.userData.baseY = c.position.y;
    root.add(c);
    sats.push(c);
  }

  const mist = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24), glow(PAL.frost, 0.16).clone());
  mist.rotation.x = -Math.PI / 2;
  mist.position.y = 0.02;
  root.add(mist);

  return { root: root, sats: sats, mist: mist };
}

/**
 * Peças do kit para cada torre. A silhueta separa os quatro tipos mesmo de
 * longe: quadrada para a Milícia, plataforma de madeira para a Arqueira,
 * hexagonal com pináculo para o Mago, tambor redondo para a Gélida.
 */
const RECIPES = {
  militia: function (tier, branch) {
    const wall = branch === 'guerreiro' ? 'tower-square-mid-windows' : 'tower-square-mid';
    if (tier <= 1) return { stack: ['tower-square-base', 'tower-square-top'] };
    if (tier === 2) return { stack: ['tower-square-base', wall, 'tower-square-top'] };
    return {
      stack: ['tower-square-base', wall, wall, 'tower-square-top'],
      flag: branch === 'guerreiro' ? 'flag-pennant' : 'flag-banner-short'
    };
  },
  archer: function (tier, branch) {
    const mount = branch === 'francoatiradora' ? 'siege-ballista' : null;
    if (tier <= 1) return { stack: ['tower-square-base', 'tower-square-mid-open-simple'] };
    if (tier === 2) {
      return { stack: ['tower-square-base', 'tower-square-mid', 'tower-square-mid-open'], mount: mount };
    }
    return {
      stack: ['tower-square-base', 'tower-square-mid', 'tower-square-mid', 'tower-square-mid-open'],
      mount: mount,
      flag: 'flag-pennant'
    };
  },
  mage: function (tier) {
    if (tier <= 1) return { stack: ['tower-hexagon-base', 'tower-hexagon-mid'] };
    if (tier === 2) {
      return { stack: ['tower-hexagon-base', 'tower-hexagon-mid', 'tower-hexagon-top', 'tower-hexagon-roof'] };
    }
    return {
      stack: ['tower-hexagon-base', 'tower-hexagon-mid', 'tower-hexagon-mid', 'tower-hexagon-top', 'tower-hexagon-roof-secondary']
    };
  },
  frost: function (tier) {
    if (tier <= 1) return { stack: ['tower-base'] };
    if (tier === 2) return { stack: ['tower-base', 'tower-top'] };
    return { stack: ['tower-base', 'tower-base', 'tower-top'] };
  }
};

const OCCUPANTS = {
  militia: militiaOccupant,
  archer: archerOccupant,
  mage: mageOccupant,
  frost: frostOccupant
};

/** Monta a malha de uma torre a partir do tipo, tier, ramo e cor do núcleo 2D. */
export function buildTower(type, tier, branch, color) {
  const recipe = (RECIPES[type] || RECIPES.militia)(tier, branch);
  const g = new THREE.Group();

  const shell = stackPieces(recipe.stack);
  shell.group.scale.set(KIT_W, KIT_H, KIT_W);
  g.add(shell.group);

  // O casco fica parado; só o que ocupa o topo gira para mirar. O ocupante
  // fica fora do grupo achatado, para não sair esticado junto com a pedra.
  const turret = new THREE.Group();
  turret.position.y = shell.lastBase * KIT_H;
  g.add(turret);

  const occupant = (OCCUPANTS[type] || OCCUPANTS.militia)(tier, branch, color);
  occupant.root.scale.multiplyScalar(OCCUPANT_SCALE);
  // Orbe e cristais coroam a torre; soldado e arqueira ficam no piso da ameia.
  if (type === 'mage' || type === 'frost') turret.position.y = shell.top * KIT_H;
  turret.add(occupant.root);

  if (recipe.mount) {
    const mount = piece(recipe.mount);
    mount.scale.setScalar(KIT_W * 0.62);
    mount.position.set(0, 0, 0.06);
    turret.add(mount);
  }
  if (recipe.flag) {
    const flag = piece(recipe.flag);
    flag.scale.setScalar(KIT_W * 0.8);
    flag.position.set(0.21, shell.lastBase * KIT_H, -0.21);
    g.add(flag);
  }

  // Auréola dourada das evoluções, lida de longe.
  if (tier >= 2) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.33, 0.4, 28),
      new THREE.MeshBasicMaterial({
        color: tier >= 3 ? PAL.goldLight : PAL.gold,
        transparent: true, opacity: tier >= 3 ? 0.85 : 0.6,
        depthWrite: false, side: THREE.DoubleSide, toneMapped: false
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    g.add(ring);
    g.userData.tierRing = ring;
  }

  g.userData.turret = turret;
  g.userData.body = occupant.body || null;
  g.userData.arms = occupant.arms || null;
  g.userData.orb = occupant.orb || null;
  g.userData.halo = occupant.halo || null;
  g.userData.shards = occupant.shards || null;
  g.userData.sats = occupant.sats || null;
  g.userData.mist = occupant.mist || null;
  g.userData.orbY = occupant.orbY || 0;
  g.userData.recoil = 0;
  g.userData.tier = tier;
  g.userData.type = type;
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
  const aura = new THREE.Mesh(new THREE.CircleGeometry(0.85, 28), glow(0x6fd0ff, 0.22).clone());
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = 0.02;
  g.add(aura);

  g.userData = { wings: wings, neck: neck, tail: tail, tailSegs: tailSegs, legs: legs, aura: aura, flying: true };
  return g;
}

/**
 * Harpia: voador leve. Reaproveita a lógica de asas do dragão em escala menor,
 * com silhueta bem diferente — corpo esguio e asas longas — para não se
 * confundir com o chefe na distância da câmera.
 */
function buildHarpy(color) {
  const g = new THREE.Group();
  const body = std(color, { roughness: 0.7 });
  const feather = std(shade(color, 0.72), { roughness: 0.8, side: THREE.DoubleSide });

  const torso = mesh(ICO(0.2, 0), body, 0, 0.3, 0);
  torso.scale.set(0.85, 1.25, 0.9);
  g.add(torso);

  const head = mesh(SPH(0.115, 8, 6), std(shade(color, 1.3), { roughness: 0.7 }), 0, 0.53, 0.04);
  g.add(head);
  const beak = mesh(CONE(0.045, 0.14, 4), std(PAL.gold, { roughness: 0.5 }), 0, 0.51, 0.14);
  beak.rotation.x = Math.PI / 2;
  g.add(beak);
  for (let side = -1; side <= 1; side += 2) {
    const eye = mesh(SPH(0.025, 6, 6), std(0xffe9a8, { emissive: 0xffc94a, emissiveIntensity: 1.2 }), side * 0.05, 0.56, 0.1);
    eye.castShadow = false;
    g.add(eye);
  }

  // Garras recolhidas sob o corpo
  for (let side = -1; side <= 1; side += 2) {
    const claw = mesh(BOX(0.05, 0.16, 0.06), std(PAL.ironDark), side * 0.08, 0.13, 0.02);
    claw.rotation.x = 0.5;
    g.add(claw);
  }

  const wings = [];
  for (let side = -1; side <= 1; side += 2) {
    const wing = new THREE.Group();
    wing.position.set(side * 0.13, 0.36, 0);
    const membrane = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.3, 3, 1), feather);
    membrane.position.set(side * 0.32, 0.03, -0.03);
    membrane.rotation.y = side * 0.18;
    membrane.castShadow = true;
    wing.add(membrane);
    for (let i = 0; i < 2; i++) {
      const rib = mesh(BOX(0.34, 0.018, 0.018), std(shade(color, 0.55)), side * 0.2, 0.06 - i * 0.08, -0.03);
      rib.rotation.z = side * (0.18 - i * 0.16);
      rib.castShadow = false;
      wing.add(rib);
    }
    g.add(wing);
    wings.push({ group: wing, side: side });
  }

  const tail = new THREE.Group();
  tail.position.set(0, 0.24, -0.16);
  const plume = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.4, 1, 2), feather);
  plume.position.set(0, -0.04, -0.18);
  plume.rotation.x = -0.5;
  tail.add(plume);
  g.add(tail);

  g.userData = { wings: wings, tail: tail, head: head, flying: true, legs: [],
                 fastFlap: true, hoverBase: 0 };
  return g;
}

const ENEMY_BUILDERS = {
  grunt: function (c) { return buildGoblin(c, false); },
  raider: function (c) { return buildGoblin(c, true); },
  brute: function (c) { return buildSlime(c, false); },
  swarmling: function (c) { return buildSlime(c, true); },
  reaver: function (c) { return buildSkeletonKnight(c); },
  harpy: function (c) { return buildHarpy(c); },
  boss: function (c) { return buildDragon(c); }
};

/** Malha de inimigo, já escalada para o raio lógico usado pelo núcleo do jogo. */
export function buildEnemy(type, color, radiusWorld) {
  const build = ENEMY_BUILDERS[type] || ENEMY_BUILDERS.grunt;
  const inner = build(color);

  // Casca de gelo (exibida enquanto o inimigo está lento)
  const frost = new THREE.Mesh(ICO(0.46, 0), glow(PAL.frost, 0.3).clone());
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
  if (d.turret) d.turret.rotation.y = anim.yaw;

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
    d.orb.position.y = d.orbY + Math.sin(t * 2.4 + anim.phase) * 0.045;
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
      sh.position.set(Math.cos(a) * 0.2, d.orbY + Math.sin(a * 2) * 0.05, Math.sin(a) * 0.2);
      sh.rotation.set(t * 1.7, a, 0);
    }
  }
  if (d.sats) {
    // A Gélida não mira: os cristais giram devagar o tempo todo.
    if (d.turret) d.turret.rotation.y = t * 0.35;
    for (let i = 0; i < d.sats.length; i++) {
      const c = d.sats[i];
      c.position.y = c.userData.baseY + Math.sin(t * 1.7 + i) * 0.015;
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
    const flap = Math.sin(t * (p.fastFlap ? 8.5 : 5.2) + anim.phase);
    inner.position.y = (p.hoverBase === undefined ? 0.34 : p.hoverBase) + flap * 0.075;
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
