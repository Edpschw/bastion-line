// -----------------------------------------------------------------------------
// Bastion Line — peças de torre do Castle Kit (Kenney, CC0)
// Carrega os .glb uma vez, compartilha o material entre todas as peças e
// entrega clones prontos para empilhar. As medidas vêm do próprio modelo:
// nada de altura chumbada no código.
// -----------------------------------------------------------------------------
import { THREE } from './core.js';
import { GLTFLoader } from '../../vendor/three/GLTFLoader.js';

const BASE_URL = 'assets/towers/';

export const PIECE_NAMES = [
  'tower-square-base', 'tower-square-mid', 'tower-square-mid-windows',
  'tower-square-mid-open', 'tower-square-mid-open-simple', 'tower-square-top',
  'tower-hexagon-base', 'tower-hexagon-mid', 'tower-hexagon-top',
  'tower-hexagon-roof', 'tower-hexagon-roof-secondary',
  'tower-base', 'tower-top',
  'flag-pennant', 'flag-banner-short', 'siege-ballista'
];

const pieces = new Map();
let shared = null;

/**
 * Carrega todas as peças. Falhar aqui derruba o renderer 3D inteiro, e o
 * núcleo volta para o canvas 2D — é o caminho de fallback que já existia.
 */
export function preloadTowerKit() {
  const loader = new GLTFLoader();
  return Promise.all(PIECE_NAMES.map(function (name) {
    return loader.loadAsync(BASE_URL + name + '.glb').then(function (gltf) {
      const root = gltf.scene;
      root.traverse(function (o) {
        if (!o.isMesh) return;
        // Todas as peças do kit usam o mesmo colormap: um material só para o
        // conjunto inteiro evita trocas de estado a cada torre desenhada.
        if (!shared) {
          shared = o.material;
          shared.roughness = 0.88;
          shared.metalness = 0;
        }
        o.material = shared;
        o.castShadow = true;
        o.receiveShadow = true;
      });
      const box = new THREE.Box3().setFromObject(root);
      pieces.set(name, {
        root: root,
        height: box.max.y - box.min.y,
        minY: box.min.y
      });
    });
  }));
}

/** Clone de uma peça, pronto para entrar na cena. */
export function piece(name) {
  const entry = pieces.get(name);
  if (!entry) throw new Error('peça de torre não carregada: ' + name);
  const g = entry.root.clone(true);
  g.traverse(function (o) {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });
  return g;
}

/**
 * Empilha as peças na ordem dada, apoiando a base de cada uma no topo da
 * anterior. Devolve o grupo e a altura total alcançada.
 */
export function stackPieces(names) {
  const g = new THREE.Group();
  let y = 0;
  let lastBase = 0;
  for (let i = 0; i < names.length; i++) {
    const entry = pieces.get(names[i]);
    if (!entry) throw new Error('peça de torre não carregada: ' + names[i]);
    const p = piece(names[i]);
    p.position.y = y - entry.minY;
    g.add(p);
    lastBase = y;
    y += entry.height;
  }
  // `lastBase` é o piso da última peça: onde fica quem ocupa a ameia ou a
  // plataforma aberta. `top` é o ponto mais alto, onde vão bandeira e orbe.
  return { group: g, top: y, lastBase: lastBase };
}
