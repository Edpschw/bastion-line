// Cerco ao Vale — campo e arquitetura de cenário originais.
// A malha de células continua exata para a lógica, mas a superfície lê como
// um terreno único, com divisas gravadas em vez de um tabuleiro de cubos.
import {THREE,geo,std,glow,mesh,rng} from './core.js?v=siege-art-6';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';

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

// Mesma cor da névoa em mount(); o HORIZON antigo do core fica intocado.
const VALLEY_HORIZON=0xbfbea2;
export function createSky(){
  const sky=new THREE.Mesh(
    new THREE.SphereGeometry(120,32,16),
    new THREE.ShaderMaterial({
      side:THREE.BackSide,depthWrite:false,fog:false,
      uniforms:{
        topColor:{value:new THREE.Color(0x527d91)},
        midColor:{value:new THREE.Color(VALLEY_HORIZON)},
        botColor:{value:new THREE.Color(0xe9bd85)},
        sunDirection:{value:new THREE.Vector3(-0.48,0.36,-0.8).normalize()}
      },
      vertexShader:'varying vec3 p; void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`
        uniform vec3 topColor,midColor,botColor,sunDirection;
        varying vec3 p;
        void main(){
          vec3 d=normalize(p);float h=d.y;
          vec3 c=mix(midColor,botColor,(1.-smoothstep(-.3,0.,h)));
          c=mix(c,topColor,smoothstep(.06,.85,h));
          float sun=max(0.,dot(d,sunDirection));
          c+=vec3(.32,.18,.055)*pow(sun,18.);
          c=mix(c,vec3(1.,.88,.61),smoothstep(.9991,.9997,sun));
          gl_FragColor=vec4(c,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    })
  );
  sky.frustumCulled=false;
  return sky;
}

export function createLights(scene,map){
  const hemi=new THREE.HemisphereLight(0xb9d6e5,0x62523c,1.05);scene.add(hemi);
  const key=new THREE.DirectionalLight(0xffd29a,2.65);
  key.position.set(-10,16,-9);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);
  key.shadow.bias=-0.00025;key.shadow.normalBias=0.035;key.shadow.radius=2;
  const c=key.shadow.camera;
  // Enquadra no espaço da luz o portal, o bastião e os atores elevados.
  // Limites no eixo do mundo desperdiçam texels de sombra com o sol na diagonal.
  scene.add(key,key.target);
  c.position.copy(key.position);c.lookAt(0,0,0);c.updateMatrixWorld(true);
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;
  const corner=new THREE.Vector3();
  for(const x of [-map.halfW-1.9,map.halfW+1.9])
    for(const z of [-map.halfH-3,map.halfH+2.4])
      for(const y of [-0.9,4.6]){
        corner.set(x,y,z).applyMatrix4(c.matrixWorldInverse);
        minX=Math.min(minX,corner.x);maxX=Math.max(maxX,corner.x);
        minY=Math.min(minY,corner.y);maxY=Math.max(maxY,corner.y);
        minZ=Math.min(minZ,-corner.z);maxZ=Math.max(maxZ,-corner.z);
      }
  c.left=minX-0.5;c.right=maxX+0.5;c.bottom=minY-0.5;c.top=maxY+0.5;
  c.near=Math.max(0.1,minZ-2);c.far=maxZ+2;c.updateProjectionMatrix();
  const fill=new THREE.DirectionalLight(0x91b9dc,0.48);
  fill.position.set(8,8,-8);scene.add(fill);
  return {hemi,key,fill};
}

// Texturas compartilhadas; o mapa pode fornecer renderer ou textureAnisotropy.
let terrainTextures;
function loadTerrainTextures(map){
  const limit=map.renderer?.capabilities?.getMaxAnisotropy?.();
  const anisotropy=Math.max(1,Math.min(limit||8,map.textureAnisotropy||limit||4));
  if(!terrainTextures){
    const loader=new THREE.TextureLoader();terrainTextures={};
    for(const name of ['grass','grass_dark','dirt','cobble','rock']){
      const texture=loader.load(new URL(`../../assets/terrain/${name}.jpg`,import.meta.url).href);
      texture.colorSpace=THREE.SRGBColorSpace;
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
      texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;
      texture.magFilter=THREE.LinearFilter;terrainTextures[name]=texture;
    }
  }
  for(const texture of Object.values(terrainTextures)){
    if(texture.anisotropy!==anisotropy){texture.anisotropy=anisotropy;texture.needsUpdate=true;}
  }
  return terrainTextures;
}

// Troca apenas o albedo: iluminação, sombras e névoa seguem o material padrão.
function terrainMaterial(map,board=false){
  const textures=loadTerrainTextures(map);
  const material=new THREE.MeshStandardMaterial({roughness:1});
  material.customProgramCacheKey=()=>board?'valley-board-terrain-v2':'valley-outside-terrain-v2';
  material.onBeforeCompile=shader=>{
    for(const name of ['grass','grass_dark','dirt','cobble','rock'])
      shader.uniforms['terrain_'+name]={value:textures[name]};
    shader.uniforms.terrainHalfSize={value:new THREE.Vector2(map.halfW,map.halfH)};
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
      varying vec3 terrainPosition;`).replace('#include <begin_vertex>',`#include <begin_vertex>
      terrainPosition=(modelMatrix*vec4(position,1.0)).xyz;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 terrainPosition;
      uniform sampler2D terrain_grass,terrain_grass_dark,terrain_dirt,terrain_cobble,terrain_rock;
      uniform vec2 terrainHalfSize;
      // Duas escalas, a segunda girada: quebra a simetria de espelho das
      // texturas (que foram tornadas contínuas por espelhamento).
      vec3 terrainSample(sampler2D t,vec2 p,float s){
        vec2 q=mat2(0.8,-0.6,0.6,0.8)*p;
        return mix(texture2D(t,p/s).rgb,texture2D(t,q/(s*2.3)+0.37).rgb,0.42);
      }
      // Satura menos e puxa para um tom: a pintura é viva, mas o grading do
      // postfx ainda soma saturação por cima.
      vec3 terrainGrade(vec3 c,float sat,vec3 tint){
        float l=dot(c,vec3(0.299,0.587,0.114));
        return mix(vec3(l),c,sat)*tint;
      }`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',board?`
      vec2 p=terrainPosition.xz;
      vec2 cell=p+terrainHalfSize;
      float variation=sin(p.y*2.1+sin(p.x*3.0))*0.10;
      float grassWeight=1.0-smoothstep(0.10,0.78+variation,terrainHalfSize.x-abs(p.x));
      vec3 dirt=terrainGrade(terrainSample(terrain_dirt,p,3.0),0.5,vec3(1.0,0.9,0.78));
      vec3 grass=terrainGrade(terrainSample(terrain_grass,p,3.5),0.72,vec3(0.9,1.0,0.82));
      vec3 terrainColor=mix(dirt,grass,grassWeight*0.72);
      float paving=1.0-smoothstep(0.94,1.04,terrainHalfSize.y-abs(p.y));
      terrainColor=mix(terrainColor,terrainGrade(terrainSample(terrain_cobble,p,2.0),0.6,vec3(0.98,0.96,0.92)),paving);
      // Grade de construção: linha fina escura e um leve brilho no miolo da
      // casa, para o jogador ler as células sem um quadriculado gritante.
      vec2 f=fract(cell);
      vec2 edge=min(f,1.0-f);
      vec2 aa=max(fwidth(cell),vec2(0.001));
      vec2 line=1.0-smoothstep(vec2(0.018),vec2(0.018)+aa*1.5,edge);
      float center=1.0-smoothstep(0.18,0.5,max(abs(f.x-0.5),abs(f.y-0.5)));
      terrainColor*=(1.0-0.3*max(line.x,line.y))*(1.0+0.05*center*(1.0-paving));
      diffuseColor.rgb*=terrainColor;`:`
      vec2 p=terrainPosition.xz;
      float forest=smoothstep(-0.35,0.55,sin(p.x*0.24+sin(p.y*0.19))*cos(p.y*0.21));
      float stoneWeight=smoothstep(0.48,0.88,sin(p.x*0.31-p.y*0.17)*cos(p.y*0.23));
      float clearance=length(max(abs(p)-terrainHalfSize-vec2(2.0),vec2(0.0)));
      stoneWeight*=smoothstep(2.0,7.0,clearance)*0.65;
      vec3 terrainColor=mix(terrainGrade(terrainSample(terrain_grass,p,4.0),0.7,vec3(0.88,1.0,0.8)),
        terrainGrade(terrainSample(terrain_grass_dark,p,4.0),0.75,vec3(0.9,1.0,0.86)),forest*0.82);
      terrainColor=mix(terrainColor,terrainGrade(terrainSample(terrain_rock,p,3.5),0.7,vec3(1.0)),stoneWeight);
      diffuseColor.rgb*=terrainColor;`);
  };
  return material;
}
export function createBoard(scene,map){
  const g=new THREE.Group();
  const soil=add(g,box(map.COLS+0.18,0.72,map.ROWS+0.18),std(0x5b4b3d,{roughness:1}),0,-0.42,0);
  soil.castShadow=false;
  add(g,box(map.COLS+0.06,0.11,map.ROWS+0.06),darkStone,0,-0.095,0).castShadow=false;
  // Uma superfície plana mantém as células e os indicadores na altura original.
  const surfaceGeo=new THREE.PlaneGeometry(map.COLS,map.ROWS);
  surfaceGeo.rotateX(-Math.PI/2);
  const surface=add(g,surfaceGeo,terrainMaterial(map,true),0,-0.018,0);
  surface.receiveShadow=true;surface.castShadow=false;
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
// Coleções exportadas em centímetros/Z-up e com deslocamentos de catálogo:
// assa as matrizes originais e recentra cada variante separadamente na base.
let natureAssets;
function loadNatureAssets(){
  if(!natureAssets){
    const loader=new GLTFLoader();
    const specs=[
      ['Pine_A','tree'],['Pine_B','tree'],['Pine_C','tree'],['Tree_A','tree'],
      ['Dead_Tree','dead'],
      ['Bush_A','bush'],['Bush_Berries','bush'],['Bush_Flowers','bush'],['Bushes','bush',2],
      ['Rock_A','rock'],['Rocks_A','rock'],['Rocks_B','rock',3],
      ['Flowers','flower',3],['Grass','grass'],['Stump_Moss','stump'],['Mushroom','mushroom']
    ];
    // Falhas isoladas preservam as outras famílias e permitem nova tentativa.
    natureAssets=Promise.all(specs.map(async ([name,kind,limit=Infinity])=>{
      try{
        const gltf=await loader.loadAsync(new URL(`../../assets/nature/${name}.glb`,import.meta.url).href);
        gltf.scene.updateMatrixWorld(true);
        const root=gltf.scene.children[0];
        const roots=root?.isMesh?[root]:(root?.children.length?root.children:gltf.scene.children);
        return roots.slice(0,limit).map(variant=>{
          const bounds=new THREE.Box3().setFromObject(variant);
          const center=bounds.getCenter(new THREE.Vector3());
          const height=Math.max(0.001,bounds.max.y-bounds.min.y);
          const normalize=new THREE.Matrix4().makeScale(1/height,1/height,1/height)
            .multiply(new THREE.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z));
          const parts=[];
          variant.traverse(node=>{
            if(!node.isMesh)return;
            const geometry=node.geometry.clone().applyMatrix4(normalize.clone().multiply(node.matrixWorld));
            const materials=Array.isArray(node.material)?node.material:[node.material];
            // O GLTFLoader separa primitivas em filhos; grupos também são aceitos.
            for(let i=0;i<materials.length;i++){
              const part=geometry.clone();
              if(materials.length>1){
                const group=geometry.groups.find(group=>group.materialIndex===i);
                if(!group){part.dispose();continue;}
                part.clearGroups();part.setDrawRange(group.start,group.count);
              }
              const material=materials[i].clone();
              material.metalness=0;material.roughness=Math.max(0.85,material.roughness);
              if(material.transparent||/leaves|flowers|grass/i.test(material.name)){
                material.transparent=false;material.opacity=1;material.alphaTest=0.5;
                material.side=THREE.DoubleSide;material.depthWrite=true;
              }
              // Os mapas sRGB/normal permanecem como configurados pelo GLTFLoader.
              parts.push({geometry:part,material});
            }
            geometry.dispose();
          });
          const radius=Math.hypot(bounds.max.x-bounds.min.x,bounds.max.z-bounds.min.z)/(2*height);
          return {kind,parts,radius};
        });
      }catch(error){console.warn(`Cenário: falha ao carregar ${name}`,error);return [];}
    })).then(results=>{natureAssets=null;return results.flat();});
  }
  return natureAssets;
}
function populateNature(group,map){
  // Todas as escolhas acontecem depois de Promise.all, em ordem fixa: a rede
  // nunca muda a sequência do RNG nem a distribuição das instâncias.
  loadNatureAssets().then(assets=>{
    const rand=rng(0x524959),dummy=new THREE.Object3D(),tint=new THREE.Color();
    const families={};
    for(const asset of assets)(families[asset.kind]??=[]).push({...asset,spots:[]});
    const groundY=(x,z)=>{
      const dx=Math.max(0,Math.abs(x)-map.halfW-3),dz=Math.max(0,Math.abs(z)-map.halfH-3);
      const t=Math.min(1,Math.hypot(dx,dz)/5);
      return -0.83+t*t*(3-2*t)*(0.28*Math.sin(x*0.22)*Math.cos(z*0.18)+0.14*Math.sin(x*0.11+z*0.16)+0.12);
    };
    function place(kind,x,z,height){
      const options=families[kind];if(!options?.length)return;
      const asset=options[Math.floor(rand()*options.length)],radius=asset.radius*height;
      // Margem considera a copa inteira, não apenas o tronco/pivô.
      if(Math.abs(x)-radius<map.halfW+0.8&&Math.abs(z)-radius<map.halfH+2.1)return;
      if((kind==='tree'||kind==='dead')&&z+radius>map.halfH-2)return;
      // Corredor central, tendas, cercas e bandeiras continuam livres.
      if(Math.abs(x)-radius<3.2&&Math.abs(z)>map.halfH)return;
      for(const side of [-1,1]){
        if(Math.abs(x-side*(map.halfW+3.5))<radius+1.4&&Math.abs(z+map.halfH+2.5)<radius+1.4)return;
        if(Math.abs(x-side*(map.halfW+2.8))<radius+0.18&&z>-map.halfH-5-radius&&z< -map.halfH+8.5+radius)return;
        if(Math.abs(x-side*(map.halfW+0.95))<radius+0.6&&z>-map.halfH&&z<map.halfH)return;
      }
      asset.spots.push({x,z,height,yaw:rand()*Math.PI*2,tone:0.88+rand()*0.2});
    }
    // Flancos: núcleos densos afastados do muro e da câmera; fundo: arco
    // interrompido no eixo do portal para manter a leitura da invasão.
    for(let i=0;i<210;i++){
      const side=i%2?-1:1,cluster=Math.floor(i/30);
      const x=side*(map.halfW+6+(cluster%3)*3.2)+(rand()-0.5)*5;
      const z=-map.halfH-5+(cluster%4)*3+(rand()-0.5)*4;
      place('tree',x,z,2+rand()*2);
    }
    for(let i=0;i<55;i++)place('tree',(rand()-0.5)*32,-map.halfH-7-rand()*6,2.6+rand()*1.4);
    for(let i=0;i<6;i++)place('dead',(i%2?-1:1)*(4.5+rand()*2),-map.halfH-3.8-rand()*2,2.4+rand()*1.3);
    // Pedras achatadas crescem na largura ao normalizar pela altura: faixa baixa.
    for(const [kind,count,min,max] of [['rock',68,0.22,0.75],['stump',26,0.3,0.65],
      ['bush',160,0.4,0.8],['flower',150,0.15,0.35],['grass',240,0.15,0.35],['mushroom',35,0.15,0.28]]){
      for(let i=0;i<count;i++){
        const side=i%2?-1:1,edge=i%3!==0;
        const x=side*(map.halfW+(edge?1.6+rand()*5:6+rand()*12));
        const z=-map.halfH-6+rand()*(map.ROWS+9);
        place(kind,x,z,min+rand()*(max-min));
      }
    }
    for(const options of Object.values(families))for(const asset of options){
      if(!asset.spots.length)continue;
      for(const part of asset.parts){
        const instances=new THREE.InstancedMesh(part.geometry,part.material,asset.spots.length);
        instances.name=`nature:${asset.kind}`;
        instances.castShadow=['tree','dead','rock','stump','bush'].includes(asset.kind);
        instances.receiveShadow=true;
        asset.spots.forEach((spot,i)=>{
          dummy.position.set(spot.x,groundY(spot.x,spot.z),spot.z);
          dummy.rotation.set(0,spot.yaw,0);dummy.scale.setScalar(spot.height);dummy.updateMatrix();
          instances.setMatrixAt(i,dummy.matrix);
          tint.setRGB(spot.tone,spot.tone,spot.tone*0.98);instances.setColorAt(i,tint);
        });
        instances.instanceMatrix.needsUpdate=true;instances.instanceColor.needsUpdate=true;
        instances.computeBoundingBox();instances.computeBoundingSphere();group.add(instances);
      }
    }
  }).catch(error=>console.warn('Cenário: falha ao preparar instâncias',error));
}

function landscape(map){
  const g=new THREE.Group();
  const terrain=new THREE.PlaneGeometry(180,180,180,180);terrain.rotateX(-Math.PI/2);
  const terrainPos=terrain.attributes.position;
  for(let i=0;i<terrainPos.count;i++){
    const x=terrainPos.getX(i),z=terrainPos.getZ(i);
    // Faixa plana de três células: nenhum relevo invade o tabuleiro ou os muros.
    const dx=Math.max(0,Math.abs(x)-map.halfW-3),dz=Math.max(0,Math.abs(z)-map.halfH-3);
    const t=Math.min(1,Math.hypot(dx,dz)/5),fade=t*t*(3-2*t);
    terrainPos.setY(i,fade*(0.28*Math.sin(x*0.22)*Math.cos(z*0.18)+0.14*Math.sin(x*0.11+z*0.16)+0.12));
  }
  terrain.computeVertexNormals();
  const apron=add(g,terrain,terrainMaterial(map),0,-0.83,0);
  apron.castShadow=false;apron.receiveShadow=true;
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

  // O carregamento não bloqueia o terreno nem a arquitetura do cerco.
  populateNature(g,map);
  const dummy=new THREE.Object3D();

  // Duas cordilheiras facetadas somem no horizonte quente (duas draw calls).
  for(let layer=0;layer<2;layer++){
    const vertices=[],ridgeRand=rng(0x9912+layer),z=-38-layer*18;
    for(let i=0;i<24;i++){
      const x=-65+i*5.5,h=3+ridgeRand()*8;
      vertices.push(x,-0.85,z,x+2.75,h,z-2,x+5.5,-0.85,z);
    }
    const ridge=new THREE.BufferGeometry();ridge.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));ridge.computeVertexNormals();
    const mountains=add(g,ridge,new THREE.MeshBasicMaterial({color:layer?0x9daaa5:0x7f9792,side:THREE.DoubleSide}),0,0,0);
    mountains.castShadow=false;
  }
  // Estacas e travessas delimitam os suprimentos ao lado do acampamento.
  const fence=new THREE.InstancedMesh(box(0.08,0.7,0.08),timber,32);
  const rails=new THREE.InstancedMesh(box(0.07,0.07,0.95),timber,28);
  let rail=0;
  for(let i=0;i<32;i++){
    const side=i<16?-1:1,j=i%16;
    dummy.position.set(side*(map.halfW+2.8),-0.48,-map.halfH-5+j*0.9);
    dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();fence.setMatrixAt(i,dummy.matrix);
    if(j<14){dummy.position.y=-0.28;dummy.position.z+=0.45;dummy.updateMatrix();rails.setMatrixAt(rail++,dummy.matrix);}
  }
  for(const m of [fence,rails]){m.instanceMatrix.needsUpdate=true;m.castShadow=true;g.add(m);}
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
