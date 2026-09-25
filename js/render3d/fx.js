// -----------------------------------------------------------------------------
// Bastion Line — efeitos 3D
// Projéteis, impactos, explosões e poeira. Tudo sai de pools pré-alocados:
// nenhum objeto é criado durante o jogo.
// -----------------------------------------------------------------------------
import { THREE, PAL, glow, hexInt } from './core.js';

const MAX_BOLTS = 72;
const MAX_RINGS = 56;
const MAX_SPARKS = 320;

// Assinatura visual de cada tipo de torre.
const SHOT_STYLE = {
  militia: { melee: true, width: 0.05, color: 0xfff0c4 },
  archer: { width: 0.028, length: 0.34, color: 0xe6d6a8, tip: 0xfff4d0 },
  mage: { width: 0.085, length: 0.26, color: null, tip: 0xfff2d8, soft: true },
  frost: { width: 0.06, length: 0.22, color: PAL.frost, tip: 0xeafffd },
  // O raio é fino, longo e claríssimo: lê como descarga, não como projétil.
  lightning: { width: 0.022, length: 0.5, color: 0x6fd0ff, tip: 0xeaffff, soft: true },
  nature: { width: 0.05, length: 0.24, color: 0x9fd84a, tip: 0xe2ffb0, soft: true },
  // A armadilha tem alcance 34, menos de uma célula: é golpe, não projétil.
  trap: { melee: true, width: 0.05, color: 0xd8c48a },
  necro: { width: 0.075, length: 0.22, color: 0x8f7ab8, tip: 0xd9c8ff, soft: true }
};

