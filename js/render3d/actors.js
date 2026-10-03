// -----------------------------------------------------------------------------
// Bastion Line — atores 3D
// Malhas procedurais de torres, inimigos e do Mestre de Obras.
// As oito fundações têm arquitetura própria; ocupantes e armas animam no topo.
// -----------------------------------------------------------------------------
import { THREE, PAL, geo, std, glow, glowTexture, mesh, rng, lerpAngle, damp, shade } from './core.js?v=siege-art-6';
import { attachDetailedTower } from './towerModels.js?v=siege-art-6';
import { buildTowerArchitecture } from './towerArchitecture.js?v=siege-art-6';

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
const OCCUPANT_SCALE = 0.82;

/** Corpo humanoide genérico usado pelos ocupantes (pernas, tronco, cabeça). */
function humanoid(cloth, skin, scale) {
  const g = new THREE.Group();
  const s = scale || 1;
  const clothMat = std(cloth, { roughness: 0.8 });
  const clothDark = std(shade(cloth,0.62), { roughness: 0.92, side: THREE.DoubleSide });
  const skinMat = std(skin || PAL.skin, { roughness: 0.75 });

  const legL = mesh(BOX(0.075, 0.2, 0.09), std(PAL.woodDark), -0.055, 0.1, 0);
  const legR = mesh(BOX(0.075, 0.2, 0.09), std(PAL.woodDark), 0.055, 0.1, 0);
  g.add(legL, legR);

  const torso = mesh(BOX(0.2, 0.24, 0.14), clothMat, 0, 0.32, 0);
  g.add(torso);
  g.add(mesh(BOX(0.29, 0.065, 0.18), clothDark, 0, 0.43, 0));
  g.add(mesh(BOX(0.22, 0.045, 0.17), std(PAL.woodDark), 0, 0.245, 0));
  const cloak=mesh(BOX(0.23, 0.29, 0.018),clothDark,0,0.29,-0.10);
  cloak.rotation.x=-0.15;g.add(cloak);
  for(const side of [-1,1])
    g.add(mesh(BOX(0.085,0.07,0.1),std(PAL.woodDark),side*0.055,0.07,0.02));
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

/** Bobina: hastes metálicas, anéis girando e um núcleo que crepita. */
function lightningOccupant(tier, branch, color) {
  const root = new THREE.Group();
  const metal = std(PAL.iron, { metalness: 0.7, roughness: 0.3 });
  const arc = std(color, { emissive: color, emissiveIntensity: 1.8, roughness: 0.25 });

  root.add(mesh(CYL(0.035, 0.06, 0.26, 6), metal, 0, 0.13, 0));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const haste = mesh(CYL(0.016, 0.02, 0.22, 5), metal, Math.cos(a) * 0.1, 0.24, Math.sin(a) * 0.1);
    haste.rotation.z = Math.cos(a) * 0.25;
    haste.rotation.x = -Math.sin(a) * 0.25;
    root.add(haste);
  }

  // O núcleo é o "orbe" que animateTower já sabe pulsar e girar.
  const orb = mesh(ICO(0.085, 0), arc, 0, 0.4, 0);
  orb.castShadow = false;
  root.add(orb);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.36), glow(color, 0.55).clone());
  halo.position.copy(orb.position);
  root.add(halo);

  // Anéis: no ramo do canhão viram um cano apontado; no da corrente, orbitam.
  const sats = [];
  if (branch === 'canhao') {
    const cano = mesh(CYL(0.05, 0.07, 0.34, 8), metal, 0, 0.4, 0.14);
    cano.rotation.x = Math.PI / 2;
    root.add(cano);
    if (tier >= 3) root.add(mesh(CYL(0.03, 0.03, 0.12, 6), arc, 0, 0.4, 0.3));
  } else {
    const anelCount = tier >= 3 ? 3 : tier >= 2 ? 2 : 1;
    for (let i = 0; i < anelCount; i++) {
      const anel = new THREE.Mesh(
        geo('coil-ring', function () { return new THREE.TorusGeometry(0.15, 0.012, 5, 18); }), arc);
      anel.position.y = 0.4;
      anel.rotation.x = Math.PI / 2 + i * 0.7;
      anel.castShadow = false;
      anel.userData.baseY = 0.4;
      root.add(anel);
      sats.push(anel);
    }
  }

  return { root: root, orb: orb, halo: halo, sats: sats, orbY: 0.4 };
}

/** Druida: tronco retorcido e copa de folhas, com esporos subindo. */
function natureOccupant(tier, branch, color) {
  const root = new THREE.Group();
  const casca = std(PAL.woodDark, { roughness: 0.95 });
  const folha = std(color, { roughness: 0.85 });
  const folhaAlt = std(shade(color, branch === 'praga' ? 0.75 : 1.2), { roughness: 0.85 });

  const tronco = mesh(CYL(0.05, 0.08, 0.3, 6), casca, 0, 0.15, 0);
  tronco.rotation.z = 0.06;
  root.add(tronco);

  // Copa em camadas: quanto maior o tier, mais densa
  const camadas = 1 + tier;
  for (let i = 0; i < camadas; i++) {
    const r = 0.22 - i * 0.045;
    const copa = mesh(CONE(r, 0.2, 6), i % 2 ? folhaAlt : folha, 0, 0.32 + i * 0.13, 0);
    copa.rotation.y = i * 0.5;
    root.add(copa);
  }

  // Esporos: o ramo da praga sobe esverdeado-doente, o do bosque dourado
  const sats = [];
  const esporoMat = std(branch === 'praga' ? 0x9fd84a : 0xd9e88a,
    { emissive: branch === 'praga' ? 0x6f9f1a : 0xb0c050, emissiveIntensity: 1.2, roughness: 0.4 });
  for (let i = 0; i < 3 + tier; i++) {
    const a = (i / (3 + tier)) * Math.PI * 2;
    const esporo = mesh(OCT(0.025), esporoMat, Math.cos(a) * 0.2, 0.3, Math.sin(a) * 0.2);
    esporo.castShadow = false;
    esporo.userData.baseY = 0.3;
    root.add(esporo);
    sats.push(esporo);
  }

  // Tapete de musgo: marca visualmente o alcance da cura
  const musgo = new THREE.Mesh(new THREE.CircleGeometry(0.36, 24), glow(color, 0.14).clone());
  musgo.rotation.x = -Math.PI / 2;
  musgo.position.y = 0.02;
  root.add(musgo);

  return { root: root, sats: sats, mist: musgo };
}

/** Armadilha: placa de pressão e espinhos, tudo rente ao chão. */
function trapOccupant(tier, branch, color) {
  const root = new THREE.Group();
  const madeira = std(PAL.woodDark, { roughness: 0.95 });
  const ferro = std(PAL.iron, { metalness: 0.6, roughness: 0.4 });

  const placa = mesh(CYL(0.36, 0.38, 0.05, 8), madeira, 0, 0.025, 0);
  root.add(placa);
  root.add(mesh(CYL(0.28, 0.28, 0.03, 8), std(color, { roughness: 0.8 }), 0, 0.055, 0));

  // Espinhos: mais numerosos e maiores a cada evolução
  const sats = [];
  const n = 5 + tier * 2;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 0.1 + (i % 2) * 0.12;
    const esp = mesh(CONE(0.03, 0.12 + tier * 0.03, 4), ferro, Math.cos(a) * r, 0.1, Math.sin(a) * r);
    esp.userData.baseY = 0.1;
    root.add(esp);
    sats.push(esp);
  }

  if (branch === 'explosiva') {
    // Barril: o ramo explosivo tem massa visível no centro
    const barril = mesh(CYL(0.13, 0.15, 0.22, 8), std(0x8a5a2a, { roughness: 0.9 }), 0, 0.17, 0);
    root.add(barril);
    root.add(mesh(CYL(0.155, 0.155, 0.03, 8), ferro, 0, 0.22, 0));
  } else if (branch === 'toxica') {
    const caldeira = mesh(CYL(0.12, 0.14, 0.14, 8), std(0x4a5a3a, { roughness: 0.9 }), 0, 0.13, 0);
    root.add(caldeira);
    const gosma = mesh(CYL(0.11, 0.11, 0.02, 8),
      std(color, { emissive: color, emissiveIntensity: 1.1, roughness: 0.3 }), 0, 0.21, 0);
    gosma.castShadow = false;
    root.add(gosma);
  }

  const aviso = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.46, 20), glow(color, 0.3).clone());
  aviso.rotation.x = -Math.PI / 2;
  aviso.position.y = 0.012;
  root.add(aviso);

  return { root: root, sats: sats, mist: aviso };
}

/** Necromante: figura encapuzada com um crânio flutuando sobre o cajado. */
function necroOccupant(tier, branch, color) {
  const root = new THREE.Group();
  const manto = std(color, { roughness: 0.9 });
  const mantoEsc = std(shade(color, 0.6), { roughness: 0.9 });

  root.add(mesh(CONE(0.15, 0.34, 8), manto, 0, 0.17, 0));
  const capuz = mesh(SPH(0.095, 10, 7), mantoEsc, 0, 0.38, 0);
  capuz.scale.set(1, 1.15, 1);
  root.add(capuz);
  // Vazio sob o capuz, com duas brasas
  for (let side = -1; side <= 1; side += 2) {
    const brasa = mesh(SPH(0.022, 6, 6),
      std(0xc9a0ff, { emissive: 0xa050ff, emissiveIntensity: 2 }), side * 0.035, 0.37, 0.08);
    brasa.castShadow = false;
    root.add(brasa);
  }

  root.add(mesh(CYL(0.016, 0.02, 0.44, 6), std(PAL.woodDark), 0.14, 0.24, 0.02));

  // O crânio é o "orbe": animateTower já o faz pairar e girar.
  const orb = mesh(BOX(0.11, 0.1, 0.1), std(PAL.bone, { emissive: 0x5a4a7a, emissiveIntensity: 0.5, roughness: 0.6 }), 0.14, 0.5, 0.02);
  orb.castShadow = false;
  root.add(orb);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), glow(0xa050ff, 0.45).clone());
  halo.position.copy(orb.position);
  root.add(halo);

  // Almas orbitando: uma por esqueleto que a torre sustenta
  const sats = [];
  const almas = branch === 'senhor' ? 2 + tier : tier;
  for (let i = 0; i < almas; i++) {
    const alma = mesh(OCT(0.032), std(0xb89aff, { emissive: 0x8a4aff, emissiveIntensity: 1.4, roughness: 0.3 }), 0, 0.3, 0);
    alma.castShadow = false;
    alma.userData.baseY = 0.3;
    root.add(alma);
    sats.push(alma);
  }

  return { root: root, orb: orb, halo: halo, sats: sats, orbY: 0.5 };
}

/** Esqueleto invocado: o cavaleiro morto, menor e sem os metais do original. */
export function buildMinion() {
  const holder = new THREE.Group();
  const inner = buildSkeletonKnight(0x8f8f98);
  inner.scale.setScalar(0.62);
  holder.add(inner);
  holder.userData = { inner: inner, parts: inner.userData };
  return holder;
}

const OCCUPANTS = {
  militia: militiaOccupant,
  archer: archerOccupant,
  mage: mageOccupant,
  frost: frostOccupant,
  lightning: lightningOccupant,
  nature: natureOccupant,
  trap: trapOccupant,
  necro: necroOccupant
};

// Paletas e coroas inspiradas na prancha de evolução: cada ramo é reconhecível
// pela cor e a forma suprema tem silhueta própria, mesmo vista de cima.
const EVOLUTION_COLORS = {
  militia: { guardiao: 0xe9aa48, guerreiro: 0xf05b38 },
  archer: { patrulheira: 0x86d84a, francoatiradora: 0x55baff },
  mage: { piromante: 0xff6a28, arcanista: 0x665bff },
  frost: { eterna: 0x8edaff, cristalina: 0x31b9ff },
  lightning: { corrente: 0x39b8ff, canhao: 0xffb347 },
  nature: { bosque: 0xa8e852, praga: 0x9d54d4 },
  trap: { toxica: 0x83e34f, explosiva: 0xff6c2f },
  necro: { lich: 0x9c56ff, senhor: 0xdfc887 }
};

