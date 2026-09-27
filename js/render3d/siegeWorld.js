// Cerco ao Vale — campo e arquitetura de cenário originais.
// A malha de células continua exata para a lógica, mas a superfície lê como
// um terreno único, com divisas gravadas em vez de um tabuleiro de cubos.
import {THREE,PAL,HORIZON,geo,std,glow,mesh,rng} from './core.js?v=siege-art-4';

const box=(w,h,d)=>geo(`valley-box:${w}:${h}:${d}`,()=>new THREE.BoxGeometry(w,h,d));
const cyl=(a,b,h,n=8)=>geo(`valley-cyl:${a}:${b}:${h}:${n}`,()=>new THREE.CylinderGeometry(a,b,h,n));
const cone=(r,h,n=6)=>geo(`valley-cone:${r}:${h}:${n}`,()=>new THREE.ConeGeometry(r,h,n));
const rock=r=>geo(`valley-rock:${r}`,()=>new THREE.DodecahedronGeometry(r,0));
const stone=std(0x92948a,{roughness:0.96});
const lightStone=std(0xb9b6a1,{roughness:0.94});
const darkStone=std(0x485154,{roughness:0.98});
const timber=std(0x5b402f,{roughness:0.98});
const iron=std(0x4e5b60,{metalness:0.42,roughness:0.6});
const ochre=std(0xa47943,{roughness:0.88});
const redCloth=std(0x933e36,{roughness:0.92,side:THREE.DoubleSide});
const tealCloth=std(0x346d70,{roughness:0.92,side:THREE.DoubleSide});
function add(g,shape,material,x,y,z){const p=mesh(shape,material,x,y,z);g.add(p);return p;}

export function createSky(){
  const sky=new THREE.Mesh(
    new THREE.SphereGeometry(120,24,12),
    new THREE.ShaderMaterial({
      side:THREE.BackSide,depthWrite:false,fog:false,
      uniforms:{
        topColor:{value:new THREE.Color(0x3e5b67)},
        midColor:{value:new THREE.Color(HORIZON)},
        botColor:{value:new THREE.Color(0xd2ba91)}
      },
      vertexShader:'varying vec3 p; void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'uniform vec3 topColor,midColor,botColor; varying vec3 p; void main(){float h=normalize(p).y;vec3 c=mix(botColor,midColor,smoothstep(-.23,.18,h));c=mix(c,topColor,smoothstep(.08,.75,h));gl_FragColor=vec4(c,1.);}'
    })
  );
  sky.frustumCulled=false;
  return sky;
}

export function createLights(scene,map){
  const hemi=new THREE.HemisphereLight(0xf3e9d0,0x465c4d,1.33);scene.add(hemi);
  const key=new THREE.DirectionalLight(0xffd69c,2.35);
  key.position.set(-8,15,7);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);
  key.shadow.bias=-0.0008;key.shadow.normalBias=0.025;
  const c=key.shadow.camera;
  c.near=1;c.far=48;c.left=-(map.halfW+5);c.right=map.halfW+5;
  c.top=map.halfH+5;c.bottom=-(map.halfH+5);c.updateProjectionMatrix();
  scene.add(key,key.target);
  const fill=new THREE.DirectionalLight(0x96b8c1,0.62);
  fill.position.set(8,8,-8);scene.add(fill);
  return {hemi,key,fill};
}