export function createEffects(scene, map) {
  const group = new THREE.Group();
  group.name = 'fx';
  scene.add(group);

  // ---- pool de projéteis -------------------------------------------------
  const boltGeo = new THREE.BoxGeometry(1, 1, 1);
  const trailGeo = new THREE.BoxGeometry(1, 1, 1);
  const bolts = [];
  for (let i = 0; i < MAX_BOLTS; i++) {
    const head = new THREE.Mesh(boltGeo, glow(0xffffff, 1).clone());
    const trail = new THREE.Mesh(trailGeo, glow(0xffffff, 0.5).clone());
    head.visible = trail.visible = false;
    head.frustumCulled = trail.frustumCulled = false;
    group.add(head, trail);
    bolts.push({ head: head, trail: trail });
  }

  // ---- pool de anéis no chão --------------------------------------------
  const ringGeo = new THREE.RingGeometry(0.72, 1.0, 28);
  const rings = [];
  for (let i = 0; i < MAX_RINGS; i++) {
    const m = new THREE.Mesh(ringGeo, glow(0xffffff, 1).clone());
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    m.frustumCulled = false;
    group.add(m);
    rings.push(m);
  }

  // ---- pool de estilhaços (uma só draw call) -----------------------------
  const sparkGeo = new THREE.BoxGeometry(0.055, 0.055, 0.055);
  const sparkMat = glow(0xffffff, 1).clone();
  const sparks = new THREE.InstancedMesh(sparkGeo, sparkMat, MAX_SPARKS);
  sparks.frustumCulled = false;
  sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  sparks.count = 0;
  group.add(sparks);

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const mid = new THREE.Vector3();

  let boltUsed = 0, ringUsed = 0, sparkUsed = 0;

  function takeBolt() { return boltUsed < MAX_BOLTS ? bolts[boltUsed++] : null; }
  function takeRing() { return ringUsed < MAX_RINGS ? rings[ringUsed++] : null; }

  function addSpark(x, y, z, scale, hex, alpha) {
    if (sparkUsed >= MAX_SPARKS) return;
    dummy.position.set(x, y, z);
    dummy.rotation.set(x * 7, y * 11 + z, z * 5);
    dummy.scale.setScalar(Math.max(0.001, scale));
    dummy.updateMatrix();
    sparks.setMatrixAt(sparkUsed, dummy.matrix);
    color.setHex(hex).multiplyScalar(Math.max(0.05, alpha));
    sparks.setColorAt(sparkUsed, color);
    sparkUsed++;
  }

  /** Reconstrói todos os efeitos do frame a partir da lista do núcleo do jogo. */
  function update(attackFX, t) {
    boltUsed = ringUsed = sparkUsed = 0;

    for (let i = 0; i < attackFX.length; i++) {
      const f = attackFX[i];
      const life = Math.max(0, Math.min(1, f.life / f.maxLife)); // 1 = recém-criado
      const age = 1 - life;
      const hex = hexInt(f.color);

      a.set(map.x(f.x1), 0.32, map.z(f.y1));
      b.set(map.x(f.x2), 0.32, map.z(f.y2));

      if (f.kind === 'shot' || (!f.kind && !f.impact)) {
        const style = SHOT_STYLE[f.unitType] || SHOT_STYLE.archer;

        if (style.melee) {
          // Corpo a corpo: arco de lâmina junto ao alvo
          const ring = takeRing();
          if (ring) {
            ring.visible = true;
            ring.position.set(b.x, 0.34, b.z);
            ring.rotation.z = Math.atan2(b.z - a.z, b.x - a.x) + age * 2.4;
            ring.scale.setScalar(0.22 + age * 0.3);
            ring.material.color.setHex(style.color);
            ring.material.opacity = life * 0.85;
          }
          for (let s = 0; s < 3; s++) {
            addSpark(
              b.x + (s - 1) * 0.07, 0.35 + age * 0.12, b.z + (s % 2) * 0.06,
              0.5 + life * 0.6, style.color, life * 0.9
            );
          }
        } else {
          // À distância: o projétil percorre o trajeto durante a vida do efeito
          const bolt = takeBolt();
          if (bolt) {
            const travel = Math.min(1, age * 1.35 + 0.1);
            mid.lerpVectors(a, b, travel);
            const dir = b.clone().sub(a);
            const len = Math.max(0.001, dir.length());
            const shotColor = style.color === null ? hex : style.color;

            bolt.head.visible = true;
            bolt.head.position.copy(mid);
            bolt.head.lookAt(b.x, b.y, b.z);
            const hw = style.width * (style.soft ? 1.5 : 1);
            bolt.head.scale.set(hw, hw, style.length || 0.3);
            bolt.head.material.color.setHex(style.tip || shotColor);
            bolt.head.material.opacity = Math.min(1, life * 1.6);

            // Rastro entre a origem e a posição atual
            const trailLen = len * travel;
            bolt.trail.visible = trailLen > 0.05;
            if (bolt.trail.visible) {
              mid.lerpVectors(a, b, travel * 0.5);
              bolt.trail.position.copy(mid);
              bolt.trail.lookAt(b.x, b.y, b.z);
              bolt.trail.scale.set(style.width * 0.6, style.width * 0.6, trailLen);
              bolt.trail.material.color.setHex(shotColor);
              bolt.trail.material.opacity = life * (style.soft ? 0.55 : 0.35);
            }
          }
        }

        // Área de efeito rente ao chão
        if (f.splashR) {
          const ring = takeRing();
          if (ring) {
            ring.visible = true;
            ring.position.set(b.x, 0.06, b.z);
            ring.rotation.z = 0;
            ring.scale.setScalar(Math.max(0.08, map.len(f.splashR) * (0.35 + age * 0.75)));
            ring.material.color.setHex(hex);
            ring.material.opacity = life * 0.55;
          }
        }
        continue;
      }

      if (f.kind === 'impact' || f.impact) {
        // Clarão de acerto: anel curto + faíscas radiais
        const ring = takeRing();
        if (ring) {
          ring.visible = true;
          ring.position.set(b.x, 0.3, b.z);
          ring.rotation.x = -Math.PI / 2;
          ring.rotation.z = 0;
          ring.scale.setScalar(0.1 + age * 0.4);
          ring.material.color.setHex(hex);
          ring.material.opacity = life * 0.9;
        }
        for (let s = 0; s < 4; s++) {
          const ang = s * Math.PI / 2 + Math.PI / 4;
          const d = 0.08 + age * 0.3;
          addSpark(b.x + Math.cos(ang) * d, 0.32 + age * 0.14, b.z + Math.sin(ang) * d, 0.6 * life + 0.25, hex, life);
        }
        continue;
      }

      if (f.kind === 'death') {
        // Morte: onda no chão + estilhaços subindo
        const ring = takeRing();
        if (ring) {
          ring.visible = true;
          ring.position.set(b.x, 0.05, b.z);
          ring.rotation.x = -Math.PI / 2;
          ring.rotation.z = age * 1.2;
          ring.scale.setScalar(0.12 + age * map.len(f.splashR || 20) * 1.5);
          ring.material.color.setHex(hex);
          ring.material.opacity = life * 0.7;
        }
        for (let s = 0; s < 7; s++) {
          const ang = (s / 7) * Math.PI * 2 + b.x;
          const d = age * 0.5;
          addSpark(
            b.x + Math.cos(ang) * d, 0.18 + age * 0.55 - age * age * 0.5, b.z + Math.sin(ang) * d,
            0.9 * life, hex, life
          );
        }
        continue;
      }

      if (f.kind === 'build') {
        // Construção concluída: anel dourado subindo
        const ring = takeRing();
        if (ring) {
          ring.visible = true;
          ring.position.set(b.x, 0.05 + age * 0.7, b.z);
          ring.rotation.x = -Math.PI / 2;
          ring.rotation.z = 0;
          ring.scale.setScalar(0.55 - age * 0.18);
          ring.material.color.setHex(PAL.goldLight);
          ring.material.opacity = life * 0.8;
        }
        for (let s = 0; s < 6; s++) {
          const ang = (s / 6) * Math.PI * 2 + t;
          addSpark(
            b.x + Math.cos(ang) * 0.42, 0.1 + age * 0.9, b.z + Math.sin(ang) * 0.42,
            0.8 * life, PAL.gold, life
          );
        }
      }
    }

    // Esconde o que sobrou dos pools
    for (let i = boltUsed; i < MAX_BOLTS; i++) {
      bolts[i].head.visible = false;
      bolts[i].trail.visible = false;
    }
    for (let i = ringUsed; i < MAX_RINGS; i++) rings[i].visible = false;

    sparks.count = sparkUsed;
    sparks.instanceMatrix.needsUpdate = true;
    if (sparks.instanceColor) sparks.instanceColor.needsUpdate = true;
  }

  return { group: group, update: update };
}
