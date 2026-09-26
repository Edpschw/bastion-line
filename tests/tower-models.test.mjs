import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import * as THREE from '../vendor/three/three.module.min.js';
import { GLTFLoader } from '../vendor/three/GLTFLoader.js';
import { createTowerModelCache, towerModelKey, TOWER_BRANCHES, disposeTower } from '../js/render3d/towerModels.js?v=detailed-towers-1';
import { buildTower, animateTower, pokeRecoil } from '../js/render3d/actors.js?v=detailed-towers-1';

// The procedural fallback only uses this canvas to build a radial glow texture.
// Mesh loading/animation tests use the real Three.js scene graph and GLTFLoader.
globalThis.document = { createElement() { return { width: 64, height: 64, getContext() { return { createRadialGradient() { return { addColorStop() {} }; }, fillRect() {} }; } }; } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await fs.readFile(path.join(root,'assets/towers/detailed/manifest.json'),'utf8'));
const loader = new GLTFLoader();
let requests = 0;
async function load(key) {
  requests++;
  const bytes = await fs.readFile(path.join(root,'assets/towers/detailed',key+'.glb'));
  return (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
}
const cache = createTowerModelCache(load, { idleLimit: 2 });
const html = await fs.readFile(path.join(root,'index.html'),'utf8');
const data = vm.createContext({});
vm.runInContext(html.slice(html.indexOf('var UNIT_BASE='), html.indexOf('var ENEMY_BASE=')),data);
assert.equal(manifest.models.length,72);
assert.deepEqual(Object.keys(TOWER_BRANCHES).sort(),Object.keys(data.UNIT_BASE).sort());
for (const type of Object.keys(TOWER_BRANCHES)) assert.deepEqual(TOWER_BRANCHES[type].slice().sort(),Object.keys(data.BRANCHES[type]).sort());
assert.equal(towerModelKey('archer',1,'francoatiradora'),'archer__base__L01');
assert.throws(()=>towerModelKey('archer',2,'invalid'));
assert.throws(()=>towerModelKey('archer',6,'patrulheira'));
const seen = new Set();
for (const e of manifest.models) {
  const key = towerModelKey(e.type,e.tier,e.branch);
  assert.equal(key,e.id); assert.ok(!seen.has(key)); seen.add(key);
  const g = buildTower(e.type,e.tier,e.branch,0x80a66a,{modelCache:cache});
  const pickTarget = {x:108,y:216};g.userData.pickTarget=pickTarget;
  assert.equal(g.userData.modelState,'loading');
  assert.equal(await g.userData.modelReady,true,key);
  assert.equal(g.userData.modelState,'ready');assert.equal(g.userData.pickTarget,pickTarget);
  let triangles=0;
  g.traverse(o=>{if(!o.isMesh)return;const a=o.geometry.attributes;triangles+=(o.geometry.index?o.geometry.index.count:a.position.count)/3;for(const attr of Object.values(a))for(const n of attr.array)assert.ok(Number.isFinite(n));});
  assert.equal(triangles,e.triangles,key);
  const bounds=new THREE.Box3().setFromObject(g);
  assert.ok(bounds.min.y>=-1e-5);
  assert.ok(Math.max(Math.abs(bounds.min.x),Math.abs(bounds.max.x),Math.abs(bounds.min.z),Math.abs(bounds.max.z))<.5,key);
  if(e.type==='trap')assert.ok(bounds.max.y<.15);
  assert.ok(g.userData.muzzle.parent===g.userData.turret,'muzzle attached to rotating weapon');
  const structure=g.getObjectByName('structure');const rest=structure.position.clone();const turretRest=g.userData.turretRest.clone();
  animateTower(g,{yaw:Math.PI/2},1,.05);pokeRecoil(g,1);animateTower(g,{yaw:Math.PI/2},1.05,.01);
  assert.ok(structure.position.equals(rest));assert.equal(structure.rotation.y,0);
  if(e.type==='trap'){assert.equal(g.userData.turret.rotation.y,0);assert.ok(g.userData.turret.position.y<turretRest.y);}else{assert.ok(g.userData.turret.position.x<turretRest.x);}
  animateTower(g,{yaw:Math.PI/2},2,1);assert.ok(g.userData.turret.position.distanceTo(turretRest)<1e-7);
  disposeTower(g);disposeTower(g);assert.equal(g.children.length,0);
}
assert.equal(cache.stats().references,0);assert.ok(cache.stats().entries<=2);cache.clearUnused();assert.equal(cache.stats().entries,0);
// Concurrent placements share one request, geometry and material, but not transforms.
requests=0;
const same=createTowerModelCache(load,{idleLimit:0});
const [a,b]=await Promise.all([same.acquire('archer',5,'patrulheira'),same.acquire('archer',5,'patrulheira')]);
assert.equal(requests,1);assert.notEqual(a.instance,b.instance);
let ma,mb;a.instance.traverse(o=>{if(o.isMesh&&!ma)ma=o;});b.instance.traverse(o=>{if(o.isMesh&&!mb)mb=o;});
assert.equal(ma.geometry,mb.geometry);assert.equal(ma.material,mb.material);
a.instance.getObjectByName('weapon').rotation.y=1;assert.equal(b.instance.getObjectByName('weapon').rotation.y,0);
let disposed=0;ma.geometry.addEventListener('dispose',()=>disposed++);a.release();assert.equal(disposed,0);b.release();assert.equal(disposed,1);
// Ghost completion must not restore opaque/shared materials.
const ghosts=createTowerModelCache(load,{idleLimit:0});
const ghostMat=new THREE.MeshBasicMaterial({transparent:true,opacity:.42});
const ghost=buildTower('militia',1,null,0xe9aa48,{modelCache:ghosts,ghostMaterial:ghostMat});
await ghost.userData.modelReady;ghost.traverse(o=>{if(o.isMesh){assert.equal(o.material,ghostMat);assert.equal(o.castShadow,false);}});
const placed=buildTower('militia',1,null,0xe9aa48,{modelCache:ghosts});await placed.userData.modelReady;
placed.traverse(o=>{if(o.isMesh){assert.notEqual(o.material,ghostMat);assert.equal(o.material.transparent,false);}});
disposeTower(ghost);disposeTower(placed);
// Sale/evolution before download completion cannot reattach the old model.
let resolve;const delayed=createTowerModelCache(()=>new Promise(r=>{resolve=r;}),{idleLimit:0});
const old=buildTower('frost',2,'eterna',0x8edaff,{modelCache:delayed});
await Promise.resolve();disposeTower(old);resolve(await load('frost__eterna__L05'));
assert.equal(await old.userData.modelReady,false);assert.equal(old.children.length,0);assert.equal(delayed.stats().references,0);assert.equal(delayed.stats().entries,0);
// A download failure preserves the procedural representation and can be retried.
let attempts=0;const failing=createTowerModelCache(()=>{attempts++;throw new Error('simulated network error');});
const warn=console.warn;console.warn=()=>{};
const fallback=buildTower('necro',5,'lich',0x9c56ff,{modelCache:failing});
assert.equal(await fallback.userData.modelReady,false);assert.equal(fallback.userData.modelState,'fallback');assert.ok(fallback.children.length>0);animateTower(fallback,{yaw:0},1,.016);disposeTower(fallback);
await assert.rejects(failing.acquire('necro',5,'lich'));assert.equal(attempts,2);console.warn=warn;
// Concurrency is bounded even when distinct evolutions are requested together.
let running=0,peak=0;
const limited=createTowerModelCache(async key=>{running++;peak=Math.max(peak,running);await new Promise(r=>setTimeout(r,5));const out=await load(key);running--;return out;},{concurrency:2,idleLimit:0});
const batch=await Promise.all(Object.keys(TOWER_BRANCHES).slice(0,5).map(type=>limited.acquire(type,1,null)));batch.forEach(x=>x.release());assert.ok(peak<=2);assert.equal(limited.stats().references,0);
console.log('Detailed towers: 72 GLB + mapping, bounds, aim/recoil, ghosts, cancellation, fallback and shared cache OK');