function vertexTone(x,z){
  const n=Math.sin(x*2.13+z*1.37)*0.035+Math.sin(x*5.7-z*3.1)*0.023;
  const edge=Math.min(1,Math.abs(x)/4+Math.abs(z)/10);
  const c=new THREE.Color(0x6d8054);
  c.lerp(new THREE.Color(0x817252),Math.max(0,Math.min(0.35,edge*0.18+n+0.08)));
  c.multiplyScalar(0.96+Math.sin(x*0.8+z*2.3)*0.025);
  return c;
}
export function createBoard(scene,map){
  const g=new THREE.Group(),rand=rng(0x5ee9e);
  const soil=add(g,box(map.COLS+0.18,0.72,map.ROWS+0.18),std(0x5b4b3d,{roughness:1}),0,-0.42,0);
  soil.castShadow=false;
  add(g,box(map.COLS+0.06,0.11,map.ROWS+0.06),darkStone,0,-0.095,0).castShadow=false;

  const surfaceGeo=new THREE.PlaneGeometry(map.COLS,map.ROWS,map.COLS*5,map.ROWS*5);
  surfaceGeo.rotateX(-Math.PI/2);
  const pos=surfaceGeo.attributes.position,colors=[];
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i);
    const c=vertexTone(x,z);colors.push(c.r,c.g,c.b);
  }
  surfaceGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const surface=add(g,surfaceGeo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide}),0,-0.018,0);
  surface.receiveShadow=true;surface.castShadow=false;

  // Células: linhas gravadas no solo, discretas porém exatas para construir.
  const lines=[];
  for(let c=0;c<=map.COLS;c++){
    const x=c-map.halfW;lines.push(x,0.012,-map.halfH,x,0.012,map.halfH);
  }
  for(let r=0;r<=map.ROWS;r++){
    const z=r-map.halfH;lines.push(-map.halfW,0.012,z,map.halfW,0.012,z);
  }
  const gridGeo=new THREE.BufferGeometry();
  gridGeo.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
  const grid=new THREE.LineSegments(gridGeo,new THREE.LineBasicMaterial({color:0x263a35,transparent:true,opacity:0.28,depthWrite:false}));
  g.add(grid);

  const stainGeo=new THREE.CircleGeometry(0.26,7);
  const stains=new THREE.InstancedMesh(stainGeo,new THREE.MeshBasicMaterial({
    color:0xffffff,transparent:true,opacity:0.13,depthWrite:false,side:THREE.DoubleSide
  }),84);
  const stainDummy=new THREE.Object3D(),stainColor=new THREE.Color();
  for(let i=0;i<84;i++){
    const c=(rand()*map.COLS)|0,r=1+((rand()*(map.ROWS-2))|0);
    stainDummy.position.set(map.colX(c)+(rand()-0.5)*0.8,0.002,map.rowZ(r)+(rand()-0.5)*0.8);
    stainDummy.rotation.set(-Math.PI/2,0,rand()*Math.PI);
    stainDummy.scale.set(0.45+rand()*0.75,0.4+rand()*0.6,1);
    stainDummy.updateMatrix();stains.setMatrixAt(i,stainDummy.matrix);
    stainColor.setHex(rand()>0.42?0x9a8054:0x31543a);stains.setColorAt(i,stainColor);
  }
  stains.instanceMatrix.needsUpdate=true;stains.instanceColor.needsUpdate=true;g.add(stains);

  // Entrada e saída pavimentadas: lajes irregulares numa faixa contínua.
  const slabGeo=box(0.82,0.055,0.76);
  const slabs=new THREE.InstancedMesh(slabGeo,std(0xffffff,{roughness:0.98}),map.COLS*2);
  const dummy=new THREE.Object3D(),color=new THREE.Color();
  for(let i=0;i<map.COLS*2;i++){
    const row=i<map.COLS?0:map.ROWS-1,c=i%map.COLS;
    dummy.position.set(map.colX(c)+(rand()-0.5)*0.1,0.012,map.rowZ(row)+(rand()-0.5)*0.11);
    dummy.rotation.set(0,(rand()-0.5)*0.13,0);
    dummy.scale.set(0.84+rand()*0.17,1,0.86+rand()*0.16);dummy.updateMatrix();
    slabs.setMatrixAt(i,dummy.matrix);
    color.setHex(rand()>0.55?0xa9a58f:0x777d72).multiplyScalar(0.86+rand()*0.21);
    slabs.setColorAt(i,color);
  }
  slabs.instanceMatrix.needsUpdate=true;slabs.instanceColor.needsUpdate=true;
  slabs.receiveShadow=true;g.add(slabs);

  // Pedra e capim são instanciados: variedade sem dezenas de draw calls.
  const pebble=new THREE.InstancedMesh(rock(0.09),std(0xffffff,{roughness:1}),76);
  for(let i=0;i<76;i++){
    const c=(rand()*map.COLS)|0,r=1+((rand()*(map.ROWS-2))|0);
    dummy.position.set(map.colX(c)+(rand()-0.5)*0.85,0.035,map.rowZ(r)+(rand()-0.5)*0.85);
    dummy.rotation.set(rand()*2,rand()*6,rand()*2);
    dummy.scale.set(0.28+rand()*0.55,0.24+rand()*0.35,0.28+rand()*0.55);dummy.updateMatrix();
    pebble.setMatrixAt(i,dummy.matrix);
    color.setHex(rand()>0.4?0x9d9881:0x617568).multiplyScalar(0.8+rand()*0.25);
    pebble.setColorAt(i,color);
  }
  pebble.instanceMatrix.needsUpdate=true;pebble.instanceColor.needsUpdate=true;g.add(pebble);

  const grass=new THREE.InstancedMesh(cone(0.052,0.19,3),std(0xffffff,{roughness:1}),130);
  for(let i=0;i<130;i++){
    const c=(rand()*map.COLS)|0,r=1+((rand()*(map.ROWS-2))|0);
    dummy.position.set(map.colX(c)+(rand()-0.5)*0.86,0.085,map.rowZ(r)+(rand()-0.5)*0.86);
    dummy.rotation.set(0,rand()*6,0);
    dummy.scale.set(0.6+rand(),0.45+rand()*0.7,0.6+rand());dummy.updateMatrix();
    grass.setMatrixAt(i,dummy.matrix);
    color.setHex(rand()>0.42?0x667c48:0x9c9661).multiplyScalar(0.86+rand()*0.3);
    grass.setColorAt(i,color);
  }
  grass.instanceMatrix.needsUpdate=true;grass.instanceColor.needsUpdate=true;g.add(grass);
  scene.add(g);return g;
}