function addEvolutionSilhouette(group, turret, type, tier, branch, accent) {
  if (tier < 5) return;
  const metal = std(PAL.goldLight, { metalness: 0.7, roughness: 0.35 });
  const magic = std(accent, { emissive: accent, emissiveIntensity: 1.2, roughness: 0.3 });
  const crown = new THREE.Group();
  crown.position.y = type === 'trap' ? 0.16 : 0.58;
  if (type === 'militia') {
    // Guardião: escudo dourado; Guerreiro: lâminas escarlates cruzadas.
    for (let s = -1; s <= 1; s += 2) {
      const blade = mesh(BOX(0.06, branch === 'guerreiro' ? 0.48 : 0.28, 0.025), branch === 'guerreiro' ? magic : metal, s * 0.14, 0, 0);
      blade.rotation.z = s * (branch === 'guerreiro' ? 0.45 : 0.1); crown.add(blade);
    }
  } else if (type === 'archer') {
    // Patrulheira: folhas/arcos; Franco: mira e virote longo.
    if (branch === 'patrulheira') {
      for (let s = -1; s <= 1; s += 2) crown.add(mesh(CONE(0.1, 0.35, 5), magic, s * 0.16, 0, 0));
    } else {
      crown.add(mesh(CYL(0.03, 0.04, 0.46, 8), metal, 0, 0, 0.06));
      crown.add(mesh(OCT(0.11), magic, 0, 0.27, 0.06));
    }
  } else if (type === 'mage') {
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2;
      crown.add(mesh(branch==='piromante'?CONE(0.075,0.31,5):OCT(0.11),magic,
        Math.cos(a)*0.23,branch==='piromante'?0.1:0.05,Math.sin(a)*0.23));
    }
  } else if (type === 'frost') {
    const count=branch==='cristalina'?5:3;
    for(let i=0;i<count;i++){
      const a=i*Math.PI*2/count;
      const shard=mesh(OCT(branch==='cristalina'?0.13:0.09),magic,Math.cos(a)*0.23,0.08,Math.sin(a)*0.23);
      shard.scale.y=branch==='cristalina'?2.3:1.4;crown.add(shard);
    }
  } else if (type === 'lightning') {
    if(branch==='canhao'){
      const barrel=mesh(CYL(0.11,0.13,0.5,8),metal,0,-0.11,0.21);
      barrel.rotation.x=Math.PI/2;crown.add(barrel);
      crown.add(mesh(OCT(0.1),magic,0,-0.11,0.47));
    }else{
      for(const s of [-1,1])crown.add(mesh(OCT(0.11),magic,s*0.22,0.08,0));
    }
  } else if (type === 'nature') {
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5;
      crown.add(mesh(CONE(0.09, 0.28, 5), magic, Math.cos(a) * 0.18, 0.05, Math.sin(a) * 0.18));
    }
  } else if (type === 'necro') {
    crown.add(mesh(CONE(0.16, 0.38, 6), magic, 0, 0.14, 0));
    if (branch === 'senhor') for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      crown.add(mesh(SPH(0.055), metal, Math.cos(a) * 0.22, -0.08, Math.sin(a) * 0.22));
    }
  } else if (type === 'trap') {
    crown.add(mesh(ICO(0.15), magic, 0, 0.08, 0));
  }
  (type === 'trap' ? group : turret).add(crown);
}

