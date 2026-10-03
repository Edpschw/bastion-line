// -----------------------------------------------------------------------------
// Bastion Line — personagens animados (esqueleto + clipes)
//
// Carrega os modelos .glb de assets/characters/ (KayKit e Quaternius, CC0),
// clona cada instância com o esqueleto próprio (SkeletonUtils.clone) e toca os
// clipes por estado lógico — 'walk', 'attack', 'death'... — em vez do nome cru
// de cada pacote, que muda de autor para autor.
//
// O carregamento é preguiçoso e assíncrono: createCharacter() devolve null até
// o arquivo chegar, e quem chama segue com o modelo procedural de reserva.
// -----------------------------------------------------------------------------
import { THREE } from './core.js?v=siege-art-6';
import { GLTFLoader } from '../../vendor/three/GLTFLoader.js';
import { clone as cloneSkinned } from '../../vendor/three/addons/utils/SkeletonUtils.js';

const BASE = 'assets/characters/';

// Chave lógica → arquivo. Os KayKit foram enxugados por
// scripts/strip_glb_anims.py (só os clipes usados abaixo).
const MODELS = {
  barbarian:   'kaykit/Barbarian.glb',
  knight:      'kaykit/Knight.glb',
  rogue:       'kaykit/Rogue.glb',
  rogueHooded: 'kaykit/Rogue_Hooded.glb',
  mage:        'kaykit/Mage.glb',
  skelWarrior: 'kaykit/Skeleton_Warrior.glb',
  skelMage:    'kaykit/Skeleton_Mage.glb',
  skelMinion:  'kaykit/Skeleton_Minion.glb',
  skelRogue:   'kaykit/Skeleton_Rogue.glb',
  orc:         'quaternius/Orc.glb',
  wolf:        'quaternius/Wolf.glb',
  slime:       'quaternius/Slime.glb',
  yeti:        'quaternius/Yeti.glb',
  giant:       'quaternius/Giant.glb',
  blueDemon:   'quaternius/Blue_Demon.glb',
  demon:       'quaternius/Demon.glb',
  bat:         'quaternius/Bat.glb',
  wizard:      'quaternius/Wizard.glb',
  dragon:      'quaternius/Dragon_Evolved.glb'
};

// Estado lógico → nomes de clipe candidatos, em ordem de preferência. O nome
// comparado é o trecho depois do último '|' ('CharacterArmature|Walk' → 'Walk').
const CLIP_ALIASES = {
  idle:   ['Idle', 'Slime_Idle', 'Flying_Idle', 'Bat_Flying', 'Idle_2'],
  walk:   ['Walking_D_Skeletons', 'Walking_A', 'Walk', 'Slime_Walk', 'Flying_Idle', 'Bat_Flying'],
  run:    ['Running_C', 'Running_A', 'Run', 'Gallop', 'Fast_Flying', 'Bat_Flying', 'Slime_Walk', 'Walk'],
  attack: ['1H_Melee_Attack_Chop', '2H_Melee_Attack_Chop', 'Attack', 'Slime_Attack', 'Bat_Attack', 'Weapon', 'Punch', 'Headbutt'],
  shoot:  ['2H_Ranged_Shoot', '1H_Ranged_Shoot', 'Spellcast_Shoot', 'Spell1', 'Attack'],
  cast:   ['Spellcast_Shoot', 'Spell1', 'Staff_Attack', 'Attack', 'Punch'],
  build:  ['1H_Melee_Attack_Chop', 'Interact', 'Punch'],
  hit:    ['Hit_A', 'HitReact', 'HitRecieve', 'RecieveHit', 'Bat_Hit'],
  death:  ['Death_C_Skeletons', 'Death_A', 'Death', 'Slime_Death', 'Bat_Death'],
  cheer:  ['Cheer', 'Yes', 'Taunt'],
  spawn:  ['Spawn_Ground_Skeletons']
};

const loader = new GLTFLoader();
const cache = new Map();     // chave → { status, gltf, unit, promise }
const tintedMats = new Map(); // `${chave}|${tint}|${força}|${uuid}` → material