function battlements(map){
  const g=new THREE.Group(),rand=rng(0xba5710);
  for(const side of [-1,1]){
    const x=side*(map.halfW+0.32);
    for(let row=0;row<map.ROWS;row++){
      const z=map.rowZ(row);
      add(g,box(0.45,0.24,0.93),darkStone,x,0.13,z);
      add(g,box(0.49,0.075,0.96),stone,x,0.29,z);
      if(row%2===0)add(g,box(0.41,0.26,0.38),lightStone,x,0.45,z-0.2);
      if(row>0&&row<map.ROWS-1&&row%3===1){
        const spike=add(g,cone(0.095,0.44,5),timber,x+side*0.22,0.58,z+0.23);
        spike.rotation.z=side*0.08;
      }
    }
    for(const row of [2,6,10]){
      const z=map.rowZ(row),px=side*(map.halfW+0.95);
      add(g,cyl(0.034,0.043,1.55,6),timber,px,0.78,z);
      add(g,cone(0.07,0.19,6),ochre,px,1.64,z);
      const banner=new THREE.Mesh(new THREE.PlaneGeometry(0.48,0.64),side<0?redCloth:tealCloth);
      banner.position.set(px+side*0.25,1.2,z);banner.castShadow=true;g.add(banner);
      add(g,box(0.5,0.028,0.03),timber,px+side*0.25,1.53,z);
    }
    // Degraus de pedra quebrados deixam o muro pertencer ao campo.
    for(let row=1;row<map.ROWS-1;row+=2){
      const z=map.rowZ(row)+(rand()-0.5)*0.12;
      const b=add(g,rock(0.2),stone,x+side*0.35,0.07,z);
      b.scale.set(1.2,0.5,0.9);
    }
  }
  return g;
}
function invasionGate(map){
  const g=new THREE.Group(),z=-map.halfH-1.55;
  // Portal arruinado: duas pilastras fendidas, frontão pesado e runa suspensa.
  for(const side of [-1,1]){
    const x=side*1.22;
    add(g,box(0.58,2.52,0.75),darkStone,x,1.26,z);
    add(g,box(0.70,0.17,0.88),stone,x,2.48,z);
    add(g,box(0.64,0.15,0.82),lightStone,x,2.61,z);
    add(g,box(0.18,1.8,0.08),stone,x+side*0.19,1.43,z+0.41);
    add(g,rock(0.25),darkStone,x+side*0.44,0.12,z+0.15);
  }
  add(g,box(3.0,0.38,0.9),darkStone,0,2.82,z);
  add(g,box(2.6,0.09,0.92),stone,0,3.04,z);
  add(g,cone(0.26,0.56,4),stone,0,3.33,z).rotation.y=Math.PI/4;
  const rune=add(g,rock(0.19),std(0x8463af,{emissive:0x7156a9,emissiveIntensity:0.7}),0,2.76,z+0.52);
  const veil=new THREE.Mesh(new THREE.PlaneGeometry(1.65,2.12),glow(0x6f4aa0,0.27).clone());
  veil.position.set(0,1.28,z+0.11);g.add(veil);
  const flames=[];
  for(const side of [-1,1]){
    const x=side*2.1;
    add(g,cyl(0.10,0.13,0.75,7),darkStone,x,0.38,z+0.35);
    add(g,cyl(0.27,0.18,0.20,8),iron,x,0.79,z+0.35);
    const fire=add(g,cone(0.17,0.52,7),glow(0xffa04a,0.84).clone(),x,1.14,z+0.35);
    fire.castShadow=false;
    const light=new THREE.PointLight(0xff8a39,3.5,6,2);
    light.position.set(x,1.26,z+0.35);g.add(light);
    flames.push({fire,light,side});
  }
  g.userData={veil,rune,flames};
  return g;
}
function defendedKeep(map){
  const g=new THREE.Group(),z=map.halfH+0.95;
  // Três volumes escalonados: muralha, guarita e torreões.
  add(g,box(map.COLS+2.4,1.26,1.0),stone,0,0.63,z);
  add(g,box(map.COLS+2.55,0.15,1.08),lightStone,0,1.32,z);
  for(let x=-map.halfW-1.1;x<=map.halfW+1.1;x+=0.67){
    if(Math.abs(x)<1.0)continue;
    add(g,box(0.36,0.29,0.93),lightStone,x,1.53,z);
  }
  add(g,box(2.6,2.16,1.36),stone,0,1.08,z-0.1);
  add(g,box(2.87,0.13,1.46),lightStone,0,2.19,z-0.1);
  for(const x of [-1.22,-0.72,0.72,1.22])
    add(g,box(0.3,0.28,1.25),lightStone,x,2.38,z-0.1);
  const gate=add(g,box(1.55,1.44,0.15),timber,0,0.73,z-0.88);
  for(const s of [-1,1]){
    add(g,box(0.1,1.45,0.18),iron,s*0.52,0.73,z-0.99);
    add(g,box(0.65,0.08,0.16),iron,s*0.42,0.72,z-0.99);
  }
  add(g,box(1.7,0.18,0.26),darkStone,0,1.52,z-0.9);
  const sigil=add(g,rock(0.17),ochre,0,2.02,z-0.83);
  const gateGlow=new THREE.Mesh(new THREE.PlaneGeometry(1.2,0.9),glow(0xe5ad62,0.16).clone());
  gateGlow.position.set(0,0.62,z-1.01);g.add(gateGlow);
  const banners=[];
  for(const side of [-1,1]){
    const x=side*(map.halfW+1.25);
    add(g,cyl(0.53,0.65,2.45,9),stone,x,1.22,z);
    add(g,cyl(0.66,0.66,0.15,9),lightStone,x,2.47,z);
    add(g,cone(0.75,0.95,9),std(0x405765,{roughness:0.86}),x,3.02,z);
    add(g,cyl(0.04,0.04,0.7,5),timber,x,3.8,z);
    add(g,cone(0.1,0.25,6),ochre,x,4.2,z);
    const banner=new THREE.Mesh(new THREE.PlaneGeometry(0.46,0.62),tealCloth);
    banner.position.set(x+side*0.27,3.7,z);banner.castShadow=true;g.add(banner);banners.push(banner);
  }
  g.userData={gateGlow,banners,sigil,gate};
  return g;
}
function landscape(map){
  const g=new THREE.Group(),rand=rng(0x524959);
  const apron=add(g,new THREE.CircleGeometry(95,56),std(0x45583c,{roughness:1}),0,-0.83,0);
  apron.rotation.x=-Math.PI/2;apron.castShadow=false;apron.receiveShadow=true;
  // Estradas de acesso dão continuidade ao corredor fora da área jogável.
  for(const side of [-1,1]){
    const z=side*(map.halfH+1.15);
    const road=add(g,box(2.7,0.025,2.45),std(0x75664d,{roughness:1}),0,-0.80,z);
    road.castShadow=false;
  }
  // Acampamento de campanha, fora das células: tendas e suprimentos contam a
  // história do cerco sem atrapalhar o traçado de caminhos.
  for(const side of [-1,1]){
    const x=side*(map.halfW+3.5),z=-map.halfH-2.5;
    add(g,box(1.55,0.08,1.35),timber,x,-0.72,z);
    const tent=add(g,cone(0.95,1.35,4),side<0?redCloth:tealCloth,x,0.07,z);
    tent.rotation.y=Math.PI/4;
    add(g,cyl(0.04,0.04,1.35,5),timber,x,0.02,z);
    for(let j=0;j<3;j++){
      const crate=add(g,box(0.35,0.31,0.35),j%2?timber:ochre,x+side*(0.95+j*0.18),-0.62+j*0.14,z+(j-1)*0.28);
      crate.rotation.y=(j-1)*0.19;
    }
    add(g,cyl(0.11,0.14,0.72,5),timber,x-side*1.23,-0.45,z+0.7).rotation.z=side*0.14;
  }

  const spots=[];
  while(spots.length<74){
    const a=rand()*Math.PI*2,rad=6.5+rand()*rand()*28;
    const x=Math.cos(a)*rad,z=Math.sin(a)*rad*0.86;
    if(Math.abs(x)<map.halfW+3.4&&Math.abs(z)<map.halfH+3.4)continue;
    spots.push({x,z,s:0.72+rand()*0.82,oak:rand()>0.55});
  }
  const dummy=new THREE.Object3D(),tint=new THREE.Color();
  const trunks=new THREE.InstancedMesh(cyl(0.10,0.17,1.12,6),timber,spots.length);
  const pines=new THREE.InstancedMesh(cone(0.67,1.4,7),std(0xffffff,{roughness:1}),spots.length);
  const lobes=new THREE.InstancedMesh(rock(0.64),std(0xffffff,{roughness:1}),spots.length*2);
  let l=0;
  for(let i=0;i<spots.length;i++){
    const s=spots[i];dummy.rotation.set(0,rand()*6,0);
    dummy.position.set(s.x,-0.83+0.56*s.s,s.z);dummy.scale.setScalar(s.s);dummy.updateMatrix();
    trunks.setMatrixAt(i,dummy.matrix);
    dummy.position.set(s.x,-0.83+1.67*s.s,s.z);
    dummy.scale.setScalar(s.oak?0:s.s);dummy.updateMatrix();pines.setMatrixAt(i,dummy.matrix);
    tint.setHex(rand()>0.35?0x46633f:0x617447).multiplyScalar(0.82+rand()*0.27);pines.setColorAt(i,tint);
    if(s.oak)for(let j=0;j<2;j++){
      dummy.position.set(s.x+(j?0.29:-0.27)*s.s,-0.83+(j?1.71:1.42)*s.s,s.z+(j?-0.18:0.21)*s.s);
      dummy.scale.set(0.87*s.s,0.67*s.s,0.83*s.s);dummy.updateMatrix();lobes.setMatrixAt(l,dummy.matrix);
      tint.setHex(j?0x6a7c48:0x405e3f).multiplyScalar(0.82+rand()*0.24);lobes.setColorAt(l++,tint);
    }
  }
  lobes.count=l;
  for(const m of [trunks,pines,lobes]){
    m.castShadow=true;m.instanceMatrix.needsUpdate=true;
    if(m.instanceColor)m.instanceColor.needsUpdate=true;g.add(m);
  }
  const stones=new THREE.InstancedMesh(rock(0.35),std(0xffffff,{roughness:1}),55);
  for(let i=0;i<55;i++){
    const a=rand()*Math.PI*2,rad=5.0+rand()*22;
    let x=Math.cos(a)*rad,z=Math.sin(a)*rad*0.9;
    if(Math.abs(x)<map.halfW+1.4&&Math.abs(z)<map.halfH+1.5)x+=Math.sign(x||1)*3;
    dummy.position.set(x,-0.65,z);dummy.rotation.set(rand()*2,rand()*3,rand()*2);
    dummy.scale.set(0.6+rand(),0.3+rand()*0.5,0.6+rand());dummy.updateMatrix();stones.setMatrixAt(i,dummy.matrix);
    tint.setHex(rand()>0.5?0x9ca18e:0x5b6a64);stones.setColorAt(i,tint);
  }
  stones.castShadow=true;stones.instanceMatrix.needsUpdate=true;stones.instanceColor.needsUpdate=true;g.add(stones);
  return g;
}
export function createEnvironment(scene,map){
  const g=new THREE.Group(),portal=invasionGate(map),keep=defendedKeep(map);
  g.add(landscape(map),battlements(map),portal,keep);scene.add(g);
  return {group:g,update(t){
    for(const f of portal.userData.flames){
      const pulse=0.86+Math.sin(t*9+f.side)*0.13+Math.sin(t*17+f.side)*0.05;
      f.fire.scale.y=pulse;f.light.intensity=2.8+pulse*1.5;
    }
    portal.userData.veil.material.opacity=0.24+Math.sin(t*1.4)*0.055;
    portal.userData.rune.rotation.y=t*0.35;
    keep.userData.gateGlow.material.opacity=0.14+Math.sin(t*2)*0.035;
    for(let i=0;i<keep.userData.banners.length;i++)
      keep.userData.banners[i].rotation.y=Math.sin(t*1.5+i)*0.18;
  }};
}

