// Arquitetura original das oito torres. Todas cabem numa célula, preservam a
// altura de leitura da câmera RTS e compartilham geometrias e materiais.
import { THREE, geo, std, glow, mesh, shade } from './core.js?v=campaign-art-1';

const box = (w,h,d) => geo(`arch-box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w,h,d));
const cyl = (top,bottom,h,n=8) => geo(`arch-cyl:${top}:${bottom}:${h}:${n}`, () => new THREE.CylinderGeometry(top,bottom,h,n));
const cone = (r,h,n=6) => geo(`arch-cone:${r}:${h}:${n}`, () => new THREE.ConeGeometry(r,h,n));
const oct = r => geo(`arch-oct:${r}`, () => new THREE.OctahedronGeometry(r));
const ring = (r,t=0.018) => geo(`arch-ring:${r}:${t}`, () => new THREE.TorusGeometry(r,t,5,24));

const stone = std(0x4a5152,{roughness:0.95});
const stoneEdge = std(0x858779,{roughness:0.9});
const shadowStone = std(0x2c353b,{roughness:0.94});
const iron = std(0x64717a,{metalness:0.55,roughness:0.48});
const wood = std(0x66503a,{roughness:0.97});
const paleWood = std(0x9a7950,{roughness:0.88});
const bone = std(0xc7c2a5,{roughness:0.92});

function add(g,geometry,material,x,y,z){const m=mesh(geometry,material,x,y,z);g.add(m);return m;}
function luminous(color,intensity=0.48){return std(color,{emissive:color,emissiveIntensity:intensity,roughness:0.32,metalness:0.15});}
function outline(g,y,color,r=0.36){
  const m=new THREE.Mesh(ring(r,0.018),luminous(color,0.28));
  m.rotation.x=Math.PI/2;m.position.y=y;m.castShadow=false;g.add(m);
}
function base(g,material=stone){
  add(g,box(0.72,0.1,0.72),shadowStone,0,0.04,0);
  add(g,box(0.62,0.07,0.62),material,0,0.125,0);
  for(const s of [-1,1]){
    add(g,box(0.12,0.04,0.75),stoneEdge,s*0.3,0.09,0);
  }
}
function crest(g,color,y,z=0.365,size=0.11){
  add(g,oct(size),luminous(color,0.35),0,y,z);
}
function fourCorners(g,r,y,h,material,shape='box'){
  for(const x of [-r,r])for(const z of [-r,r])
    add(g,shape==='cone'?cone(0.075,h,5):box(0.095,h,0.095),material,x,y,z);
}

export function buildTowerArchitecture(type,tier,branch,color){
  const g=new THREE.Group();
  const accent=luminous(color,tier>=4?0.65:0.32);
  const darkAccent=std(shade(color,0.58),{roughness:0.72,metalness:0.22});
  const bright=std(shade(color,1.25),{emissive:color,emissiveIntensity:tier>=5?0.8:0.35,roughness:0.35});
  const tierHeight=Math.min(0.28,(tier-1)*0.07);
  let top=0.8+tierHeight;
  let lastBase=top;

  if(type==='trap'){
    // Placa de pressão sempre rente ao solo: não parece uma parede do labirinto.
    add(g,cyl(0.4,0.44,0.08,8),stoneEdge,0,0.04,0);
    add(g,cyl(0.32,0.36,0.06,8),iron,0,0.10,0);
    add(g,cyl(0.24,0.24,0.025,8),darkAccent,0,0.15,0);
    if(tier>=2)outline(g,0.16,color,0.32);
    if(tier>=3)for(let i=0;i<8;i++){
      const a=i*Math.PI/4;
      add(g,cone(0.045,tier>=5?0.20:0.12,4),i%2?accent:iron,Math.cos(a)*0.33,0.18,Math.sin(a)*0.33);
    }
    top=lastBase=0;
  }else if(type==='militia'){
    // Guarnição quadrada, canto blindado e ameias de fortaleza.
    base(g);
    add(g,box(0.52,top-0.16,0.52),stone,0,top/2+0.08,0);
    add(g,box(0.62,0.10,0.62),stoneEdge,0,top-0.06,0);
    fourCorners(g,0.265,top+0.04,0.20,tier>=3?iron:stoneEdge);
    add(g,box(0.31,0.28,0.055),branch==='guerreiro'?darkAccent:iron,0,top*0.55,0.295);
    if(tier>=2){crest(g,color,top*0.57,0.335);outline(g,top-0.015,color,0.32);}
    if(tier>=4)fourCorners(g,0.25,top+0.18,0.24,accent,'cone');
  }else if(type==='archer'){
    // Mirante de madeira aberto: vigas, travessas e plataforma de disparo.
    base(g,wood);
    add(g,box(0.45,0.07,0.45),wood,0,0.44,0);
    fourCorners(g,0.25,top/2,top-0.1,paleWood);
    for(const s of [-1,1]){
      const brace=add(g,box(0.055,top*0.65,0.055),iron,s*0.18,top*0.5,0.27);
      brace.rotation.z=s*0.35;
    }
    add(g,box(0.72,0.11,0.72),wood,0,top-0.055,0);
    for(const s of [-1,1]){
      add(g,box(0.08,0.22,0.08),tier>=3?accent:paleWood,s*0.31,top+0.06,-0.31);
      add(g,box(0.08,0.22,0.08),tier>=3?accent:paleWood,s*0.31,top+0.06,0.31);
    }
    if(tier>=2)outline(g,top-0.06,color,0.36);
    if(branch==='francoatiradora' && tier>=3){
      add(g,box(0.12,0.1,0.54),iron,0,top+0.12,0.15);
      add(g,box(0.48,0.06,0.07),accent,0,top+0.13,0.36);
    }
  }else if(type==='mage'){
    // Obelisco hexagonal escuro com frisos e foco mágico suspenso.
    base(g,shadowStone);
    add(g,cyl(0.27,0.35,top-0.12,6),shadowStone,0,top/2+0.08,0);
    add(g,cyl(0.34,0.34,0.07,6),iron,0,top-0.055,0);
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3;
      add(g,box(0.035,top*0.52,0.03),i%2?darkAccent:accent,Math.cos(a)*0.28,top*0.5,Math.sin(a)*0.28);
    }
    if(tier>=2){outline(g,top-0.05,color,0.32);crest(g,color,top*0.55,0.33);}
    if(tier>=4)for(let i=0;i<3;i++){
      const a=i*Math.PI*2/3;
      add(g,oct(0.11),bright,Math.cos(a)*0.26,top+0.16,Math.sin(a)*0.26);
    }
  }else if(type==='frost'){
    // Bastilha circular de gelo: cúpula facetada, pontas cristalinas.
    base(g,stoneEdge);
    add(g,cyl(0.29,0.34,top-0.12,10),stone,0,top/2+0.08,0);
    add(g,cyl(0.35,0.35,0.08,10),stoneEdge,0,top-0.045,0);
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3;
      add(g,cone(0.065,tier>=4?0.32:0.20,5),i%2?bright:accent,Math.cos(a)*0.29,top+0.08,Math.sin(a)*0.29);
    }
    if(tier>=2)outline(g,top-0.08,color,0.34);
    if(branch==='cristalina' && tier>=3){
      for(const s of [-1,1])add(g,oct(0.16),bright,s*0.22,top+0.29,0);
    }
  }else if(type==='lightning'){
    // Dínamo blindado: aros de cobre e eletrodos acima do metal.
    base(g,iron);
    add(g,cyl(0.29,0.34,top-0.12,8),iron,0,top/2+0.08,0);
    for(let i=0;i<(tier>=4?4:3);i++){
      const y=0.27+i*(top-0.31)/(tier>=4?3:2);
      outline(g,y,i%2?color:0xd39b56,0.32);
    }
    add(g,cyl(0.34,0.34,0.08,8),shadowStone,0,top-0.04,0);
    for(const s of [-1,1]){
      add(g,cyl(0.035,0.045,0.38,6),iron,s*0.22,top+0.13,0);
      add(g,oct(0.075),bright,s*0.22,top+0.34,0);
    }
    if(branch==='canhao' && tier>=3){
      const barrel=add(g,cyl(0.09,0.12,0.38,8),shadowStone,0,top+0.1,0.24);
      barrel.rotation.x=Math.PI/2;
    }
  }else if(type==='nature'){
    // Raízes dentro de um círculo rúnico e tronco orgânico em vez de pedra.
    base(g,wood);
    add(g,cyl(0.17,0.3,top-0.10,7),wood,0,top/2+0.07,0);
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3;
      const root=add(g,cyl(0.035,0.075,0.44,5),paleWood,Math.cos(a)*0.22,0.29,Math.sin(a)*0.22);
      root.rotation.z=-Math.cos(a)*0.44;root.rotation.x=Math.sin(a)*0.44;
    }
    add(g,cyl(0.28,0.20,0.13,7),darkAccent,0,top-0.07,0);
    if(tier>=2)outline(g,0.17,color,0.35);
    if(tier>=4)for(let i=0;i<4;i++){
      const a=i*Math.PI/2;
      add(g,cone(0.095,0.30,5),branch==='praga'?accent:bright,Math.cos(a)*0.24,top+0.12,Math.sin(a)*0.24);
    }
  }else if(type==='necro'){
    // Mausoléu de basalto e osso, com quatro pináculos funerários.
    base(g,shadowStone);
    add(g,box(0.48,top-0.12,0.48),shadowStone,0,top/2+0.07,0);
    for(const s of [-1,1]){
      add(g,box(0.065,top*0.63,0.04),bone,s*0.19,top*0.48,0.265);
      add(g,oct(0.075),accent,s*0.19,top*0.73,0.29);
    }
    add(g,box(0.6,0.08,0.6),iron,0,top-0.05,0);
    fourCorners(g,0.26,top+0.13,0.28,bone,'cone');
    if(tier>=2)outline(g,top-0.06,color,0.32);
    if(tier>=4)crest(g,color,top*0.52,0.28,0.15);
  }
  if(type!=='trap' && tier>=5){
    // Pequeno pináculo de vitória; a arma/ocupante do ramo ainda domina a forma.
    const halo=new THREE.Mesh(ring(0.39,0.014),glow(color,0.42));
    halo.rotation.x=Math.PI/2;halo.position.y=top+0.02;halo.castShadow=false;g.add(halo);
  }
  return {group:g,top,lastBase};
}