/** Monta a malha de uma torre a partir do tipo, tier, ramo e cor do núcleo 2D. */
export function buildTower(type, tier, branch, color, options) {
  color = (EVOLUTION_COLORS[type] && EVOLUTION_COLORS[type][branch]) || color;
  const g = new THREE.Group();

  const shell = buildTowerArchitecture(type, tier, branch, color);
  g.add(shell.group);

  // O casco fica parado; só o que ocupa o topo gira para mirar. O ocupante
  // fica fora do grupo achatado, para não sair esticado junto com a pedra.
  const turret = new THREE.Group();
  turret.position.y = shell.lastBase;
  g.add(turret);

  const occupant = (OCCUPANTS[type] || OCCUPANTS.militia)(tier, branch, color);
  occupant.root.scale.multiplyScalar(OCCUPANT_SCALE);
  // Orbe e cristais coroam a torre; soldado e arqueira ficam no piso da ameia.
  if (type === 'mage' || type === 'frost' || type === 'lightning' ||
      type === 'nature' || type === 'necro') {
    turret.position.y = shell.top;
  }
  turret.add(occupant.root);
  addEvolutionSilhouette(g, turret, type, tier, branch, color);

  // Auréola dourada das evoluções, lida de longe.
  if (tier >= 2) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.33, 0.4, 28),
      new THREE.MeshBasicMaterial({
        color: tier >= 4 ? color : tier >= 3 ? PAL.goldLight : PAL.gold,
        transparent: true, opacity: tier >= 5 ? 0.95 : tier >= 3 ? 0.85 : 0.6,
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
  g.userData.height = type === 'trap' ? 0.32 : 1.15;
  return attachDetailedTower(g, type, tier, branch, options);
}

// ---------------------------------------------------------------------------
// Inimigos
// ---------------------------------------------------------------------------

// Enemy-only pieces. Animated Mesh joints retain the original public types.
function enemyPiece(parent, geometry, material, x=0, y=0, z=0, rx=0, ry=0, rz=0) {
  const m = mesh(geometry, material, x, y, z);
  m.rotation.set(rx, ry, rz); parent.add(m); return m;
}
function enemyJoint(parent, material, x, y, z, radius=0.035, group=false) {
  const j = group ? new THREE.Group() : mesh(SPH(radius, 6, 4), material);
  j.position.set(x,y,z); parent.add(j); return j;
}
function enemyLeg(parent, material, boot, x, height, width, z=0) {
  const j=enemyJoint(parent,material,x,height,z,width*0.45);
  enemyPiece(j,CYL(width*0.45,width*0.36,height*0.48,5),material,0,-height*0.24,0);
  enemyPiece(j,BOX(width,height*0.4,width),boot,0,-height*0.66,0);
  enemyPiece(j,BOX(width*1.15,height*0.18,width*1.6),boot,0,-height*0.91,width*0.22);
  return j;
}
function enemyArm(parent, skin, cuff, x, y, length, width, group=true) {
  const j=enemyJoint(parent,skin,x,y,0.02,width*0.55,group);
  enemyPiece(j,CYL(width*0.55,width*0.45,length*0.5,6),skin,0,-length*0.23,0);
  enemyPiece(j,CYL(width*0.48,width*0.6,length*0.36,6),cuff,0,-length*0.64,0.02,-0.22);
  enemyPiece(j,BOX(width*1.15,length*0.22,width*1.2),skin,0,-length*0.86,0.04);
  return j;
}
function enemyEyes(head, material, x, y, z, size=0.022) {
  for(const side of [-1,1]) {
    const eye=enemyPiece(head,BOX(size*1.4,size,size*0.6),material,side*x,y,z);
    eye.castShadow=false;
  }
}
function enemyBlade(arm, steel, leather, y, curved=false) {
  enemyPiece(arm,CYL(0.018,0.02,0.09,5),leather,0,y,0.07);
  enemyPiece(arm,BOX(0.10,0.022,0.035),steel,0,y+0.05,0.07);
  enemyPiece(arm,BOX(0.035,0.16,0.018),steel,0,y+0.14,0.07,0,0,curved?-0.18:0);
  enemyPiece(arm,CONE(0.024,0.09,3),steel,curved?0.026:0,y+0.25,0.07,0,0,curved?-0.5:0);
}
function enemyCape(parent, material, width, height, y, z) {
  const cape=enemyPiece(parent,BOX(width,0.025,0.03),material,0,y,z);
  for(let i=0;i<5;i++) {
    const h=height*(i%2?0.82:1);
    enemyPiece(cape,BOX(width/5*0.94,h,0.025),material,(i-2)*width/5,-h/2,0,0,0,(i-2)*0.035);
  }
  return cape;
}
function enemyFeather(parent, material, x,y,z,length, angle=0) {
  const f=enemyPiece(parent,OCT(0.06),material,x,y,z,0,0,angle);
  f.scale.set(0.65,length/0.12,0.22); return f;
}

function buildGoblin(color, scout) {
  const g=new THREE.Group(), skin=std(color), light=std(shade(color,1.28)), leather=std(0x59412a), cloth=std(scout?0x875036:0x716038), iron=std(0x8b7460,{metalness:0.45,roughness:0.75});
  const legL=enemyLeg(g,skin,leather,-0.065,0.20,0.065), legR=enemyLeg(g,skin,leather,0.065,0.20,0.065);
  const body=enemyPiece(g,CYL(scout?0.095:0.13,0.10,0.24,6),skin,0,0.31,-0.025,0.22);
  enemyPiece(g,CYL(0.13,0.15,0.17,6),cloth,0,0.25,0);
  enemyPiece(g,BOX(0.25,0.035,0.20),leather,0,0.24,0);
  for(const side of [-1,1]) {
    enemyPiece(g,BOX(0.06,0.07,0.06),leather,side*0.12,0.21,0.08);
    enemyPiece(g,BOX(0.045,0.018,0.065),iron,side*0.12,0.23,0.085);
    enemyPiece(g,CONE(0.045,0.09,3),cloth,side*0.055,0.14,0.06,0,0,Math.PI);
  }
  enemyPiece(g,BOX(0.035,0.19,0.025),leather,0.035,0.34,0.11,0,0,0.4);
  const head=enemyPiece(g,SPH(0.12,8,6),light,0,0.50,0.075); head.scale.set(1,0.88,1);
  enemyPiece(head,BOX(0.12,0.05,0.10),skin,0,-0.055,0.07);
  enemyPiece(head,CONE(0.035,0.10,4),light,0,0,0.13,Math.PI/2);
  for(const side of [-1,1]) {
    enemyPiece(head,CONE(0.048,0.19,4),light,side*0.145,0.025,-0.025,0,0,-side*1.15);
    enemyPiece(head,BOX(0.065,0.02,0.035),skin,side*0.05,0.045,0.09,0,0,-side*0.2);
    enemyPiece(head,CONE(0.014,0.05,4),std(PAL.bone),side*0.045,-0.025,0.12);
  }
  enemyEyes(head,std(0xffe4a0,{emissive:0xffc94a,emissiveIntensity:0.8}),0.048,0.02,0.108);
  const cap=enemyPiece(head,SPH(0.125,8,5),leather,0,0.06,-0.025); cap.scale.y=0.5;
  enemyPiece(head,BOX(0.17,0.025,0.10),cloth,0,0.035,0.07);
  if(scout) for(let i=0;i<3;i++) enemyFeather(head,std(0xc94f3a),0,0.13+i*0.018,-0.06+i*0.045,0.13,-0.15);
  const armR=enemyArm(g,skin,leather,scout?0.14:0.17,0.39,0.20,0.06);
  const armL=enemyArm(g,skin,leather,scout?-0.14:-0.17,0.39,0.20,0.06,false);
  enemyBlade(armR,iron,leather,-0.19,true);
  if(scout) enemyBlade(armL,iron,leather,-0.19,true);
  g.userData={legL,legR,armR,armL,head,body}; return g;
}

function buildSlime(color, tiny) {
  const g=new THREE.Group(), gel=std(color,{roughness:0.22,metalness:0.05,transparent:true,opacity:0.65}), inner=std(shade(color,0.7),{roughness:0.45});
  const blob=enemyPiece(g,ICO(0.32,1),gel,0,0.28,0); blob.scale.set(1.06,0.86,1.06);
  const core=enemyPiece(g,ICO(0.14,0),inner,0,0.22,0); core.castShadow=false;
  const eyes=[];
  for(const side of [-1,1]) {
    const eye=enemyPiece(g,SPH(0.052,8,6),std(0xf7f3e0),side*0.10,0.33,0.24);
    const pupil=enemyPiece(g,SPH(0.025,6,4),std(0x1a2410),side*0.10,0.33,0.284);
    eye.castShadow=pupil.castShadow=false; eyes.push(eye,pupil);
  }
  for(let i=0;i<10;i++) {
    const a=i*Math.PI*2/10, r=tiny?0.25:0.29;
    const drop=enemyPiece(g,SPH(0.065,6,4),gel,Math.cos(a)*r,0.035,Math.sin(a)*r); drop.scale.y=0.53;
    const bubble=enemyPiece(g,SPH(i%2?0.025:0.04,6,4),std(shade(color,1.3),{transparent:true,opacity:0.8,roughness:0.18}),Math.cos(a)*0.17,0.17+(i%3)*0.08,Math.sin(a)*0.17); bubble.castShadow=false;
  }
  for(let i=0;i<5;i++) enemyPiece(blob,ICO(0.035,0),gel,Math.sin(i*2)*0.23,0.08+Math.cos(i)*0.13,Math.cos(i*2)*0.23);
  g.userData={blob,core,eyes,squash:true}; return g;
}

function buildSkeletonKnight(color) {
  const g=new THREE.Group(), bone=std(PAL.bone), steel=std(color,{metalness:0.55,roughness:0.65}), dark=std(shade(color,0.48)), gold=std(0x8c754b,{metalness:0.5});
  const legL=enemyLeg(g,bone,steel,-0.075,0.28,0.06), legR=enemyLeg(g,bone,steel,0.075,0.28,0.06);
  enemyPiece(g,BOX(0.21,0.05,0.13),bone,0,0.29,0);
  enemyPiece(g,BOX(0.045,0.27,0.05),bone,0,0.43,-0.045);
  for(let i=0;i<4;i++) for(const side of [-1,1]) enemyPiece(g,BOX(0.11,0.022,0.12),bone,side*0.065,0.34+i*0.042,0.015,0,side*0.2,side*0.12);
  enemyPiece(g,BOX(0.25,0.12,0.18),steel,0,0.53,0);
  enemyPiece(g,BOX(0.06,0.18,0.035),steel,-0.09,0.43,0.08,0,0,-0.12);
  enemyPiece(g,BOX(0.23,0.028,0.17),gold,0,0.31,0);
  const head=enemyPiece(g,SPH(0.105,8,6),bone,0,0.70,0.02);
  enemyPiece(head,BOX(0.12,0.05,0.10),bone,0,-0.085,0.025);
  for(const side of [-1,1]) enemyPiece(head,BOX(0.055,0.04,0.025),dark,side*0.042,0,0.09);
  enemyEyes(head,std(0xff5a3c,{emissive:0xff4a2c,emissiveIntensity:2}),0.042,0,0.108);
  enemyPiece(head,CONE(0.02,0.04,3),dark,0,-0.035,0.103,Math.PI);
  for(let i=0;i<4;i++) enemyPiece(head,BOX(0.016,0.022,0.025),bone,(i-1.5)*0.023,-0.058,0.08);
  enemyPiece(head,BOX(0.19,0.06,0.18),steel,0,0.075,-0.02);
  const armR=enemyArm(g,bone,steel,0.19,0.54,0.25,0.06), armL=enemyArm(g,bone,steel,-0.19,0.54,0.25,0.06);
  for(const [side,arm] of [[-1,armL],[1,armR]]) {
    enemyPiece(arm,ICO(0.105,0),steel,0,0,0);
    enemyPiece(arm,CONE(0.026,0.11,4),dark,side*0.04,0.08,0);
  }
  enemyBlade(armR,std(PAL.iron,{metalness:0.7}),dark,-0.20);
  for(let i=0;i<2;i++) enemyPiece(armR,BOX(0.035,0.08,0.018),steel,0.012+i*0.012,0.13+i*0.07,0.07,0,0,-0.18);
  const shield=enemyPiece(armL,CYL(0.15,0.15,0.035,10),dark,0,-0.13,0.09,Math.PI/2);
  enemyPiece(shield,CYL(0.13,0.13,0.045,10),steel);
  enemyPiece(shield,SPH(0.045,6,4),gold,0,0.04,0);
  const cape=enemyCape(g,std(0x3a3340,{side:THREE.DoubleSide}),0.30,0.46,0.56,-0.12);
  g.userData={legL,legR,armR,armL,head,cape}; return g;
}

function buildDragon(color) {
  const g=new THREE.Group(), scales=std(color,{roughness:0.65,metalness:0.15}), dark=std(shade(color,0.55)), bone=std(0xc5c1a1), belly=std(shade(color,1.3)), eyes=std(0xfff0b0,{emissive:0xffd45a,emissiveIntensity:2.2});
  const body=enemyPiece(g,ICO(0.30,1),scales,0,0.43,0); body.scale.set(1,0.85,1.5);
  for(let i=0;i<4;i++) enemyPiece(g,BOX(0.23-i*0.018,0.055,0.12),belly,0,0.27+i*0.025,0.25-i*0.13);
  const legs=[];
  for(const z of [0.20,-0.24]) for(const side of [-1,1]) {
    const leg=enemyJoint(g,scales,side*0.19,0.35,z,0.04);
    enemyPiece(leg,CYL(0.065,0.04,0.16,6),scales,0,-0.07,0,-0.25);
    enemyPiece(leg,CYL(0.04,0.03,0.13,5),dark,0,-0.20,0.025,0.3);
    enemyPiece(leg,BOX(0.10,0.055,0.15),scales,0,-0.3225,0.055);
    for(const sx of [-1,1]) enemyPiece(leg,CONE(0.017,0.075,4),bone,sx*0.03,-0.32,0.15,Math.PI/2);
    legs.push(leg);
  }
  const neck=enemyJoint(g,scales,0,0.55,0.25,0.04,true);
  enemyPiece(neck,CYL(0.09,0.14,0.30,6),scales,0,0.13,0.08,-0.55);
  enemyPiece(neck,BOX(0.13,0.19,0.045),belly,0,0.14,0.18,-0.55);
  enemyPiece(neck,ICO(0.14,0),scales,0,0.30,0.24);
  enemyPiece(neck,BOX(0.16,0.09,0.23),scales,0,0.27,0.37);
  enemyPiece(neck,BOX(0.14,0.035,0.22),dark,0,0.21,0.38);
  for(const side of [-1,1]) {
    enemyPiece(neck,CONE(0.035,0.23,4),bone,side*0.09,0.43,0.17,-0.55,0,side*0.3);
    enemyPiece(neck,BOX(0.07,0.025,0.06),dark,side*0.075,0.34,0.34,0,0,side*0.2);
    enemyPiece(neck,SPH(0.025,6,4),eyes,side*0.078,0.315,0.36);
    enemyPiece(neck,CONE(0.015,0.045,4),bone,side*0.055,0.235,0.44,0,0,Math.PI);
    enemyPiece(neck,CONE(0.035,0.15,4),scales,side*0.13,0.29,0.20,0,0,-side*1.1);
  }
  const wings=[];
  for(const side of [-1,1]) {
    const wing=enemyJoint(g,scales,side*0.22,0.56,-0.025,0.04,true);
    // Triangular panels meet at the wrist; finger bones define a scalloped fan.
    const points=[[0.12,0.10],[0.47,0.35],[0.86,0.14],[0.71,-0.18],[0.42,-0.30]];
    const membrane=std(shade(color,0.75),{side:THREE.DoubleSide,transparent:true,opacity:0.88,roughness:0.8});
    for(let i=1;i<4;i++) {
      const key='enemy-dragon-panel:'+side+':'+i;
      const geometry=geo(key,()=>{ const a=points[0],b=points[i],c=points[i+1]; const geom=new THREE.BufferGeometry(); geom.setAttribute('position',new THREE.Float32BufferAttribute([side*a[0],a[1],0,side*b[0],b[1],-0.04,side*c[0],c[1],-0.04],3)); geom.computeVertexNormals(); return geom; });
      enemyPiece(wing,geometry,membrane);
    }
    for(let i=1;i<5;i++) {
      const dx=side*(points[i][0]-points[0][0]),dy=points[i][1]-points[0][1];
      enemyPiece(wing,CYL(0.012,0.021,Math.hypot(dx,dy),5),bone,side*(points[i][0]+points[0][0])/2,(points[i][1]+points[0][1])/2,0,0,0,-Math.atan2(dx,dy));
    }
    enemyPiece(wing,CONE(0.025,0.10,4),bone,side*0.48,0.40,0);
    wings.push({group:wing,side});
  }
  const tail=enemyJoint(g,scales,0,0.40,-0.35,0.035,true), tailSegs=[];
  for(let i=0;i<4;i++) {
    const seg=enemyPiece(tail,CYL(0.10-i*0.018,0.08-i*0.017,0.20,6),scales,0,-i*0.025,-0.08-i*0.17,Math.PI/2); tailSegs.push(seg);
    if(i%2===0) enemyPiece(tail,CONE(0.035-i*0.004,0.10,4),bone,0,0.07-i*0.025,-0.08-i*0.17);
  }
  enemyPiece(tail,CONE(0.055,0.18,4),dark,0,-0.08,-0.77,-Math.PI/2);
  for(let i=0;i<5;i++) enemyPiece(g,CONE(0.045,0.16,4),bone,0,0.70-i*0.018,0.20-i*0.13);
  const aura=new THREE.Mesh(new THREE.CircleGeometry(0.85,28),glow(0x6fd0ff,0.22).clone()); aura.rotation.x=-Math.PI/2; aura.position.y=0.02; g.add(aura);
  g.userData={wings,neck,tail,tailSegs,legs,aura,flying:true}; return g;
}

/**
 * Harpia: voador leve. Reaproveita a lógica de asas do dragão em escala menor,
 * com silhueta bem diferente — corpo esguio e asas longas — para não se
 * confundir com o chefe na distância da câmera.
 */
function buildHarpy(color) {
  const g=new THREE.Group(), body=std(color), feather=std(shade(color,0.65)), light=std(shade(color,1.3)), gold=std(PAL.gold);
  const torso=enemyPiece(g,ICO(0.18,0),body,0,0.31,0); torso.scale.set(0.7,1.3,0.75);
  enemyPiece(g,CYL(0.08,0.12,0.12,6),feather,0,0.19,0);
  const head=enemyPiece(g,SPH(0.10,8,6),light,0,0.56,0.04);
  enemyPiece(head,CONE(0.032,0.09,4),gold,0,-0.025,0.11,Math.PI/2);
  enemyEyes(head,std(0xffe9a8,{emissive:0xffc94a,emissiveIntensity:1.2}),0.043,0.018,0.09);
  for(let i=0;i<5;i++) enemyFeather(head,i%2?body:feather,(i-2)*0.035,0.09+0.025*(2-Math.abs(i-2)),-0.035,0.14,(i-2)*-0.25);
  for(const side of [-1,1]) {
    enemyPiece(g,CYL(0.035,0.02,0.16,5),gold,side*0.075,0.10,0.035,0.25);
    for(let i=0;i<3;i++) enemyPiece(g,CONE(0.013,0.08,4),std(PAL.ironDark),side*0.075+(i-1)*0.025,0.025,0.08,Math.PI/2+0.4);
  }
  const wings=[];
  for(const side of [-1,1]) {
    const wing=enemyJoint(g,body,side*0.12,0.40,0,0.03,true);
    enemyPiece(wing,CYL(0.045,0.025,0.25,5),body,side*0.12,0.02,0,0,0,side*-Math.PI/2);
    for(let i=0;i<7;i++) enemyFeather(wing,i%2?feather:body,side*(0.12+i*0.075),-0.04-i*0.023,-0.025,0.23+i*0.018,side*-0.5);
    for(let i=0;i<3;i++) enemyFeather(wing,light,side*(0.12+i*0.10),0.02,-0.005,0.13,side*-0.8);
    wings.push({group:wing,side});
  }
  const tail=enemyJoint(g,feather,0,0.23,-0.12,0.025,true);
  for(let i=0;i<5;i++) { const f=enemyFeather(tail,i%2?feather:body,(i-2)*0.035,-0.075,-0.10,0.24,(i-2)*0.2); f.rotation.x=-0.7; }
  g.userData={wings,tail,head,flying:true,legs:[],fastFlap:true,hoverBase:0}; return g;
}

/**
 * Orc: o goblin daqui já tem presas e elmo, então o Orc não pode se distinguir
 * por adereço — se distingue por massa e postura. Tronco curvado para a frente,
 * ombros largos, braços que quase raspam o chão.
 */
function buildOrc(color) {
  const g=new THREE.Group(), skin=std(color), light=std(shade(color,1.22)), leather=std(0x5a4526), iron=std(PAL.ironDark,{metalness:0.4}), bone=std(PAL.bone), fur=std(0x78694c);
  const legL=enemyLeg(g,skin,leather,-0.11,0.24,0.12), legR=enemyLeg(g,skin,leather,0.11,0.24,0.12);
  const torso=enemyJoint(g,skin,0,0.26,0,0.03,true); torso.rotation.x=0.18;
  const chest=enemyPiece(torso,ICO(0.27,0),skin,0,0.16,0); chest.scale.set(1,0.95,0.65);
  enemyPiece(torso,CYL(0.18,0.20,0.15,6),leather,0,0.015,0);
  enemyPiece(torso,BOX(0.39,0.04,0.27),iron,0,0.04,0);
  enemyPiece(torso,BOX(0.04,0.27,0.035),leather,0.03,0.20,0.16,0,0,0.5);
  for(let i=0;i<5;i++) enemyPiece(torso,CONE(0.045,0.13,4),fur,(i-2)*0.065,-0.045,0.1,0,0,Math.PI);
  const head=enemyPiece(g,SPH(0.13,8,6),light,0,0.59,0.09); head.scale.y=0.9;
  enemyPiece(head,BOX(0.16,0.075,0.12),skin,0,-0.06,0.07);
  enemyPiece(head,BOX(0.07,0.05,0.065),light,0,-0.01,0.12);
  enemyEyes(head,std(0xffd07a,{emissive:0xff9a3d,emissiveIntensity:1.1}),0.052,0.032,0.112);
  for(const side of [-1,1]) {
    enemyPiece(head,CONE(0.027,0.12,4),bone,side*0.065,-0.018,0.13,-0.25);
    enemyPiece(head,CONE(0.04,0.10,4),skin,side*0.14,0,-0.015,0,0,-side*1.1);
    enemyPiece(head,BOX(0.075,0.024,0.04),skin,side*0.05,0.065,0.10,0,0,-side*0.2);
  }
  enemyPiece(head,SPH(0.06,6,4),std(0x252521),0,0.12,-0.025);
  enemyPiece(head,CYL(0.018,0.035,0.13,5),std(0x252521),0,0.19,-0.04);
  const armR=enemyArm(g,skin,leather,0.26,0.49,0.30,0.10), armL=enemyArm(g,skin,leather,-0.26,0.49,0.30,0.10,false);
  for(const [side,arm] of [[-1,armL],[1,armR]]) {
    enemyPiece(arm,ICO(0.13,0),iron,0,0.025,0);
    for(let i=0;i<2;i++) enemyPiece(arm,CONE(0.027,0.12,4),bone,side*(0.025+i*0.065),0.13,0,0,0,-side*0.3);
  }
  enemyPiece(armR,CYL(0.025,0.03,0.31,6),leather,0,-0.20,0.10);
  enemyPiece(armR,BOX(0.07,0.24,0.17),iron,0.045,-0.08,0.11,0,0,-0.12);
  enemyPiece(armR,BOX(0.025,0.23,0.18),std(PAL.iron),0.09,-0.08,0.11,0,0,-0.12);
  g.userData={legL,legR,armR,armL,head,body:torso}; return g;
}

/**
 * Lobo: único quadrúpede do elenco. A silhueta horizontal é o que o separa de
 * tudo o mais visto de cima — nenhuma outra criatura é mais comprida que alta.
 */
function buildWolf(color) {
  const g=new THREE.Group(), fur=std(color), dark=std(shade(color,0.65)), pale=std(shade(color,1.3)), claw=std(PAL.bone);
  const body=enemyPiece(g,ICO(0.23,1),fur,0,0.29,-0.055); body.scale.set(0.62,0.72,1.55);
  const chest=enemyPiece(g,ICO(0.18,0),dark,0,0.32,0.13); chest.scale.set(0.85,1.15,0.85);
  for(let i=0;i<5;i++) enemyPiece(g,CONE(0.045,0.14,4),dark,(i-2)*0.04,0.35,0.09-Math.abs(i-2)*0.025,0.65,0,(i-2)*0.4);
  const head=enemyJoint(g,fur,0,0.37,0.26,0.03,true);
  const skull=enemyPiece(head,ICO(0.105,0),fur); skull.scale.set(0.8,0.85,1.1);
  enemyPiece(head,CYL(0.046,0.067,0.17,5),fur,0,-0.035,0.13,Math.PI/2);
  enemyPiece(head,BOX(0.07,0.025,0.16),pale,0,-0.067,0.12);
  enemyPiece(head,ICO(0.033,0),std(0x222824),0,-0.025,0.22);
  for(const side of [-1,1]) {
    enemyPiece(head,CONE(0.044,0.13,3),dark,side*0.067,0.10,-0.025,0,0,-side*0.15);
    enemyPiece(head,CONE(0.025,0.07,3),pale,side*0.067,0.11,-0.003);
    enemyPiece(head,CONE(0.013,0.036,4),claw,side*0.037,-0.06,0.13,0,0,Math.PI);
  }
  enemyEyes(head,std(0xffe08a,{emissive:0xffb43d,emissiveIntensity:1.4}),0.061,0.026,0.07,0.02);
  const legs=[];
  // Explicit left/right front pair, then left/right hind pair.
  for(const z of [0.17,-0.24]) for(const side of [-1,1]) {
    const leg=enemyJoint(g,fur,side*0.10,0.28,z,0.037);
    enemyPiece(leg,CYL(0.04,0.026,0.13,5),fur,0,-0.06,z<0?-0.025:0,z<0?0.35:-0.15);
    enemyPiece(leg,SPH(0.035,6,4),dark,0,-0.12,0.015);
    enemyPiece(leg,CYL(0.024,0.022,0.12,5),dark,0,-0.19,0.005,-0.2);
    enemyPiece(leg,BOX(0.065,0.035,0.09),fur,0,-0.2625,0.025);
    legs.push(leg);
  }
  const tail=enemyJoint(g,fur,0,0.33,-0.34,0.045);
  for(let i=0;i<3;i++) {
    const t=enemyPiece(tail,ICO(0.075-i*0.015,0),i===2?pale:fur,0,-i*0.04,-0.075-i*0.10); t.scale.set(0.85,0.85,1.45);
  }
  g.userData={legL:legs[0],legR:legs[1],legL2:legs[2],legR2:legs[3],head,body,tail}; return g;
}

/** Troll: alto e curvado, braços até o chão. Brilha enquanto se regenera. */
function buildTroll(color) {
  const g=new THREE.Group(), hide=std(color), dark=std(shade(color,0.72)), moss=std(0x506d39), wood=std(PAL.woodDark), bone=std(PAL.bone);
  const legL=enemyLeg(g,hide,dark,-0.095,0.34,0.09), legR=enemyLeg(g,hide,dark,0.095,0.34,0.09);
  const torso=enemyJoint(g,hide,0,0.34,0,0.03,true); torso.rotation.x=0.28;
  const back=enemyPiece(torso,ICO(0.24,0),hide,0,0.19,-0.045); back.scale.set(0.78,1.15,0.72);
  enemyPiece(torso,CYL(0.11,0.15,0.16,6),dark,0,0.03,0);
  for(let i=0;i<5;i++) {
    enemyPiece(torso,ICO(0.045,0),moss,Math.sin(i*2)*0.13,0.26+(i%2)*0.10,-0.17);
    if(i<3) { enemyPiece(torso,CYL(0.012,0.015,0.055,5),bone,(i-1)*0.09,0.33,-0.18); enemyPiece(torso,CONE(0.045,0.025,6),std(0xa18c63),(i-1)*0.09,0.36,-0.18); }
  }
  const head=enemyPiece(g,SPH(0.105,8,6),hide,0,0.73,0.17); head.scale.y=1.12;
  enemyPiece(head,CONE(0.037,0.16,4),dark,0,-0.03,0.135,Math.PI/2+0.3);
  enemyPiece(head,BOX(0.105,0.06,0.07),dark,0,-0.07,0.06);
  enemyEyes(head,std(0xd8ffb0,{emissive:0x9ade4a,emissiveIntensity:1.2}),0.042,0.032,0.092);
  for(const side of [-1,1]) { enemyPiece(head,CONE(0.035,0.13,4),hide,side*0.12,0,-0.02,0,0,-side*1.3); enemyPiece(head,CONE(0.015,0.075,4),bone,side*0.04,-0.035,0.10); }
  const armR=enemyArm(g,hide,dark,0.21,0.64,0.47,0.085), armL=enemyArm(g,hide,dark,-0.21,0.64,0.47,0.085);
  for(const arm of [armL,armR]) for(let i=0;i<3;i++) enemyPiece(arm,BOX(0.022,0.075,0.03),dark,(i-1)*0.032,-0.45,0.065);
  enemyPiece(armR,CYL(0.028,0.045,0.36,6),wood,0,-0.32,0.13);
  enemyPiece(armR,ICO(0.095,0),wood,0,-0.13,0.13);
  const glowShell=new THREE.Mesh(ICO(0.42,0),glow(0x8ade5a,0.3)); glowShell.position.y=0.38; glowShell.visible=false; glowShell.castShadow=false; g.add(glowShell);
  g.userData={legL,legR,armR,armL,head,body:torso,healGlow:glowShell}; return g;
}

/** Golem: blocos empilhados, sem pescoço. Massa angular e fendas acesas. */
function buildGolem(color) {
  const g=new THREE.Group(), rock=std(color,{roughness:1}), dark=std(shade(color,0.72)), moss=std(0x61733e), magic=std(0xff9a3d,{emissive:0xff7a1d,emissiveIntensity:1.6});
  const legL=enemyLeg(g,rock,dark,-0.13,0.25,0.15), legR=enemyLeg(g,rock,dark,0.13,0.25,0.15);
  const torso=enemyJoint(g,rock,0,0.25,0,0.03,true);
  for(let i=0;i<3;i++) enemyPiece(torso,BOX(0.44-i*0.045,0.16,0.29-i*0.02),i===2?dark:rock,(i%2)*0.025,0.08+i*0.16,0,0,i%2?-0.16:0.12);
  enemyPiece(torso,BOX(0.15,0.17,0.03),dark,0,0.24,0.16);
  enemyPiece(torso,OCT(0.075),magic,0,0.24,0.18);
  for(const side of [-1,1]) enemyPiece(torso,BOX(0.018,0.14,0.015),magic,side*0.06,0.24,0.184,0,0,side*0.4);
  const head=enemyPiece(g,BOX(0.20,0.17,0.20),rock,0,0.79,0.025,0,0.08);
  enemyPiece(head,BOX(0.22,0.045,0.21),dark,0,0.07,0);
  enemyPiece(head,BOX(0.14,0.035,0.035),dark,0,-0.05,0.1);
  enemyEyes(head,magic,0.052,0.012,0.11,0.028);
  const armR=enemyJoint(g,rock,0.29,0.61,0,0.04,true), armL=enemyJoint(g,rock,-0.29,0.61,0,0.04,true);
  for(const [side,arm] of [[-1,armL],[1,armR]]) {
    enemyPiece(arm,ICO(0.13,0),rock,0,0,0);
    enemyPiece(arm,BOX(0.13,0.15,0.15),rock,0,-0.13,0,0,side*0.2);
    enemyPiece(arm,BOX(0.19,0.17,0.20),dark,0,-0.29,0.025,0,-side*0.15);
    for(let i=0;i<3;i++) enemyPiece(arm,BOX(0.042,0.065,0.035),rock,(i-1)*0.05,-0.31,0.13);
    enemyPiece(arm,OCT(0.055),moss,side*0.07,0.10,0);
  }
  for(let i=0;i<6;i++) enemyPiece(torso,ICO(0.04,0),moss,Math.sin(i*2)*0.16,0.13+(i%3)*0.14,-0.14);
  g.userData={legL,legR,armR,armL,head,body:torso}; return g;
}

/** Xamã: manto cônico e cajado aceso, com o anel da maldição no chão. */
function buildShaman(color) {
  const g=new THREE.Group(), robe=std(color), dark=std(shade(color,0.65)), bone=std(PAL.bone), wood=std(PAL.woodDark), magic=std(0xc79aff,{emissive:0xa050ff,emissiveIntensity:1.7});
  enemyPiece(g,CYL(0.105,0.22,0.42,8),robe,0,0.21,0);
  for(const side of [-1,1]) {
    enemyPiece(g,BOX(0.075,0.34,0.025),dark,side*0.08,0.21,0.16,0,0,side*0.12);
    enemyPiece(g,ICO(0.095,0),dark,side*0.12,0.44,0);
    for(let i=0;i<3;i++) enemyPiece(g,SPH(0.023,6,4),bone,side*(0.04+i*0.027),0.40+i*0.019,0.13);
    enemyPiece(g,CYL(0.012,0.015,0.10,5),bone,side*0.13,0.30,0.15,0,0,side*0.3);
  }
  const head=enemyPiece(g,SPH(0.10,8,6),std(0x759352),0,0.57,0.025);
  enemyPiece(head,BOX(0.13,0.15,0.045),bone,0,0,0.085);
  enemyPiece(head,CONE(0.034,0.08,4),wood,0,-0.025,0.13,Math.PI/2);
  enemyEyes(head,magic,0.035,0.025,0.12);
  for(const side of [-1,1]) {
    enemyPiece(head,CONE(0.03,0.17,4),bone,side*0.09,0.10,-0.01,0,0,-side*0.6);
    for(let i=0;i<3;i++) enemyFeather(head,i%2?robe:dark,side*(0.11+i*0.035),0.025+i*0.04,-0.05,0.13,side*-0.7);
  }
  const armR=enemyArm(g,robe,wood,0.18,0.44,0.18,0.055), armL=enemyArm(g,robe,dark,-0.18,0.44,0.18,0.055,false);
  enemyPiece(armR,CYL(0.02,0.025,0.5,6),wood,0,-0.12,0.02);
  for(const y of [-0.24,0.04,0.10]) enemyPiece(armR,CYL(0.032,0.032,0.026,6),bone,0,y,0.02);
  enemyPiece(armR,BOX(0.11,0.065,0.055),wood,0,0.09,0.02);
  const orb=enemyPiece(armR,OCT(0.07),magic,0,0.16,0.02); orb.castShadow=false;
  const halo=new THREE.Mesh(new THREE.PlaneGeometry(0.3,0.3),glow(0xb060ff,0.5)); halo.position.copy(orb.position); armR.add(halo);
  const auraRing=new THREE.Mesh(new THREE.RingGeometry(0.88,1.0,32),glow(0xb060ff,0.28)); auraRing.rotation.x=-Math.PI/2; auraRing.position.y=0.01; auraRing.castShadow=false; g.add(auraRing);
  g.userData={armR,armL,head,orb,halo,auraRing,glide:true}; return g;
}

/** Assassino: esguio, encapuzado, duas adagas. Some e reaparece em ciclo. */
function buildAssassin(color) {
  const g=new THREE.Group(), cloth=std(color), dark=std(shade(color,0.55)), leather=std(0x302b29), steel=std(PAL.iron,{metalness:0.7});
  const legL=enemyLeg(g,dark,leather,-0.055,0.25,0.055), legR=enemyLeg(g,dark,leather,0.055,0.25,0.055);
  const body=enemyPiece(g,CYL(0.105,0.075,0.24,6),cloth,0,0.36,0);
  for(const side of [-1,1]) {
    enemyPiece(g,BOX(0.025,0.24,0.024),leather,side*0.03,0.36,0.095,0,0,side*0.38);
    enemyPiece(g,BOX(0.06,0.075,0.045),leather,side*0.095,0.25,0.03);
    enemyPiece(g,BOX(0.075,0.028,0.10),steel,side*0.055,0.14,0);
  }
  enemyPiece(g,BOX(0.20,0.035,0.16),leather,0,0.27,0);
  enemyPiece(g,BOX(0.04,0.04,0.02),steel,0,0.27,0.09);
  const head=enemyPiece(g,SPH(0.09,8,6),dark,0,0.55,0.015);
  enemyPiece(head,BOX(0.15,0.035,0.16),cloth,0,0.075,-0.025);
  enemyPiece(head,BOX(0.14,0.15,0.04),cloth,0,0,-0.085);
  for(const side of [-1,1]) enemyPiece(head,BOX(0.04,0.14,0.12),cloth,side*0.077,0,-0.02,0,0,side*0.1);
  enemyPiece(head,BOX(0.13,0.065,0.035),leather,0,-0.035,0.077);
  enemyEyes(head,std(0xff6a4a,{emissive:0xff3a1a,emissiveIntensity:2}),0.035,0.018,0.093,0.018);
  enemyPiece(g,CYL(0.10,0.10,0.055,6),dark,0,0.47,0);
  const cape=enemyCape(g,dark,0.16,0.25,0.46,-0.095);
  enemyPiece(cape,BOX(0.055,0.23,0.025),cloth,0.11,-0.08,-0.06,-0.6,0,-0.5);
  const armR=enemyArm(g,cloth,leather,0.13,0.43,0.21,0.05), armL=enemyArm(g,cloth,leather,-0.13,0.43,0.21,0.05);
  enemyBlade(armR,steel,leather,-0.19,true); enemyBlade(armL,steel,leather,-0.19,true);
  g.userData={legL,legR,armR,armL,head,body,cape}; return g;
}

/**
 * Senhor da Guerra: o Orc com estandarte e mais metal. Reaproveita o corpo em
 * vez de recomeçar — o que o marca como chefe é o porte e a insígnia.
 */
function buildWarlord(color) {
  const g=buildOrc(color), {head,body,armR,armL}=g.userData, metal=std(shade(color,0.6),{metalness:0.6}), gold=std(PAL.gold,{metalness:0.65}), bone=std(PAL.bone);
  // Replace the cleaver with a boss-sized axe, keeping its shoulder pivot.
  armR.remove(...armR.children.slice(-3));
  enemyPiece(armR,CYL(0.027,0.033,0.52,6),std(PAL.woodDark),0,-0.16,0.13);
  for(const side of [-1,1]) { enemyPiece(armR,BOX(0.14,0.20,0.045),metal,side*0.075,0.04,0.13,0,0,-side*0.3); enemyPiece(armR,BOX(0.022,0.21,0.05),gold,side*0.14,0.04,0.13,0,0,-side*0.3); }
  enemyPiece(head,SPH(0.14,8,5),metal,0,0.055,-0.025).scale.y=0.65;
  enemyPiece(head,BOX(0.035,0.17,0.025),gold,0,0.06,0.12);
  for(const side of [-1,1]) {
    enemyPiece(head,CONE(0.045,0.23,4),bone,side*0.15,0.12,-0.025,0,0,-side*0.95);
    enemyPiece(body,BOX(0.16,0.22,0.035),metal,side*0.09,0.20,0.17,0,0,side*0.08);
    enemyPiece(body,BOX(0.018,0.22,0.04),gold,side*0.16,0.20,0.19);
  }
  for(const arm of [armL,armR]) { enemyPiece(arm,BOX(0.22,0.05,0.23),metal,0,0.08,0); enemyPiece(arm,BOX(0.23,0.02,0.24),gold,0,0.10,0); }
  enemyPiece(body,OCT(0.045),gold,0,0.19,0.20);
  enemyPiece(g,CYL(0.02,0.025,0.8,5),std(PAL.woodDark),-0.16,0.60,-0.16);
  const banner=enemyPiece(g,BOX(0.30,0.24,0.018),std(0xc03a2a,{side:THREE.DoubleSide}),-0.01,0.90,-0.16);
  enemyPiece(banner,BOX(0.27,0.02,0.025),gold,0,0.11,0);
  enemyPiece(banner,OCT(0.06),gold,0,0,0.018).scale.z=0.2;
  for(const side of [-1,1]) enemyPiece(banner,CONE(0.045,0.08,3),std(0xc03a2a),side*0.10,-0.14,0,0,0,Math.PI);
  const aura=new THREE.Mesh(new THREE.RingGeometry(0.9,1.0,28),glow(0xff8a3d,0.3).clone()); aura.rotation.x=-Math.PI/2; aura.position.y=0.015; aura.castShadow=false; g.add(aura);
  g.userData.banner=banner; g.userData.auraRing=aura; return g;
}

/** Rei da Morte: o cavaleiro esqueleto coroado, com almas ao redor. */
function buildDeathKing(color) {
  const g=buildSkeletonKnight(color), {head,armR,armL}=g.userData, robe=std(color), dark=std(shade(color,0.48)), gold=std(PAL.gold,{metalness:0.7}), magic=std(0xb89aff,{emissive:0x8a4aff,emissiveIntensity:1.5});
  // Remove knight weapons, retaining bone arms and their shoulder joints.
  armR.remove(...armR.children.slice(5)); armL.remove(...armL.children.slice(5));
  enemyPiece(g,CYL(0.11,0.22,0.42,8),dark,0,0.26,0);
  for(const side of [-1,1]) {
    enemyPiece(g,BOX(0.09,0.40,0.028),robe,side*0.085,0.29,0.15,0,0,side*0.09);
    enemyPiece(g,BOX(0.018,0.40,0.035),gold,side*0.045,0.29,0.17,0,0,side*0.09);
    enemyPiece(g,BOX(0.12,0.05,0.15),robe,side*0.09,0.60,0,0,0,side*0.35);
  }
  enemyPiece(head,CYL(0.115,0.12,0.05,8),gold,0,0.12,0);
  for(let i=0;i<6;i++) { const a=i*Math.PI/3; enemyPiece(head,CONE(0.023,0.13,4),gold,Math.cos(a)*0.10,0.20,Math.sin(a)*0.10); }
  enemyPiece(armR,CYL(0.018,0.024,0.66,6),dark,0,-0.10,0.12);
  enemyPiece(armR,CYL(0.03,0.03,0.03,6),gold,0,0.20,0.12);
  enemyPiece(armR,ICO(0.075,0),magic,0,0.28,0.12);
  for(const side of [-1,1]) enemyPiece(armR,CONE(0.02,0.12,4),gold,side*0.06,0.24,0.12,0,0,-side*0.4);
  const almas=[];
  for(let i=0;i<4;i++) {
    const alma=enemyPiece(g,OCT(0.05),magic,0,0.5,0); alma.castShadow=false; alma.userData.angle=i*Math.PI/2;
    enemyPiece(alma,CONE(0.025,0.08,4),magic,0,-0.055,0,0,0,Math.PI);
    almas.push(alma);
  }
  const aura=new THREE.Mesh(new THREE.RingGeometry(0.9,1.0,28),glow(0xa050ff,0.32).clone()); aura.rotation.x=-Math.PI/2; aura.position.y=0.015; aura.castShadow=false; g.add(aura);
  g.userData.souls=almas; g.userData.auraRing=aura; return g;
}

const ENEMY_BUILDERS = {
  grunt: function (c) { return buildGoblin(c, false); },
  raider: function (c) { return buildGoblin(c, true); },
  brute: function (c) { return buildSlime(c, false); },
  swarmling: function (c) { return buildSlime(c, true); },
  reaver: function (c) { return buildSkeletonKnight(c); },
  orc: function (c) { return buildOrc(c); },
  wolf: function (c) { return buildWolf(c); },
  troll: function (c) { return buildTroll(c); },
  golem: function (c) { return buildGolem(c); },
  shaman: function (c) { return buildShaman(c); },
  assassin: function (c) { return buildAssassin(c); },
  warlord: function (c) { return buildWarlord(c); },
  deathking: function (c) { return buildDeathKing(c); },
  harpy: function (c) { return buildHarpy(c); },
  boss: function (c) { return buildDragon(c); }
};

/**
 * Malha de inimigo, já escalada para o raio lógico usado pelo núcleo do jogo.
 * auraWorld, quando houver, é o alcance real da aura em células — o anel no
 * chão precisa dele para não mentir sobre até onde a maldição pega.
 */
export function buildEnemy(type, color, radiusWorld, auraWorld, character) {
  const build = ENEMY_BUILDERS[type] || ENEMY_BUILDERS.grunt;
  const inner = character ? characterInner(character, color, auraWorld) : build(color);

  // Casca de gelo (exibida enquanto o inimigo está lento)
  const frost = new THREE.Mesh(ICO(0.46, 0), glow(PAL.frost, 0.3).clone());
  frost.visible = false;
  frost.castShadow = false;
  inner.add(frost);
  inner.userData.frost = frost;

  // Enquanto oculto o corpo some, mas uma ondulação fica no chão: o jogador
  // continua sabendo que há algo ali, e só as torres é que ficam sem mira.
  const cloakMark = new THREE.Mesh(
    new THREE.RingGeometry(0.16, 0.26, 20), glow(0x9a7ac4, 0.5).clone());
  cloakMark.rotation.x = -Math.PI / 2;
  cloakMark.position.y = 0.02;
  cloakMark.visible = false;
  cloakMark.castShadow = false;

  const holder = new THREE.Group();
  // Sombra pintada no chão: ancora as figuras em movimento e separa silhuetas
  // pequenas da textura do terreno sem um círculo luminoso de seleção.
  const footprint = new THREE.Mesh(
    geo('enemy-footprint', function(){ return new THREE.CircleGeometry(0.27, 16); }),
    new THREE.MeshBasicMaterial({ color: 0x20302b, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide })
  );
  footprint.rotation.x = -Math.PI / 2;
  footprint.position.y = 0.012;
  footprint.castShadow = false;
  if(type !== 'harpy' && type !== 'boss') holder.add(footprint);
  holder.add(inner);
  holder.add(cloakMark);
  // Raio de referência das malhas acima ≈ 0.34 unidades de mundo.
  const holderScale = Math.max(0.74, radiusWorld / 0.22);
  holder.scale.setScalar(holderScale);

  // O anel vive dentro do holder, então precisa desfazer a escala dele para
  // desenhar o alcance verdadeiro no chão.
  if (inner.userData.auraRing && auraWorld > 0) {
    inner.userData.auraRing.scale.setScalar(auraWorld / holderScale);
  }
  holder.userData = { inner: inner, parts: inner.userData, type: type, cloakMark: cloakMark, character: character || null };
  return holder;
}

/**
 * Casca de um inimigo vestido por personagem animado (characters.js): as
 * partes procedurais somem — o esqueleto do modelo anima o corpo —, mas o anel
 * de aura continua sendo do jogo, porque mostra um alcance de regra.
 */
function characterInner(character, color, auraWorld) {
  const g = new THREE.Group();
  g.add(character.root);
  g.userData = {};
  if (auraWorld > 0) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.88, 1.0, 40), glow(color, 0.3));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.012;
    ring.castShadow = false;
    g.add(ring);
    g.userData.auraRing = ring;
  }
  return g;
}