function shortName(name) {
  const i = name.lastIndexOf('|');
  return i < 0 ? name : name.slice(i + 1);
}

/** Começa a baixar os modelos indicados (ou todos). Falhas viram aviso, não erro. */
export function preloadCharacters(keys) {
  (keys || Object.keys(MODELS)).forEach(load);
}

function load(key) {
  let entry = cache.get(key);
  if (entry) return entry.promise;
  entry = { status: 'loading', gltf: null, unit: null, promise: null };
  cache.set(key, entry);
  entry.promise = loader.loadAsync(BASE + MODELS[key]).then(function (gltf) {
    // Mede com as matrizes já aplicadas: os modelos da Quaternius vêm em
    // centímetros e com a armadura girada, e só o mundo final diz a altura.
    gltf.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    entry.unit = { scale: 1 / size.y, yOffset: -box.min.y / size.y };
    const clips = new Map();
    for (const clip of gltf.animations) {
      const n = shortName(clip.name);
      if (!clips.has(n)) clips.set(n, clip);
    }
    entry.clips = clips;
    entry.gltf = gltf;
    entry.status = 'ready';
  }).catch(function (err) {
    entry.status = 'failed';
    console.warn('[Bastion Line] personagem indisponível:', key, err);
  });
  return entry.promise;
}

export function characterReady(key) {
  const e = cache.get(key);
  if (!e) { load(key); return false; }
  return e.status === 'ready';
}

function tinted(key, mat, tint, strength) {
  if (!tint) return mat;
  const id = key + '|' + tint + '|' + strength + '|' + mat.uuid;
  let m = tintedMats.get(id);
  if (!m) {
    m = mat.clone();
    m.color.copy(mat.color).lerp(new THREE.Color(tint), strength);
    tintedMats.set(id, m);
  }
  return m;
}

/**
 * Instancia um personagem pronto, ou null se o arquivo ainda não chegou.
 * opts.height: altura final em unidades locais de quem recebe a raiz.
 * opts.tint / opts.tintStrength: puxa a cor dos materiais para um tom.
 */
export function createCharacter(key, opts) {
  opts = opts || {};
  const entry = cache.get(key);
  if (!entry || entry.status !== 'ready') { load(key); return null; }

  const model = cloneSkinned(entry.gltf.scene);
  const strength = opts.tintStrength === undefined ? 0.45 : opts.tintStrength;
  model.traverse(function (o) {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = false;
    // A caixa do SkinnedMesh é a da pose de repouso: com a animação andando,
    // o corte por frustum some com braços e asas na borda da tela.
    if (o.isSkinnedMesh) o.frustumCulled = false;
    if (Array.isArray(o.material)) o.material = o.material.map(function (m) { return tinted(key, m, opts.tint, strength); });
    else if (o.material) o.material = tinted(key, o.material, opts.tint, strength);
  });

  const h = opts.height || 1;
  model.scale.multiplyScalar(h * entry.unit.scale);
  model.position.y = h * entry.unit.yOffset;

  const root = new THREE.Group();
  root.add(model);
  const mixer = new THREE.AnimationMixer(model);
  const actions = new Map();

  function resolve(state) {
    const names = CLIP_ALIASES[state] || [state];
    for (const n of names) {
      const clip = entry.clips.get(n);
      if (clip) return clip;
    }
    return null;
  }

  const inst = {
    key: key,
    root: root,
    state: null,
    has: function (state) { return !!resolve(state); },
    /**
     * Toca um estado. once: toca uma vez e para no último quadro (morte) ou
     * volta para `then` ao terminar (ataque). timeScale acerta o passo.
     */
    play: function (state, o) {
      o = o || {};
      const clip = resolve(state);
      if (!clip) return false;
      let action = actions.get(clip);
      if (!action) { action = mixer.clipAction(clip); actions.set(clip, action); }
      action.timeScale = o.timeScale || 1;
      if (inst.state === state && !o.once && inst.current === action) return true;
      const prev = inst.current;
      action.reset();
      action.enabled = true;
      if (o.once) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      } else {
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.clampWhenFinished = false;
      }
      action.play();
      if (prev && prev !== action) prev.crossFadeTo(action, o.fade === undefined ? 0.18 : o.fade, false);
      inst.current = action;
      inst.state = state;
      inst.returnTo = o.once ? (o.then || null) : null;
      return true;
    },
    update: function (dt) {
      mixer.update(dt);
      const a = inst.current;
      if (inst.returnTo && a && !a.isRunning()) {
        const next = inst.returnTo;
        inst.returnTo = null;
        inst.play(next, { fade: 0.12 });
      }
    },
    /** Duração do clipe de um estado, em segundos (0 se não houver). */
    duration: function (state) {
      const clip = resolve(state);
      return clip ? clip.duration : 0;
    },
    dispose: function () { mixer.stopAllAction(); mixer.uncacheRoot(model); }
  };
  return inst;
}

