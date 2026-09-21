// -----------------------------------------------------------------------------
// Bastion Line — base do renderer 3D
// Paleta, cache de geometrias/materiais e utilitários compartilhados.
// -----------------------------------------------------------------------------
import * as THREE from '../../vendor/three/three.module.min.js';
export { THREE };

// 1 célula do tabuleiro = 1 unidade de mundo.
export const CELL_WORLD = 1;

// Cor do céu na linha do horizonte. A névoa usa exatamente esta cor, para que
// o cenário distante se dissolva no céu sem costura visível.
export const HORIZON = 0x9fb6c4;

export const PAL = {
  grass:     0x6d9440,
  grassAlt:  0x5e8636,
  grassDry:  0x87a349,
  grassDark: 0x44622a,
  soil:      0x6b5233,
  road:      0x938c78,
  roadAlt:   0x847d69,
  roadEdge:  0x6d6757,
  stone:     0xb2ab98,
  stoneMid:  0x8e8876,
  stoneDark: 0x5f5a4c,
  wood:      0x936731,
  woodDark:  0x64451f,
  bone:      0xd9d3b9,
  skin:      0xe0b478,
  cloth:     0xb8a985,
  iron:      0x9aa0a6,
  ironDark:  0x5c6167,
  gold:      0xd9992f,
  goldLight: 0xf2c15a,
  ember:     0xff9a3d,
  frost:     0x8fe0d8,
  arcane:    0x7fb2ff,
  poison:    0x8ad24a,
  leaf:      0x4d7a2b,
  leafAlt:   0x5d8f33,
  sky:       0x8fb6d8,
  night:     0x141a10
};

// ---- caches ----------------------------------------------------------------
const geoCache = new Map();
const matCache = new Map();

/** Geometria compartilhada, construída sob demanda e reaproveitada por chave. */
export function geo(key, build) {
  let g = geoCache.get(key);
  if (!g) { g = build(); geoCache.set(key, g); }
  return g;
}

/** MeshStandardMaterial compartilhado — visual low-poly (flat shading) por padrão. */
export function std(color, opts) {
  const o = opts || {};
  const key = color + '|' + JSON.stringify(o);
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial(Object.assign({
      color: color,
      flatShading: true,
      roughness: 0.82,
      metalness: 0.0
    }, o));
    matCache.set(key, m);
  }
  return m;
}

/** Material aditivo para brilhos, rastros e partículas. */
export function glow(color, opacity) {
  const key = 'glow|' + color + '|' + opacity;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: opacity === undefined ? 1 : opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false
    });
    matCache.set(key, m);
  }
  return m;
}

/** Textura radial suave, para brilhos que não podem virar quadrados. */
let _glowTex = null;
export function glowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  _glowTex = new THREE.CanvasTexture(c);
  _glowTex.colorSpace = THREE.SRGBColorSpace;
  return _glowTex;
}

// ---- helpers ---------------------------------------------------------------
/** Mesh posicionado, com sombras ligadas por padrão. */
export function mesh(g, m, x, y, z) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x || 0, y || 0, z || 0);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

/** PRNG determinístico (mulberry32) — cenário idêntico a cada carregamento. */
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function lerp(a, b, t) { return a + (b - a) * t; }

/** Clareia (f > 1) ou escurece (f < 1) uma cor, mantendo o matiz. */
const _shadeColor = new THREE.Color();
export function shade(hex, f) {
  _shadeColor.setHex(hex).multiplyScalar(f);
  _shadeColor.r = Math.min(1, _shadeColor.r);
  _shadeColor.g = Math.min(1, _shadeColor.g);
  _shadeColor.b = Math.min(1, _shadeColor.b);
  return _shadeColor.getHex();
}

/** Interpolação angular pelo caminho mais curto — evita o giro de 359°. */
export function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/** Suavização independente de framerate: fração aplicada por segundo. */
export function damp(current, target, smoothing, dt) {
  return lerp(current, target, 1 - Math.pow(smoothing, dt));
}

/** Converte '#rrggbb' do núcleo 2D para inteiro aceito pelo three.js. */
export function hexInt(css) {
  if (typeof css === 'number') return css;
  if (!css) return 0xffffff;
  return parseInt(css.replace('#', ''), 16) || 0xffffff;
}

/** Remove e libera os filhos de um nó, preservando geometrias/materiais em cache. */
export function clearGroup(group) {
  for (let i = group.children.length - 1; i >= 0; i--) {
    group.remove(group.children[i]);
  }
}

/**
 * Conversor entre o espaço lógico do núcleo do jogo (pixels, origem no canto
 * superior esquerdo) e o espaço de mundo do three.js (células, origem no centro
 * do tabuleiro, +z na direção do bastião).
 */
export function makeMap(COLS, ROWS, CELL) {
  return {
    COLS: COLS, ROWS: ROWS, CELL: CELL,
    halfW: COLS / 2, halfH: ROWS / 2,
    x: function (lx) { return lx / CELL - COLS / 2; },
    z: function (ly) { return ly / CELL - ROWS / 2; },
    colX: function (c) { return c - COLS / 2 + 0.5; },
    rowZ: function (r) { return r - ROWS / 2 + 0.5; },
    len: function (px) { return px / CELL; },
    toLogicalX: function (wx) { return (wx + COLS / 2) * CELL; },
    toLogicalY: function (wz) { return (wz + ROWS / 2) * CELL; }
  };
}
