// Partículas em dois lotes de quadriláteros orientados para a câmera.
import { THREE } from './core.js?v=siege-art-6';

// quantidade, cor inicial/final, tamanho, vida, velocidade, gravidade, arrasto,
// subida, transparência, estrela, anel, expansão ao longo da vida.
const PRESETS = {
  hit_spark: [12,0xfff2cb,0xe57524,.095,.32,1.8,-4,2,.6,0,1,0,.2],
  arrow_trail: [2,0xf4dfad,0x927d58,.055,.19,.12,0,3,0,0,0,0,.2],
  fire_burst: [22,0xffdf80,0xb52b0d,.23,.48,1.3,-.5,2,.6,0,0,0,.3],
  ember: [3,0xffb54d,0xbd3518,.07,.45,.25,-.4,1,.4,0,1,0,.1],
  smoke_puff: [9,0x9a8879,0x655b58,.26,.7,.32,0,2,.3,1,0,0,2.5],
  frost_burst: [16,0xe6ffff,0x4795d4,.15,.42,1.4,-1,2,.35,0,1,0,.2],
  lightning_spark: [12,0xf1ffff,0x667bff,.11,.23,2,0,3,.1,0,1,0,.1],
  arcane_burst: [16,0xf5c9ff,0x7b3aba,.17,.5,.85,0,2,.3,0,1,0,.3],
  poison_cloud: [10,0xb6df65,0x3a713c,.25,.65,.4,0,2,.22,1,0,0,1.8],
  heal_sparkle: [14,0xffef9c,0x78d788,.12,.7,.2,0,1,.85,0,1,1,.1],
  death_dust: [14,0xbaaa8c,0x6d6259,.22,.65,.65,-.4,2,.25,1,0,0,2],
  build_dust: [18,0xc5b08d,0x7f705d,.2,.6,.65,-.3,2,.3,1,0,1,1.8],
  gold_pop: [12,0xfff1a5,0xd28a27,.115,.6,.7,-2,1,1.1,0,1,0,.2],
  level_up: [26,0xfff2b5,0xe6a93b,.12,.85,.15,0,1,1.15,0,1,1,.1]
};

// Escala para a câmera de RTS (9–20 unidades): as explosões precisam ler de
// longe. Rastros saem a cada quadro, então crescem menos e não multiplicam.
for (const [name, p] of Object.entries(PRESETS)) {
  const trail = name === 'arrow_trail' || name === 'ember';
  p[3] *= trail ? 1.4 : 1.8;
  if (!trail) { p[5] *= 1.35; p[0] = Math.round(p[0] * 1.35); }
}

const FROST_MIST = {count:5,color:0xb1e9ff,scale:.65};
const SOUL_WISP = {count:3,color:0x99d9df,scale:.65};
const BUILD_GOLD = {count:8,scale:.7};