// -----------------------------------------------------------------------------
// Elenco: qual modelo veste cada inimigo, invocação e forma do construtor.
// height é em unidades locais do holder do inimigo (antes da escala pelo raio),
// alinhada com ENEMY_HEIGHT do index.js para as barras de vida casarem.
// -----------------------------------------------------------------------------
export const ENEMY_CAST = {
  grunt:     { key: 'orc',         height: 0.78 },
  raider:    { key: 'orc',         height: 0.7,  tint: 0xc0503a, tintStrength: 0.35, run: true },
  wolf:      { key: 'wolf',        height: 0.82, run: true },
  brute:     { key: 'slime',       height: 0.72, tint: 0x8fe04a, tintStrength: 0.35 },
  swarmling: { key: 'slime',       height: 0.5,  tint: 0x6ec46a, tintStrength: 0.3, run: true },
  orc:       { key: 'blueDemon',   height: 0.9,  tint: 0x4e7a3c, tintStrength: 0.65 },
  reaver:    { key: 'skelWarrior', height: 0.95 },
  troll:     { key: 'yeti',        height: 1.0,  tint: 0x6f8f5a, tintStrength: 0.55 },
  golem:     { key: 'giant',       height: 1.0,  tint: 0x8e8272, tintStrength: 0.55 },
  shaman:    { key: 'wizard',      height: 1.05, tint: 0x9a6ec4, tintStrength: 0.3 },
  assassin:  { key: 'skelRogue',   height: 0.85, tint: 0x5a4a6a, tintStrength: 0.35, run: true },
  harpy:     { key: 'bat',         height: 1.0,  tint: 0xb07ac4, tintStrength: 0.4 },
  warlord:   { key: 'demon',       height: 1.15, tint: 0x7a3a22, tintStrength: 0.35 },
  deathking: { key: 'skelMage',    height: 1.15, tint: 0x6a5a8a, tintStrength: 0.4 },
  boss:      { key: 'dragon',      height: 1.1,  tint: 0x3a7ac4, tintStrength: 0.55 }
};

export const MINION_CAST = { key: 'skelMinion', height: 0.62 };

/** Forma do Mestre de Obras por tier/vocação, e o estado de ataque de cada uma. */
export function builderCast(tier, branch) {
  if (tier < 2 || !branch) return { key: 'barbarian', attack: 'attack' };
  if (branch === 'cavaleiro') return { key: 'knight', attack: 'attack' };
  if (branch === 'paladino') return { key: 'rogue', attack: 'shoot', tint: 0xd9b23b, tintStrength: 0.3 };
  if (branch === 'feiticeiro') return { key: 'mage', attack: 'cast' };
  return { key: 'rogueHooded', attack: 'cast', tint: 0x4fae5a, tintStrength: 0.25 };
}

/** Todos os arquivos que a partida pode usar, para o preload do mount(). */
export function castKeys() {
  const keys = new Set([MINION_CAST.key, 'barbarian', 'knight', 'rogue', 'mage', 'rogueHooded']);
  Object.values(ENEMY_CAST).forEach(function (c) { keys.add(c.key); });
  return Array.from(keys);
}