// ---------------------------------------------------------------------------
// Mestre de Obras
// ---------------------------------------------------------------------------

// Peças do construtor: pivôs no quadril e na cintura deixam roupa e equipamento
// acompanharem a animação.
function builderBody(tier, cloth, trousers, boots) {
  const body = new THREE.Group();
  const legs = [-1, 1].map(side => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.065, 0.30, 0);
    leg.add(mesh(CYL(0.055, 0.045, 0.20, 6), trousers, 0, -0.09, 0));
    leg.add(mesh(BOX(0.09, 0.13, 0.10), boots, 0, -0.225, 0));
    leg.add(mesh(BOX(0.10, 0.065, 0.15), boots, 0, -0.2675, 0.025));
    body.add(leg);
    return leg;
  });
  const torso = new THREE.Group();
  torso.position.y = 0.30;
  torso.add(mesh(CYL(0.13, 0.105, 0.27, 6), cloth, 0, 0.135, 0));
  body.add(torso);
  const head = new THREE.Group();
  head.position.set(0, 0.64, 0);
  head.add(mesh(SPH(0.085, 8, 6), std(PAL.skin, { roughness: 0.84 })));
  head.add(mesh(BOX(0.035, 0.04, 0.03), std(PAL.skin), 0, -0.006, 0.081));
  torso.add(head);
  // A cabeça fica em coordenadas locais do tronco, que pivota na cintura.
  head.position.y -= torso.position.y;
  body.scale.setScalar(tier >= 3 ? 1.06 : 1);
  body.userData = { legL: legs[0], legR: legs[1], torso, head };
  return body;
}