export function createParticles(scene) {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32,32,0,32,32,31);
  gradient.addColorStop(0,'rgba(255,255,255,1)');
  gradient.addColorStop(.22,'rgba(255,255,255,.9)');
  gradient.addColorStop(.65,'rgba(255,255,255,.25)');
  gradient.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0,0,64,64);
  ctx.save(); ctx.translate(64,0); ctx.fillStyle = gradient; ctx.fillRect(0,0,64,64);
  ctx.translate(32,32); ctx.fillStyle = 'white'; ctx.beginPath();
  for(let i=0;i<8;i++) { const angle=i*Math.PI/4; const r=i%2?4:28; ctx.lineTo(Math.cos(angle)*r,Math.sin(angle)*r); }
  ctx.closePath(); ctx.fill(); ctx.restore();
  const texture = new THREE.CanvasTexture(canvas);
  const startColor = new THREE.Color(), endColor = new THREE.Color();
  let disposed = false;
  function makePool(capacity, alpha) {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setIndex([0,1,2,2,1,3]);
    geometry.setAttribute('position',new THREE.Float32BufferAttribute([-.5,-.5,0,.5,-.5,0,-.5,.5,0,.5,.5,0],3));
    const centers = new Float32Array(capacity*3), colors = new Float32Array(capacity*4), shapes = new Float32Array(capacity*3);
    geometry.setAttribute('center',new THREE.InstancedBufferAttribute(centers,3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('tint',new THREE.InstancedBufferAttribute(colors,4).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('shape',new THREE.InstancedBufferAttribute(shapes,3).setUsage(THREE.DynamicDrawUsage));
    const material = new THREE.ShaderMaterial({
      uniforms:{sprite:{value:texture}}, transparent:true, depthWrite:false, fog:false, toneMapped:false,
      blending:alpha?THREE.NormalBlending:THREE.AdditiveBlending,
      vertexShader:`attribute vec3 center; attribute vec4 tint; attribute vec3 shape;
        varying vec2 vUv; varying vec4 vTint;
        void main(){vUv=position.xy+.5; vUv.x=(vUv.x+shape.z)*.5; vTint=tint;
          float c=cos(shape.y),s=sin(shape.y);
          vec2 q=mat2(c,-s,s,c)*position.xy*shape.x;
          vec4 p=modelViewMatrix*vec4(center,1.); p.xy+=q;
          gl_Position=projectionMatrix*p;}`,
      fragmentShader:`uniform sampler2D sprite; varying vec2 vUv; varying vec4 vTint;
        void main(){float a=texture2D(sprite,vUv).a*vTint.a; if(a<.003)discard;
          gl_FragColor=vec4(vTint.rgb,a);
          #include <colorspace_fragment>
        }`
    });
    const mesh = new THREE.Mesh(geometry,material); mesh.frustumCulled=false; mesh.renderOrder=alpha?4:5;
    geometry.instanceCount=0; scene.add(mesh);
    // Cada registro contém apenas números; a remoção troca com o último vivo.
    return {capacity,count:0,geometry,material,mesh,centers,colors,shapes,data:new Float32Array(capacity*24)};
  }
  const pools=[makePool(2200,false),makePool(800,true)];
  function emit(name, position, options) {
    if(disposed)return;
    const p=PRESETS[name]; if(!p)return;
    const pool=pools[p[9]], d=pool.data;
    const count=options?.count ?? p[0], scale=options?.scale ?? 1;
    startColor.setHex(options?.color ?? p[1]); endColor.setHex(p[2]);
    for(let n=0;n<count && pool.count<pool.capacity;n++) {
      const k=pool.count++*24, angle=Math.random()*Math.PI*2, speed=p[5]*(.35+Math.random()*.65)*scale;
      const radius=p[11]? .42*scale : Math.random()*.07*scale;
      d[k]=position.x+Math.cos(angle)*radius; d[k+1]=position.y; d[k+2]=position.z+Math.sin(angle)*radius;
      d[k+3]=Math.cos(angle)*speed; d[k+4]=p[8]+Math.random()*speed*.7; d[k+5]=Math.sin(angle)*speed;
      d[k+6]=0; d[k+7]=p[4]*(.75+Math.random()*.5); d[k+8]=p[3]*scale*(.7+Math.random()*.6);
      d[k+9]=p[6]; d[k+10]=p[7]; d[k+11]=Math.random()*6.28; d[k+12]=(Math.random()-.5)*5;
      d[k+13]=startColor.r; d[k+14]=startColor.g; d[k+15]=startColor.b;
      d[k+16]=endColor.r; d[k+17]=endColor.g; d[k+18]=endColor.b;
      d[k+19]=p[10]; d[k+20]=p[12]; d[k+21]=p[9] ? .32 : .85;
    }
    // Camadas secundárias compartilham o mesmo teto global.
    if(name==='fire_burst') {emit('ember',position);emit('smoke_puff',position);}
    if(name==='frost_burst') emit('smoke_puff',position,FROST_MIST);
    if(name==='death_dust') emit('heal_sparkle',position,SOUL_WISP);
    if(name==='build_dust') emit('gold_pop',position,BUILD_GOLD);
  }
  function update(dt) {
    if(disposed)return;
    dt=Number.isFinite(dt)?Math.max(0,Math.min(dt,.1)):0;
    for(let p=0;p<2;p++) {
      const pool=pools[p],d=pool.data;
      for(let i=0;i<pool.count;) {
        const k=i*24; d[k+6]+=dt;
        if(d[k+6]>=d[k+7]) {pool.count--; d.copyWithin(k,pool.count*24,pool.count*24+24);continue;}
        const drag=Math.exp(-d[k+10]*dt); d[k+3]*=drag; d[k+4]=(d[k+4]+d[k+9]*dt)*drag; d[k+5]*=drag;
        d[k]+=d[k+3]*dt; d[k+1]+=d[k+4]*dt; d[k+2]+=d[k+5]*dt; d[k+11]+=d[k+12]*dt;
        const age=d[k+6]/d[k+7], curve=age*age*(3-2*age), c=i*3, q=i*4;
        pool.centers[c]=d[k];pool.centers[c+1]=d[k+1];pool.centers[c+2]=d[k+2];
        pool.shapes[c]=d[k+8]*(1+(d[k+20]-1)*curve);pool.shapes[c+1]=d[k+11];pool.shapes[c+2]=d[k+19];
        pool.colors[q]=d[k+13]+(d[k+16]-d[k+13])*curve;
        pool.colors[q+1]=d[k+14]+(d[k+17]-d[k+14])*curve;
        pool.colors[q+2]=d[k+15]+(d[k+18]-d[k+15])*curve;
        pool.colors[q+3]=d[k+21]*Math.min(1,age*12+.25)*(1-curve); i++;
      }
      pool.geometry.instanceCount=pool.count;pool.mesh.visible=pool.count>0;
      pool.geometry.attributes.center.needsUpdate=true;pool.geometry.attributes.tint.needsUpdate=true;pool.geometry.attributes.shape.needsUpdate=true;
    }
  }
  function dispose(){if(disposed)return;disposed=true;for(let p=0;p<2;p++){const pool=pools[p];scene.remove(pool.mesh);pool.geometry.dispose();pool.material.dispose();}texture.dispose();}
  return {emit,update,dispose};
}
