// -----------------------------------------------------------------------------
// Bastion Line — efeitos 3D
// Projéteis, impactos, explosões e poeira. Tudo sai de pools pré-alocados:
// nenhum objeto é criado durante o jogo.
// -----------------------------------------------------------------------------
import { THREE, PAL, glow, hexInt } from './core.js?v=siege-art-6';
import { createParticles } from './particles.js?v=siege-art-6';

const MAX_BOLTS = 72;
const MAX_RINGS = 56;


// Assinatura visual de cada tipo de torre.
const SHOT_STYLE = {
  militia: { melee: true, width: 0.05, color: 0xffe5a8 },
  archer: { width: 0.028, length: 0.42, color: 0xdfce9b, tip: 0xfff4d0 },
  mage: { width: 0.10, length: 0.26, color: null, tip: 0xffe8c9, soft: true },
  frost: { width: 0.075, length: 0.27, color: PAL.frost, tip: 0xeafffd },
  // O raio é fino, longo e claríssimo: lê como descarga, não como projétil.
  lightning: { width: 0.035, length: 0.52, color: null, tip: 0xf8ffff, soft: true },
  nature: { width: 0.075, length: 0.25, color: null, tip: 0xe2ffb0, soft: true },
  trap: { width: 0.11, length: 0.18, color: null, tip: 0xffecc2, soft: true },
  necro: { width: 0.09, length: 0.27, color: null, tip: 0xe9d5ff, soft: true },
  // O Mestre de Obras usa a mesma linguagem visual das torres, por vocação.
  'builder-peao': { melee: true, width: 0.035, color: 0xd9c9a0 },
  'builder-cavaleiro': { melee: true, width: 0.05, color: 0xffd6c4 },
  'builder-paladino': { width: 0.028, length: 0.34, color: 0xf2dca0, tip: 0xfff4d0 },
  'builder-feiticeiro': { width: 0.085, length: 0.26, color: null, tip: 0xe6d0ff, soft: true },
  'builder-naturalista': { width: 0.06, length: 0.22, color: 0x8fe0a0, tip: 0xeafff0 }
};