function builderCape(torso, material, trim) {
  const cape = mesh(CYL(0.13, 0.21, 0.43, 6), material, 0, 0.05, -0.10);
  cape.scale.z = 0.38;
  cape.rotation.x = -0.16;
  torso.add(cape);
  for (const side of [-1, 1]) {
    const fold = mesh(BOX(0.065, 0.39, 0.035), material, side * 0.135, 0.05, -0.075);
    fold.rotation.z = side * 0.22;
    torso.add(fold);
    if (trim) {
      const edge = mesh(BOX(0.018, 0.39, 0.04), trim, side * 0.17, 0.05, -0.073);
      edge.rotation.z = side * 0.22;
      torso.add(edge);
    }
  }
}

function builderHood(head, cloth, hair) {
  head.add(mesh(BOX(0.20, 0.055, 0.18), cloth, 0, 0.082, -0.02));
  head.add(mesh(BOX(0.18, 0.19, 0.055), cloth, 0, -0.005, -0.08));
  for (const side of [-1, 1]) {
    const rim = mesh(BOX(0.045, 0.16, 0.14), cloth, side * 0.09, 0.005, -0.015);
    rim.rotation.z = side * 0.12;
    head.add(rim);
    if (hair) head.add(mesh(CYL(0.028, 0.035, 0.21, 5), hair, side * 0.068, -0.07, 0.025));
  }
}