export function createIndicators(scene){
  const g=new THREE.Group();
  const hover=new THREE.Mesh(new THREE.PlaneGeometry(0.94,0.94),glow(0xffffff,0.2).clone());
  hover.rotation.x=-Math.PI/2;hover.position.y=0.04;hover.visible=false;g.add(hover);
  const edge=new THREE.Mesh(new THREE.RingGeometry(0.61,0.66,4),glow(0xffffff,0.55).clone());
  edge.rotation.x=-Math.PI/2;edge.rotation.z=Math.PI/4;edge.position.y=0.045;edge.visible=false;g.add(edge);
  const range=new THREE.Mesh(new THREE.RingGeometry(0.975,1,64),glow(0xe8d7a9,0.43).clone());
  range.rotation.x=-Math.PI/2;range.position.y=0.032;range.visible=false;g.add(range);
  const rangeFill=new THREE.Mesh(new THREE.CircleGeometry(1,48),glow(0xe8d7a9,0.05).clone());
  rangeFill.rotation.x=-Math.PI/2;rangeFill.position.y=0.025;rangeFill.visible=false;g.add(rangeFill);
  const selection=new THREE.Mesh(new THREE.RingGeometry(0.42,0.49,8),glow(0xefc77b,0.75).clone());
  selection.rotation.x=-Math.PI/2;selection.position.y=0.05;selection.visible=false;g.add(selection);
  scene.add(g);
  return {group:g,update(hoverInfo,rangeInfo,selInfo,t){
    if(hoverInfo){
      const color=hoverInfo.valid?0xbdd187:0xd46b55,dim=hoverInfo.dim?0.35:1;
      hover.visible=edge.visible=true;
      hover.position.set(hoverInfo.x,0.04,hoverInfo.z);
      edge.position.set(hoverInfo.x,0.045,hoverInfo.z);
      hover.material.color.setHex(color);edge.material.color.setHex(color);
      hover.material.opacity=(0.12+Math.sin(t*5)*0.04)*dim;
      edge.material.opacity=(0.43+Math.sin(t*5)*0.10)*dim;
    }else hover.visible=edge.visible=false;
    if(rangeInfo){
      range.visible=rangeFill.visible=true;
      range.position.set(rangeInfo.x,0.032,rangeInfo.z);
      rangeFill.position.set(rangeInfo.x,0.025,rangeInfo.z);
      range.scale.setScalar(rangeInfo.radius);
      rangeFill.scale.setScalar(rangeInfo.radius);
      range.material.color.setHex(rangeInfo.color);
      rangeFill.material.color.setHex(rangeInfo.color);
      range.material.opacity=0.32+Math.sin(t*3)*0.05;
    }else range.visible=rangeFill.visible=false;
    if(selInfo){
      selection.visible=true;selection.position.set(selInfo.x,0.05,selInfo.z);
      selection.rotation.z=t*0.27;
    }else selection.visible=false;
  }};
}