export function createEffects(scene, map) {
  const group = new THREE.Group(); group.name = 'fx'; scene.add(group);
  const particles = createParticles(group);
  const arrowGeo = new THREE.ConeGeometry(.5,1,5);
  arrowGeo.rotateX(Math.PI/2);
  const orbGeo = new THREE.SphereGeometry(.5,8,6);
  const lineGeo = new THREE.BoxGeometry(1,1,1);
  const ringGeo = new THREE.RingGeometry(.91,1,48);
  const bolts = [], rings = [];
  for(let i=0;i<MAX_BOLTS;i++) {
    const head=new THREE.Mesh(arrowGeo,glow(0xffffff,1).clone());
    const trail=new THREE.Mesh(lineGeo,glow(0xffffff,.5).clone());
    head.visible=trail.visible=false; group.add(head,trail); bolts.push({head,trail});
  }
  for(let i=0;i<MAX_RINGS;i++) {
    const ring=new THREE.Mesh(ringGeo,glow(0xffffff,1).clone());
    ring.rotation.x=-Math.PI/2;ring.visible=false;group.add(ring);rings.push(ring);
  }
  const a=new THREE.Vector3(),b=new THREE.Vector3(),mid=new THREE.Vector3();
  const options={count:2,scale:1};
  // Registro fixo evita alocar metadados a cada disparo e libera referências expiradas.
  const events=new Array(1024).fill(null), stamps=new Float64Array(1024), seen=new Uint32Array(1024);
  let frame=0,lastTime=null,boltUsed=0,ringUsed=0;
  function slot(f) {
    for(let i=0;i<events.length;i++)if(events[i]===f)return i;
    for(let i=0;i<events.length;i++)if(events[i]===null){events[i]=f;stamps[i]=-Infinity;seen[i]=0;return i;}
    return -1;
  }
  function burst(type) {
    if(type==='mage'||type==='trap')return 'fire_burst';
    if(type==='frost')return 'frost_burst';
    if(type==='lightning')return 'lightning_spark';
    if(type==='nature'||type==='builder-naturalista')return 'poison_cloud';
    if(type==='necro'||type==='builder-feiticeiro')return 'arcane_burst';
    return 'hit_spark';
  }
  function wave(position,radius,hex,opacity,height=0.045) {
    if(ringUsed>=MAX_RINGS)return;
    const ring=rings[ringUsed++];ring.visible=true;
    ring.position.set(position.x,height,position.z);ring.scale.setScalar(radius);
    ring.material.color.setHex(hex);ring.material.opacity=opacity;
  }
  function update(attackFX,t,resolveShotOrigin) {
    const dt=lastTime===null?0:Math.max(0,Math.min(.1,t-lastTime));lastTime=t;
    frame++;boltUsed=ringUsed=0;
    for(let i=0;i<attackFX.length;i++) {
      const f=attackFX[i],life=Math.max(0,Math.min(1,f.life/f.maxLife)),age=1-life;
      const hex=hexInt(f.color),id=slot(f),fresh=id>=0&&seen[id]===0;
      if(id>=0)seen[id]=frame;
      a.set(map.x(f.x1),.32,map.z(f.y1));b.set(map.x(f.x2),.32,map.z(f.y2));
      const shot=f.kind==='shot'||(!f.kind&&!f.impact),preset=burst(f.unitType);
      if(shot) {
        const style=SHOT_STYLE[f.unitType]||SHOT_STYLE.archer;
        if(!style.melee&&resolveShotOrigin)resolveShotOrigin(f,a);
        if(style.melee) {
          if(fresh)particles.emit('hit_spark',b);
          wave(b,.16+age*.23,style.color,life*.55,.28);
        } else {
          const travel=Math.min(1,age*1.35+.1);mid.lerpVectors(a,b,travel);
          // Emissões distribuídas no segmento impedem lacunas em frames lentos.
          if(id>=0 && t-stamps[id]>=.025 && travel<1) {
            const trail=f.unitType==='mage'||f.unitType==='trap'?'ember':
              f.unitType==='frost'?'smoke_puff':preset==='hit_spark'?'arrow_trail':preset;
            options.count=trail==='arrow_trail'?2:3;options.scale=trail==='smoke_puff'?.4:.55;
            for(let n=0;n<3;n++) {
              mid.lerpVectors(a,b,Math.max(0,travel-n*.055));particles.emit(trail,mid,options);
            }
            stamps[id]=t;mid.lerpVectors(a,b,travel);
          }
          if(fresh&&f.unitType==='lightning') {particles.emit('lightning_spark',a);particles.emit('lightning_spark',b);}
          if(boltUsed<MAX_BOLTS) {
            const bolt=bolts[boltUsed++],soft=style.soft||f.unitType==='frost';
            bolt.head.geometry=soft?orbGeo:arrowGeo;bolt.head.visible=true;
            bolt.head.position.copy(mid);bolt.head.lookAt(b);
            const width=style.width*(soft?2.2:2);
            bolt.head.scale.set(width,width,soft?width:style.length||.3);
            bolt.head.material.color.setHex(style.tip||hex);bolt.head.material.opacity=Math.min(1,life*2);
            // O feixe curto acompanha o projétil; só a eletricidade liga os dois pontos.
            const lightning=f.unitType==='lightning';
            const length=lightning?a.distanceTo(b):Math.min(.3,a.distanceTo(mid));
            bolt.trail.visible=length>.02;
            if(lightning)bolt.trail.position.lerpVectors(a,b,.5);
            else {bolt.trail.position.copy(mid);a.sub(b).normalize();bolt.trail.position.addScaledVector(a,length*.5);}
            bolt.trail.lookAt(b);bolt.trail.scale.set(style.width*.45,style.width*.45,length);
            bolt.trail.material.color.setHex(style.color??hex);bolt.trail.material.opacity=life*(lightning?.8:.28);
          }
        }
        if(f.splashR) {
          wave(b,Math.max(.08,map.len(f.splashR)*(.25+age*.85)),hex,life*.4);
          if(fresh)particles.emit(preset,b);
        }
      } else if(f.kind==='impact'||f.impact||f.kind==='splash') {
        if(fresh)particles.emit(preset,b);
        if(f.splashR)wave(b,Math.max(.12,map.len(f.splashR))*(.3+age),hex,life*.45);
      } else if(f.kind==='death') {
        if(fresh)particles.emit('death_dust',b);
      } else if(f.kind==='build') {
        if(fresh){particles.emit('build_dust',b);particles.emit('level_up',b);}
        wave(b,.48-age*.08,PAL.goldLight,life*.45,.06+age*.7);
      } else if(fresh) {
        // Compatibilidade com eventos opcionais sem mudar o contrato do núcleo.
        if(f.kind==='heal')particles.emit('heal_sparkle',b);
        if(f.kind==='gold')particles.emit('gold_pop',b);
        if(f.kind==='level_up')particles.emit('level_up',b);
        if(f.kind==='chain') {particles.emit('lightning_spark',a);particles.emit('lightning_spark',b);}
      }
    }
    for(let i=0;i<events.length;i++)if(events[i]!==null&&seen[i]!==frame)events[i]=null;
    for(let i=boltUsed;i<MAX_BOLTS;i++)bolts[i].head.visible=bolts[i].trail.visible=false;
    for(let i=ringUsed;i<MAX_RINGS;i++)rings[i].visible=false;
    particles.update(dt);
  }
  return {group:group,update:update};
}