function builderLeaf(parent, material, x, y, z, angle, size) {
  const leaf = mesh(OCT(size || 0.035), material, x, y, z);
  leaf.scale.set(0.5, 1.3, 0.20);
  leaf.rotation.z = angle;
  parent.add(leaf);
  return leaf;
}

/** Peão: forma inicial do Mestre de Obras, sem vocação. */
function buildPeao() {
  const cream = std(0xe5d4af, { roughness: 0.94 });
  const leather = std(0x765035, { roughness: 0.94 });
  const orange = std(0xe38325, { roughness: 0.9 });
  const skin = std(PAL.skin, { roughness: 0.84 });
  const metal = std(PAL.ironDark, { metalness: 0.6, roughness: 0.46 });
  const g = builderBody(2, cream, std(0x686346), std(0x513b2c));
  const { legL, legR, torso, head } = g.userData;
  for (const leg of [legL, legR]) {
    leg.add(mesh(CYL(0.065, 0.055, 0.12, 6), std(0x686346), 0, -0.06, 0));
    leg.add(mesh(BOX(0.095, 0.025, 0.11), leather, 0, -0.18, 0));
  }
  torso.add(mesh(BOX(0.19, 0.20, 0.028), leather, 0, 0.13, 0.12));
  for (const side of [-1, 1]) {
    const skirt = mesh(BOX(0.12, 0.16, 0.035), leather, side * 0.064, -0.025, 0.105);
    skirt.rotation.z = side * 0.12;
    torso.add(skirt);
    torso.add(mesh(BOX(0.025, 0.23, 0.03), leather, side * 0.074, 0.17, 0.10));
  }
  torso.add(mesh(BOX(0.27, 0.045, 0.205), orange, 0, 0.015, 0));
  torso.add(mesh(BOX(0.05, 0.04, 0.025), metal, 0, 0.015, 0.125));
  const sash = mesh(BOX(0.055, 0.18, 0.025), orange, 0.13, -0.07, 0.07);
  sash.rotation.z = 0.3;
  torso.add(sash);
  torso.add(mesh(BOX(0.085, 0.075, 0.06), leather, -0.11, -0.015, 0.13));
  for (let i = 0; i < 2; i++) {
    torso.add(mesh(BOX(0.012, 0.095, 0.018), std(PAL.wood), -0.13 + i * 0.035, 0.04, 0.16));
    torso.add(mesh(BOX(0.035, 0.025, 0.022), metal, -0.13 + i * 0.035, 0.086, 0.16));
  }
  const beard = mesh(CONE(0.076, 0.13, 6), std(0x533721), 0, -0.05, 0.055);
  beard.rotation.z = Math.PI;
  head.add(beard);
  head.add(mesh(BOX(0.095, 0.025, 0.035), std(0x533721), 0, -0.01, 0.085));
  head.add(mesh(CYL(0.087, 0.09, 0.055, 8), orange, 0, 0.05, 0));
  head.add(mesh(SPH(0.09, 8, 4), orange, 0, 0.07, -0.005));
  head.add(mesh(BOX(0.05, 0.11, 0.025), orange, -0.09, 0.01, -0.06));

  const armR = new THREE.Group();
  armR.position.set(0.17, 0.54, 0);
  armR.add(mesh(CYL(0.055, 0.048, 0.12, 6), cream, 0, -0.05, 0));
  armR.add(mesh(CYL(0.055, 0.055, 0.035, 6), cream, 0, -0.11, 0));
  armR.add(mesh(BOX(0.065, 0.12, 0.065), skin, 0, -0.17, 0.025));
  armR.add(mesh(SPH(0.043, 6, 4), skin, 0, -0.215, 0.06));
  armR.add(mesh(CYL(0.017, 0.019, 0.40, 6), std(PAL.wood), 0, -0.08, 0.085));
  armR.add(mesh(BOX(0.18, 0.10, 0.105), metal, 0, 0.13, 0.085));
  g.add(armR);
  // Braço esquerdo dobrado segura a viga apoiada no ombro.
  torso.add(mesh(CYL(0.055, 0.05, 0.12, 6), cream, -0.17, 0.19, 0));
  const forearm = mesh(BOX(0.065, 0.15, 0.065), skin, -0.19, 0.23, 0.08);
  forearm.rotation.x = -0.6;
  torso.add(forearm);
  torso.add(mesh(SPH(0.043, 6, 4), skin, -0.19, 0.31, 0.11));
  const beam = new THREE.Group();
  beam.position.set(-0.045, 0.31, -0.02);
  beam.rotation.z = -0.10;
  beam.add(mesh(BOX(0.48, 0.095, 0.12), std(PAL.wood)));
  for (const y of [-0.024, 0.024])
    beam.add(mesh(BOX(0.46, 0.008, 0.006), std(PAL.woodDark), 0, y, 0.063));
  torso.add(beam);
  g.userData = { legL, legR, armR, head };
  return g;
}

// ---------------------------------------------------------------------------
// Vocações do Mestre de Obras — inspiradas nas 4 vocações clássicas de Tibia
// (Knight/Paladin/Sorcerer/Druid) e sua promoção. Arquétipo só: nenhum asset
// ou nome do jogo original é reaproduzido, e o corpo é sempre o humanoid()
// com pernas, para poder andar como as outras formas do construtor.
// ---------------------------------------------------------------------------

/** Cavaleiro: escudo e espada, a versão marcial do peão. */
function buildKnight(tier, color) {
  const steel = std(0x9da8aa, { metalness: 0.75, roughness: 0.38 });
  const darkSteel = std(PAL.ironDark, { metalness: 0.65, roughness: 0.46 });
  const cloth = std(color, { roughness: 0.92 });
  const cream = std(0xeee0ba);
  const gold = std(PAL.gold, { metalness: 0.65, roughness: 0.35 });
  const body = builderBody(tier, steel, darkSteel, steel);
  const { torso, head, legL, legR } = body.userData;
  for (const leg of [legL, legR]) {
    leg.add(mesh(BOX(0.085, 0.12, 0.04), steel, 0, -0.07, 0.054));
    leg.add(mesh(SPH(0.052, 6, 4), steel, 0, -0.15, 0.045));
    if (tier >= 3) leg.add(mesh(BOX(0.065, 0.025, 0.045), gold, 0, -0.18, 0.055));
  }
  builderCape(torso, cloth, tier >= 3 ? gold : null);
  torso.add(mesh(BOX(0.16, 0.28, 0.035), cloth, 0, 0.09, 0.123));
  torso.add(mesh(BOX(0.025, 0.15, 0.012), cream, 0, 0.14, 0.147));
  torso.add(mesh(BOX(0.10, 0.028, 0.012), cream, 0, 0.175, 0.147));
  for (const side of [-1, 1]) {
    const tail = mesh(BOX(0.083, 0.13, 0.03), cloth, side * 0.047, -0.07, 0.10);
    tail.rotation.z = side * 0.10;
    torso.add(tail);
    const shoulder = mesh(SPH(0.085, 6, 4), steel, side * 0.15, 0.24, 0);
    shoulder.scale.set(1, 0.65, 1.15);
    torso.add(shoulder);
    if (tier >= 3) torso.add(mesh(BOX(0.12, 0.025, 0.17), gold, side * 0.15, 0.235, 0));
  }
  torso.add(mesh(BOX(0.245, 0.035, 0.20), std(PAL.woodDark), 0, 0.01, 0));
  torso.add(mesh(BOX(0.045, 0.035, 0.025), gold, 0, 0.01, 0.135));
  head.clear();
  head.add(mesh(CYL(0.09, 0.10, 0.18, 8), steel, 0, 0, 0));
  head.add(mesh(BOX(0.125, 0.013, 0.015), darkSteel, 0, 0.025, 0.095));
  head.add(mesh(BOX(0.014, 0.145, 0.018), tier >= 3 ? gold : steel, 0, 0, 0.104));
  for (const side of [-1, 1])
    head.add(mesh(BOX(0.028, 0.008, 0.014), darkSteel, side * 0.05, -0.04, 0.096));
  for (let i = 0; i < 3; i++) {
    const plume = mesh(CONE(0.046 - i * 0.007, 0.15, 5), cloth, 0, 0.145 - i * 0.018, -i * 0.052);
    plume.rotation.x = -0.35 - i * 0.32;
    head.add(plume);
  }
  const arms = new THREE.Group();
  arms.position.y = 0.24;
  for (const side of [-1, 1]) {
    arms.add(mesh(BOX(0.07, 0.16, 0.08), steel, side * 0.175, -0.08, 0.025));
    arms.add(mesh(BOX(0.075, 0.065, 0.085), darkSteel, side * 0.175, -0.16, 0.055));
  }
  const shield = new THREE.Group();
  shield.position.set(-0.165, -0.075, 0.13);
  shield.rotation.y = -0.18;
  const face = mesh(CYL(0.135, 0.135, 0.035, 4), gold);
  face.rotation.x = Math.PI / 2;
  face.scale.set(0.85, 1, 1.65);
  shield.add(face);
  const panel = mesh(CYL(0.122, 0.122, 0.04, 4), cloth, 0, 0, 0.016);
  panel.rotation.x = Math.PI / 2;
  panel.scale.set(0.85, 1, 1.65);
  shield.add(panel);
  shield.add(mesh(BOX(0.025, 0.29, 0.012), cream, 0, 0, 0.043));
  shield.add(mesh(BOX(0.16, 0.026, 0.012), cream, 0, 0.045, 0.043));
  shield.add(mesh(SPH(0.043, 8, 4), gold, 0, 0.025, 0.05));
  arms.add(shield);
  const sword = new THREE.Group();
  sword.position.set(0.17, -0.14, 0.08);
  sword.rotation.z = -0.06;
  sword.add(mesh(CYL(0.018, 0.018, 0.10, 6), std(PAL.woodDark), 0, 0.01, 0));
  sword.add(mesh(BOX(0.13, 0.025, 0.045), gold, 0, 0.065, 0));
  sword.add(mesh(BOX(0.043, 0.31, 0.017), steel, 0, 0.235, 0));
  sword.add(mesh(CONE(0.027, 0.08, 4), steel, 0, 0.43, 0));
  sword.add(mesh(SPH(0.026, 6, 4), gold, 0, -0.055, 0));
  arms.add(sword);
  torso.add(arms);
  return { body, arms };
}

