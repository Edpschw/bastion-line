// Modelos GLB detalhados. Carregamento sob demanda, instâncias independentes e
// geometrias/materiais compartilhados; a partida não espera pela rede.
import { THREE } from './core.js?v=siege-art-5';
import { GLTFLoader } from '../../vendor/three/GLTFLoader.js';

export const TOWER_BRANCHES = {
  militia: ['guardiao', 'guerreiro'], archer: ['patrulheira', 'francoatiradora'],
  mage: ['piromante', 'arcanista'], frost: ['eterna', 'cristalina'],
  lightning: ['corrente', 'canhao'], nature: ['bosque', 'praga'],
  trap: ['toxica', 'explosiva'], necro: ['lich', 'senhor']
};
const LEVELS = [1, 5, 10, 15, 20];

export function towerModelKey(type, tier, branch) {
  if (!TOWER_BRANCHES[type]) throw new Error('Classe de torre desconhecida: ' + type);
  if (!Number.isInteger(tier) || tier < 1 || tier > 5) throw new Error('Tier inválido: ' + tier);
  if (tier > 1 && !TOWER_BRANCHES[type].includes(branch)) throw new Error('Ramo inválido: ' + branch);
  return type + '__' + (tier === 1 ? 'base' : branch) + '__L' + String(LEVELS[tier - 1]).padStart(2, '0');
}

function disposeTemplate(root) {
  const geometries = new Set(), materials = new Set();
  root.traverse(o => {
    if (!o.isMesh) return;
    geometries.add(o.geometry);
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m));
  });
  geometries.forEach(g => g.dispose());
  materials.forEach(m => m.dispose());
}

/** Limita o cache ocioso e as requisições concorrentes, sem expulsar modelos em uso. */
export function createTowerModelCache(load, { idleLimit = 8, concurrency = 3 } = {}) {
  const entries = new Map(), queue = [];
  let active = 0, clock = 0;
  function pump() {
    while (active < concurrency && queue.length) {
      const task = queue.shift(); active++;
      Promise.resolve().then(task.run).then(task.resolve, task.reject).finally(() => { active--; pump(); });
    }
  }
  function schedule(run) {
    const promise = new Promise((resolve, reject) => queue.push({ run, resolve, reject }));
    pump(); return promise;
  }
  function evict(all = false) {
    const idle = [...entries.values()].filter(e => e.root && e.refs === 0).sort((a,b) => a.used - b.used);
    while (idle.length > (all ? 0 : idleLimit)) {
      const e = idle.shift(); entries.delete(e.key); disposeTemplate(e.root);
    }
  }
  return {
    async acquire(type, tier, branch) {
      const key = towerModelKey(type, tier, branch);
      let e = entries.get(key);
      if (!e) {
        e = { key, refs: 0, used: ++clock, root: null };
        entries.set(key, e);
        e.promise = schedule(() => load(key)).then(root => {
          e.root = root;
          root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
          return root;
        }).catch(error => { if (entries.get(key) === e) entries.delete(key); throw error; });
      }
      e.refs++; e.used = ++clock;
      try {
        const root = await e.promise;
        const instance = root.clone(true);
        let released = false;
        return {
          instance, key,
          release() { if (released) return; released = true; e.refs--; e.used = ++clock; evict(); }
        };
      } catch (error) { e.refs--; throw error; }
    },
    clearUnused() { evict(true); },
    stats() { return { entries: entries.size, active, queued: queue.length, references: [...entries.values()].reduce((n,e) => n + e.refs, 0) }; }
  };
}

const loader = new GLTFLoader();
export const towerModelCache = createTowerModelCache(async key => {
  const url = new URL('../../assets/towers/detailed/' + key + '.glb', import.meta.url);
  return (await loader.loadAsync(url.href)).scene;
});

/** Mantém o mesmo grupo/pickTarget enquanto troca a representação provisória. */
export function attachDetailedTower(group, type, tier, branch, options = {}) {
  const cache = options.modelCache || towerModelCache;
  const d = group.userData;
  let disposed = false, lease = null;
  const ghostMaterial = options.ghostMaterial || null;
  // Estes são os únicos recursos da torre procedural que não vêm dos caches.
  const ownedFallback = [d.mist, d.halo, d.tierRing].filter(Boolean).map(o => [o.geometry, o.material]);
  let fallbackReleased = false;
  function releaseFallback() {
    if (fallbackReleased) return;
    fallbackReleased = true;
    ownedFallback.forEach(([geometry, material]) => { geometry.dispose(); material.dispose(); });
  }
  function style(root) {
    if (!ghostMaterial) return;
    root.traverse(o => { if (o.isMesh) { o.material = ghostMaterial; o.castShadow = false; o.receiveShadow = false; } });
  }
  style(group);
  d.modelState = 'loading';
  d.disposeTower = () => {
    if (disposed) return;
    disposed = true; d.modelState = 'disposed';
    releaseFallback();
    if (lease) lease.release();
    if (ghostMaterial) ghostMaterial.dispose();
    group.clear();
  };
  d.modelReady = cache.acquire(type, tier, branch).then(acquired => {
    if (disposed) { acquired.release(); return false; }
    lease = acquired;
    const root = lease.instance;
    // Marcadores do exportador são irmãos da arma. Reparentear preservando a
    // transformação faz o projétil acompanhar mira e recuo do equipamento.
    const turret = root.getObjectByName('weapon');
    const muzzle = root.getObjectByName('muzzle');
    root.updateMatrixWorld(true);
    if (turret && muzzle) turret.attach(muzzle);
    style(root);
    releaseFallback();
    group.clear(); group.add(root);
    ['body','arms','orb','halo','shards','sats','mist','tierRing'].forEach(key => { d[key] = null; });
    d.turret = turret;
    d.turretRest = turret ? turret.position.clone() : null;
    d.muzzle = muzzle;
    d.height = new THREE.Box3().setFromObject(root).max.y;
    d.detailedModel = true;
    d.modelKey = lease.key;
    d.modelState = 'ready';
    return true;
  }).catch(error => {
    if (!disposed) {
      d.modelState = 'fallback';
      console.warn('[Bastion Line] modelo indisponível; mantendo torre procedural:', type, tier, branch, error);
    }
    return false;
  });
  return group;
}

export function disposeTower(group) {
  if (group.userData.disposeTower) group.userData.disposeTower();
}