/** Paladino: capuz e arco longo, o caçador à distância. */
function buildPaladin(tier, color) {
  const cloth = std(color, { roughness: 0.88 });
  const cream = std(0xeee0ba, { roughness: 0.9 });
  const gold = std(PAL.gold, { metalness: 0.65, roughness: 0.36 });
  const steel = std(0x9da8aa, { metalness: 0.7, roughness: 0.42 });
  const leather = std(PAL.woodDark);
  const body = builderBody(tier, cream, std(0x73634c), leather);
  const { torso, head, legL, legR } = body.userData;
  builderCape(torso, cloth, gold);
  builderHood(head, cloth, std(0x63442b));
  const beard = mesh(CONE(0.06, 0.08, 5), std(0x63442b), 0, -0.055, 0.055);
  beard.rotation.z = Math.PI;
  head.add(beard);
  torso.add(mesh(BOX(0.145, 0.34, 0.035), cream, 0, 0.045, 0.125));
  for (const side of [-1, 1]) {
    torso.add(mesh(BOX(0.015, 0.34, 0.04), gold, side * 0.08, 0.045, 0.125));
    const shoulder = mesh(SPH(0.079, 6, 4), steel, side * 0.15, 0.24, 0);
    shoulder.scale.y = 0.65;
    torso.add(shoulder);
    torso.add(mesh(BOX(0.09, 0.02, 0.14), gold, side * 0.15, 0.225, 0));
  }
  torso.add(mesh(BOX(0.025, 0.105, 0.012), gold, 0, -0.025, 0.15));
  torso.add(mesh(BOX(0.085, 0.022, 0.012), gold, 0, 0, 0.15));
  torso.add(mesh(BOX(0.24, 0.04, 0.195), leather, 0, 0.015, 0));
  for (const leg of [legL, legR]) {
    leg.add(mesh(BOX(0.08, 0.13, 0.04), steel, 0, -0.21, 0.06));
    if (tier >= 3) leg.add(mesh(BOX(0.085, 0.025, 0.045), gold, 0, -0.16, 0.06));
  }
  const quiver = new THREE.Group();
  quiver.position.set(-0.145, 0.005, -0.01);
  quiver.rotation.z = -0.18;
  quiver.add(mesh(CYL(0.043, 0.035, 0.18, 6), leather));
  quiver.add(mesh(CYL(0.045, 0.045, 0.024, 6), gold, 0, 0.08, 0));
  for (let i = 0; i < 3; i++) {
    quiver.add(mesh(CYL(0.006, 0.006, 0.14, 4), std(PAL.wood), (i - 1) * 0.022, 0.105, 0));
    quiver.add(mesh(BOX(0.025, 0.045, 0.008), cream, (i - 1) * 0.022, 0.17, 0));
  }
  torso.add(quiver);
  const arms = new THREE.Group();
  arms.position.set(0, 0.22, 0);
  for (const side of [-1, 1]) {
    const arm = mesh(BOX(0.065, 0.075, 0.19), cream, side * 0.145, -0.065, 0.065);
    arm.rotation.y = side * -0.35;
    arms.add(arm);
    arms.add(mesh(BOX(0.07, 0.07, 0.10), steel, side * 0.11, -0.065, 0.15));
    arms.add(mesh(SPH(0.035, 6, 4), std(PAL.skin), side * 0.075, -0.055, 0.19));
  }
  arms.add(mesh(BOX(0.065, 0.065, 0.30), leather, 0, -0.035, 0.19));
  arms.add(mesh(BOX(0.024, 0.018, 0.30), steel, 0, 0.007, 0.21));
  arms.add(mesh(BOX(0.095, 0.075, 0.035), gold, 0, -0.035, 0.16));
  for (const side of [-1, 1]) {
    const limb = mesh(BOX(0.16, 0.035, 0.04), steel, side * 0.11, -0.02, 0.29);
    limb.rotation.y = side * 0.3;
    arms.add(limb);
    arms.add(mesh(BOX(0.024, 0.055, 0.05), gold, side * 0.185, -0.02, 0.265));
    const string = mesh(BOX(0.19, 0.006, 0.006), cream, side * 0.092, -0.015, 0.225);
    string.rotation.y = side * 0.42;
    arms.add(string);
  }
  arms.add(mesh(BOX(0.035, 0.035, 0.07), gold, 0, -0.025, 0.33));
  if (tier >= 3) arms.add(mesh(OCT(0.024), gold, 0, 0.017, 0.16));
  torso.add(arms);
  return { body, arms };
}

/** Feiticeiro: manto e orbe arcano flutuante — magia ofensiva. */
function buildSorcerer(tier, color) {
  const purple = std(color, { roughness: 0.9 });
  const cream = std(0xdfd3bb, { roughness: 0.92 });
  const gold = std(PAL.gold, { metalness: 0.6, roughness: 0.4 });
  const hair = std(0xa5a1a0, { roughness: 0.94 });
  const magic = std(0xbc65f2, { emissive: 0x9f36e9, emissiveIntensity: 1.5, roughness: 0.3 });
  const body = builderBody(tier, purple, std(0x514551), std(PAL.woodDark));
  const { torso, head } = body.userData;
  builderCape(torso, purple, gold);
  torso.add(mesh(CYL(0.105, 0.17, 0.31, 6), cream, 0, -0.055, 0));
  for (const side of [-1, 1]) {
    const robe = mesh(BOX(0.095, 0.37, 0.035), purple, side * 0.09, 0.005, 0.13);
    robe.rotation.z = side * 0.14;
    torso.add(robe);
    const trim = mesh(BOX(0.018, 0.37, 0.04), gold, side * 0.05, 0.005, 0.145);
    trim.rotation.z = side * 0.14;
    torso.add(trim);
    const collar = mesh(BOX(0.11, 0.04, 0.16), purple, side * 0.065, 0.27, 0);
    collar.rotation.z = side * 0.40;
    torso.add(collar);
    head.add(mesh(CYL(0.043, 0.038, 0.21, 5), hair, side * 0.075, -0.055, -0.025));
  }
  const crown = mesh(SPH(0.09, 8, 6), hair, 0, 0.035, -0.025);
  crown.scale.set(1, 0.85, 0.85);
  head.add(crown);
  const beard = mesh(CONE(0.06, 0.17, 6), hair, 0, -0.09, 0.06);
  beard.rotation.z = Math.PI;
  head.add(beard);
  head.add(mesh(BOX(0.085, 0.02, 0.035), hair, 0, -0.02, 0.085));
  torso.add(mesh(BOX(0.24, 0.045, 0.205), std(PAL.woodDark), 0, 0.015, 0));
  torso.add(mesh(OCT(0.033), gold, 0, 0.02, 0.125));
  torso.add(mesh(BOX(0.095, 0.125, 0.06), std(0x51332e), 0.13, -0.05, 0.07));
  torso.add(mesh(BOX(0.078, 0.10, 0.063), cream, 0.13, -0.05, 0.072));
  torso.add(mesh(BOX(0.10, 0.018, 0.075), gold, 0.13, -0.015, 0.07));
  const arms = new THREE.Group();
  arms.position.y = 0.24;
  for (const side of [-1, 1]) {
    const sleeve = mesh(CYL(0.05, 0.075, 0.18, 6), purple, side * 0.16, -0.045, 0.05);
    sleeve.rotation.x = -0.65;
    arms.add(sleeve);
    arms.add(mesh(CYL(0.06, 0.065, 0.045, 6), cream, side * 0.17, -0.11, 0.11));
    arms.add(mesh(SPH(0.038, 6, 4), std(PAL.skin), side * 0.18, -0.095, 0.16));
  }
  const staff = new THREE.Group();
  staff.position.set(-0.19, -0.17, 0.13);
  staff.add(mesh(CYL(0.016, 0.022, 0.62, 6), std(PAL.woodDark)));
  for (const y of [-0.10, 0.23, 0.30]) staff.add(mesh(CYL(0.025, 0.025, 0.026, 6), gold, 0, y, 0));
  const crystal = mesh(OCT(0.065), magic, 0, 0.37, 0);
  crystal.scale.y = 1.35;
  staff.add(crystal);
  for (const side of [-1, 1]) {
    const claw = mesh(CONE(0.024, 0.12, 5), gold, side * 0.057, 0.33, 0);
    claw.rotation.z = side * -0.3;
    staff.add(claw);
  }
  arms.add(staff);
  torso.add(arms);
  // Orbe e halo ficam nas coordenadas do corpo: o animateWorker usa altura absoluta.
  const orbY = 0.57;
  const orb = mesh(ICO(0.073, 0), magic, 0.19, orbY, 0.17);
  orb.castShadow = false;
  body.add(orb);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: 0xb864f2, transparent: true, opacity: 0.45,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  }));
  halo.scale.setScalar(0.36);
  halo.position.copy(orb.position);
  body.add(halo);
  const shards = [];
  if (tier >= 3) {
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2;
      const sh = mesh(OCT(0.03), magic, Math.cos(angle) * 0.14, orbY, 0.05 + Math.sin(angle) * 0.14);
      sh.castShadow = false;
      sh.userData.angle = angle;
      body.add(sh);
      shards.push(sh);
    }
    torso.add(mesh(BOX(0.20, 0.02, 0.035), gold, 0, 0.205, 0.13));
  }
  return { body, arms, orb, halo, shards, orbY };
}

/** Naturalista: manto e cajado de cristal — magia da natureza que retarda. */
function buildNaturalist(tier, color) {
  const green = std(color, { roughness: 0.94 });
  const leafMat = std(shade(color, 0.7), { roughness: 0.92 });
  const cream = std(0xe6dbc0, { roughness: 0.94 });
  const hair = std(0x974c2b, { roughness: 0.94 });
  const wood = std(0x695337, { roughness: 0.96 });
  const gold = std(PAL.gold, { metalness: 0.55, roughness: 0.4 });
  const cyan = std(0x71eee1, { emissive: 0x35d9d0, emissiveIntensity: 1.3, roughness: 0.24 });
  const leafGlow = std(0x8bde9a, { emissive: 0x45bc9e, emissiveIntensity: 0.7, roughness: 0.65 });
  const body = builderBody(tier, cream, std(0x746b51), std(PAL.woodDark));
  const { torso, head } = body.userData;
  builderCape(torso, green, tier >= 3 ? gold : null);
  builderHood(head, green, hair);
  head.add(mesh(BOX(0.14, 0.20, 0.045), hair, 0, -0.07, -0.095));
  torso.add(mesh(CYL(0.10, 0.17, 0.29, 6), cream, 0, -0.045, 0));
  torso.add(mesh(BOX(0.13, 0.31, 0.03), cream, 0, -0.015, 0.13));
  for (let i = 0; i < 3; i++) {
    for (const side of [-1, 1]) {
      builderLeaf(torso, leafMat, side * 0.038, 0.055 - i * 0.067, 0.149, side * -0.55, 0.026);
      builderLeaf(head, leafMat, side * (0.04 + i * 0.027), 0.098 - i * 0.022, 0.055, side * -0.7, 0.03);
    }
  }
  for (const side of [-1, 1]) {
    builderLeaf(torso, green, side * 0.13, 0.22, 0.055, side * 0.9, 0.08);
    builderLeaf(torso, leafMat, side * 0.15, 0.14, -0.10, side * 0.5, 0.07);
  }
  torso.add(mesh(BOX(0.24, 0.04, 0.20), wood, 0, 0.015, 0));
  torso.add(mesh(OCT(0.036), tier >= 3 ? gold : leafMat, 0, 0.02, 0.125));
  torso.add(mesh(BOX(0.07, 0.09, 0.065), wood, 0.12, -0.035, 0.06));
  const arms = new THREE.Group();
  arms.position.y = 0.24;
  for (const side of [-1, 1]) {
    const sleeve = mesh(CYL(0.045, 0.065, 0.17, 6), cream, side * 0.16, -0.05, 0.045);
    sleeve.rotation.x = -0.7;
    arms.add(sleeve);
    arms.add(mesh(SPH(0.038, 6, 4), std(PAL.skin), side * 0.18, -0.09, 0.145));
  }
  const staff = new THREE.Group();
  staff.position.set(-0.19, -0.18, 0.12);
  for (let i = 0; i < 4; i++) {
    const segment = mesh(CYL(0.017, 0.024, 0.17, 5), wood, Math.sin(i * 1.8) * 0.019, -0.23 + i * 0.15, 0);
    segment.rotation.z = Math.cos(i * 1.8) * 0.19;
    staff.add(segment);
  }
  for (const side of [-1, 1]) {
    const fork = mesh(CYL(0.010, 0.022, 0.15, 5), wood, side * 0.04, 0.31, 0);
    fork.rotation.z = side * -0.45;
    staff.add(fork);
    builderLeaf(staff, green, side * 0.038, 0.20, 0.015, side * -0.7, 0.04);
  }
  const crystal = mesh(OCT(0.057), cyan, 0, 0.36, 0);
  crystal.scale.y = 1.5;
  staff.add(crystal);
  arms.add(staff);
  torso.add(arms);
  // Espiral de folhas luminosas em volta da mão livre erguida.
  const sats = [];
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 0.65;
    const leaf = builderLeaf(body, leafGlow, 0.18 + Math.cos(a) * 0.055,
      0.47 + i * 0.029, 0.16 + Math.sin(a) * 0.06, a, 0.028);
    leaf.castShadow = false;
    if (tier >= 3) {
      leaf.userData.baseY = leaf.position.y;
      sats.push(leaf);
    }
  }
  if (tier >= 3) {
    torso.add(mesh(BOX(0.15, 0.025, 0.03), gold, 0, 0.20, 0.13));
    head.add(mesh(OCT(0.024), gold, 0, 0.09, 0.079));
  }
  return { body, arms, sats };
}

const BUILDER_VOCATIONS = {
  cavaleiro: buildKnight,
  paladino: buildPaladin,
  feiticeiro: buildSorcerer,
  naturalista: buildNaturalist
};

/** Monta o Mestre de Obras: Peão (sem vocação) ou uma das 4 vocações, por tier. */
export function buildWorker(tier, branch, color) {
  const build = branch && BUILDER_VOCATIONS[branch];
  if (!build || tier < 2) return buildPeao();

  const parts = build(tier, color);
  const g = parts.body;
  g.userData.arms = parts.arms || null;
  g.userData.orb = parts.orb || null;
  g.userData.halo = parts.halo || null;
  g.userData.shards = parts.shards || null;
  g.userData.sats = parts.sats || null;
  g.userData.orbY = parts.orbY || 0;

  if (tier >= 3) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.24, 0.29, 24),
      new THREE.MeshBasicMaterial({
        color: PAL.goldLight, transparent: true, opacity: 0.8,
        depthWrite: false, side: THREE.DoubleSide, toneMapped: false
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    g.add(ring);
    g.userData.tierRing = ring;
  }

  g.userData.tier = tier;
  g.userData.vocation = branch;
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
  if (d.detailedModel) {
    anim.recoil = Math.max(0, anim.recoil - dt * 4.5);
    if (d.turret) {
      d.turret.position.copy(d.turretRest);
      if (d.type === 'trap') {
        d.turret.rotation.y = 0;
        d.turret.position.y -= anim.recoil * 0.012;
      } else {
        d.turret.rotation.y = anim.yaw;
        d.turret.position.x -= Math.sin(anim.yaw) * anim.recoil * 0.025;
        d.turret.position.z -= Math.cos(anim.yaw) * anim.recoil * 0.025;
      }
    }
    return;
  }
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
    // Só a Gélida gira livremente; Bobina Canhão e invocadores miram no alvo.
    if (d.type === 'frost' && d.turret) d.turret.rotation.y = t * 0.35;
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
  // Quadrúpede: as patas traseiras batem em contratempo com as dianteiras.
  if (p.legL2 && p.legR2) {
    p.legL2.rotation.x = -Math.sin(gait) * 0.62 * stride;
    p.legR2.rotation.x = Math.sin(gait) * 0.62 * stride;
    if (p.tail) p.tail.rotation.y = Math.sin(gait * 0.5) * 0.3 * stride;
  }
  if (p.armR) p.armR.rotation.x = -Math.sin(gait) * 0.42 * stride - 0.1;
  if (p.armL) p.armL.rotation.x = Math.sin(gait) * 0.42 * stride;
  if (p.head) p.head.rotation.z = Math.sin(gait * 0.5) * 0.06;

  // O Xamã plana em vez de andar: sobe e desce sem passada.
  if (p.glide) {
    inner.position.y = 0.06 + Math.sin(t * 2.2 + anim.phase) * 0.035;
    if (p.orb) {
      const pulse = 1 + Math.sin(t * 4 + anim.phase) * 0.15;
      p.orb.scale.setScalar(pulse);
      p.orb.rotation.set(t * 0.9, t * 1.4, 0);
      if (p.halo) p.halo.scale.setScalar(pulse * 1.1);
    }
    if (p.auraRing) {
      p.auraRing.position.y = -inner.position.y + 0.01;
      p.auraRing.rotation.z = t * 0.5;
      p.auraRing.material.opacity = 0.2 + Math.sin(t * 2.6) * 0.09;
    }
  }

  // Troll: casca luminosa enquanto a carne se refaz.
  if (p.healGlow) {
    p.healGlow.visible = !!info.healing;
    if (info.healing) {
      p.healGlow.scale.setScalar(1 + Math.sin(t * 6 + anim.phase) * 0.07);
      p.healGlow.material.opacity = 0.18 + Math.sin(t * 8) * 0.1;
    }
  }
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

  // Chefes: almas em órbita e estandarte ao vento.
  if (p.souls) {
    for (let i = 0; i < p.souls.length; i++) {
      const sl = p.souls[i];
      const a = sl.userData.angle + t * 1.1;
      sl.position.set(Math.cos(a) * 0.36, 0.5 + Math.sin(a * 2) * 0.08, Math.sin(a) * 0.36);
      sl.rotation.set(t, a, 0);
    }
  }
  if (p.banner) p.banner.rotation.y = Math.sin(t * 2.2 + anim.phase) * 0.3;
  // O Xamã anima o anel dentro do ramo de planar; os chefes andam, então o
  // deles precisa ser tratado aqui.
  if (p.auraRing && !p.glide) {
    p.auraRing.position.y = -inner.position.y + 0.015;
    p.auraRing.rotation.z = t * 0.4;
    p.auraRing.material.opacity = 0.22 + Math.sin(t * 2.4) * 0.1;
  }

  // Ocultação
  if (holder.userData.cloakMark) {
    const oculto = !!info.cloaked;
    inner.visible = !oculto;
    holder.userData.cloakMark.visible = oculto;
    if (oculto) {
      const pulso = 1 + Math.sin(t * 5 + anim.phase) * 0.12;
      holder.userData.cloakMark.scale.setScalar(pulso);
      holder.userData.cloakMark.material.opacity = 0.25 + Math.sin(t * 4) * 0.12;
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
/**
 * Anima o Mestre de Obras em qualquer forma: Peão (armR + martelo) ou uma das
 * 4 vocações (arms com arma, ou orb/shards/sats de conjurador — mesmo esquema
 * usado pelas torres). O recuo de ataque é o mesmo pokeRecoil() das torres.
 */
export function animateWorker(g, info, t, dt) {
  const p = g.userData;
  const anim = p.anim || (p.anim = { yaw: 0, recoil: 0, phase: Math.random() * 6.28 });
  anim.yaw = lerpAngle(anim.yaw, info.yaw, 1 - Math.pow(0.002, dt));
  g.rotation.y = anim.yaw;
  anim.recoil = Math.max(0, anim.recoil - dt * 4.5);

  if (info.walking) {
    const gait = t * 11;
    p.legL.rotation.x = Math.sin(gait) * 0.7;
    p.legR.rotation.x = -Math.sin(gait) * 0.7;
    if (p.armR) p.armR.rotation.x = -Math.sin(gait) * 0.4;
    g.position.y = Math.abs(Math.sin(gait)) * 0.04;
  } else if (info.building) {
    p.legL.rotation.x = p.legR.rotation.x = 0;
    if (p.armR) {
      // Martelada: sobe devagar, desce rápido
      const swing = (Math.sin(t * 9) + 1) / 2;
      p.armR.rotation.x = -2.0 + Math.pow(swing, 0.45) * 2.3;
    } else if (p.torso) {
      // Vocações não seguram martelo: um vaivém genérico de "trabalhando".
      p.torso.rotation.x = Math.sin(t * 9) * 0.1;
    }
    g.position.y = 0;
  } else {
    p.legL.rotation.x = p.legR.rotation.x = 0;
    if (p.armR) p.armR.rotation.x = Math.sin(t * 2) * 0.12 - anim.recoil * 0.85;
    if (p.arms) p.arms.rotation.x = -anim.recoil * 0.85;
    g.position.y = Math.sin(t * 2) * 0.012;
  }

  if (p.orb) {
    const orbY = p.orbY || 0.58;
    p.orb.position.y = orbY + Math.sin(t * 2.4 + anim.phase) * 0.045;
    p.orb.rotation.set(t * 0.8, t * 1.3, 0);
    const pulse = 1 + Math.sin(t * 3.4) * 0.12 + anim.recoil * 0.6;
    p.orb.scale.setScalar(pulse);
    if (p.halo) {
      p.halo.position.y = p.orb.position.y;
      p.halo.scale.setScalar(0.36 * pulse * (1 + anim.recoil));
      p.halo.material.opacity = 0.3 + Math.sin(t * 3.4) * 0.08 + anim.recoil * 0.4;
    }
  }
  if (p.shards) {
    for (let i = 0; i < p.shards.length; i++) {
      const sh = p.shards[i];
      const a = sh.userData.angle + t * 1.4;
      sh.position.set(Math.cos(a) * 0.14, (p.orbY || 0.58) + Math.sin(a * 2) * 0.04, 0.05 + Math.sin(a) * 0.14);
      sh.rotation.set(t * 1.7, a, 0);
    }
  }
  if (p.sats) {
    for (let i = 0; i < p.sats.length; i++) {
      const c = p.sats[i];
      c.position.y = c.userData.baseY + Math.sin(t * 1.7 + i) * 0.015;
    }
  }
  if (p.tierRing) p.tierRing.scale.setScalar(1 + Math.sin(t * 2.2) * 0.05);
}
