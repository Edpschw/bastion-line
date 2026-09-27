// Cerco ao Vale: oito arquiteturas originais, legíveis na câmera RTS.
// A matéria constrói a silhueta; a cor do ramo marca apenas focos e estandartes.
import { THREE, geo, std, glow, mesh, shade } from './core.js?v=siege-art-4';

const box=(w,h,d)=>geo(`siege-box:${w}:${h}:${d}`,()=>new THREE.BoxGeometry(w,h,d));
const cyl=(a,b,h,n=8)=>geo(`siege-cyl:${a}:${b}:${h}:${n}`,()=>new THREE.CylinderGeometry(a,b,h,n));
const cone=(r,h,n=6)=>geo(`siege-cone:${r}:${h}:${n}`,()=>new THREE.ConeGeometry(r,h,n));
const oct=r=>geo(`siege-oct:${r}`,()=>new THREE.OctahedronGeometry(r));
const ring=r=>geo(`siege-ring:${r}`,()=>new THREE.TorusGeometry(r,0.018,5,20));
const limestone=std(0xa7a68e,{roughness:0.97});
const paleStone=std(0xd0c4a2,{roughness:0.94});
const slate=std(0x39484b,{roughness:0.92});
const darkSlate=std(0x253238,{roughness:0.96});
const timber=std(0x61442f,{roughness:0.98});
const timberEdge=std(0x9a7045,{roughness:0.9});
const bronze=std(0xa77a43,{metalness:0.48,roughness:0.5});
const steel=std(0x778385,{metalness:0.48,roughness:0.55});
const bone=std(0xd1c9a8,{roughness:0.94});

function add(g,shape,material,x,y,z){const p=mesh(shape,material,x,y,z);g.add(p);return p;}
function lit(color,power=0.36){return std(color,{emissive:color,emissiveIntensity:power,roughness:0.42});}
function beam(g,a,b,r,material){
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),dir=end.clone().sub(start);
  const middle=start.clone().add(end).multiplyScalar(0.5);
  const p=add(g,cyl(r,r,dir.length(),5),material,middle.x,middle.y,middle.z);
  p.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());
  return p;
}
function rim(g,y,color,r=0.35){
  const p=new THREE.Mesh(ring(r),glow(color,0.42));
  p.rotation.x=Math.PI/2;p.position.y=y;p.castShadow=false;g.add(p);
}
function foot(g,material=limestone){
  add(g,box(0.84,0.08,0.84),darkSlate,0,0.035,0);
  add(g,box(0.75,0.11,0.75),material,0,0.105,0);
  for(const s of [-1,1])add(g,box(0.76,0.025,0.035),paleStone,0,0.165,s*0.35);
}
function banner(g,color,y,z=0.36){
  const cloth=std(shade(color,0.68),{roughness:0.93,side:THREE.DoubleSide});
  add(g,box(0.20,0.31,0.018),cloth,0,y,z);
  add(g,cone(0.10,0.14,3),cloth,0,y-0.22,z).rotation.y=Math.PI/2;
  add(g,box(0.22,0.025,0.045),bronze,0,y+0.17,z);
  add(g,oct(0.052),lit(color,0.2),0,y+0.02,z+0.024);
}

export function buildTowerArchitecture(type,tier,branch,color){
  const g=new THREE.Group(),h=0.72+(tier-1)*0.085;
  const herald=std(shade(color,0.68),{roughness:0.83});
  const accent=lit(color,tier>=4?0.58:0.28);
  const bright=lit(shade(color,1.25),tier>=5?0.92:0.4);
  let top=h,lastBase=h;

  if(type==='militia'){
    foot(g);
    add(g,box(0.52,h-0.15,0.52),limestone,0,h*0.5+0.08,0);
    add(g,box(0.59,0.085,0.59),paleStone,0,h-0.035,0);
    for(const x of [-0.28,0.28])for(const z of [-0.28,0.28]){
      add(g,box(0.13,h*0.72,0.13),slate,x,h*0.36+0.13,z);
      add(g,box(0.14,0.19+(tier>=4?0.07:0),0.14),limestone,x,h+0.05,z);
      add(g,box(0.17,0.035,0.17),paleStone,x,h+0.16+(tier>=4?0.07:0),z);
    }
    banner(g,color,h*0.55,0.274);
    if(tier>=3)for(const s of [-1,1]){
      add(g,box(0.06,0.32,0.08),steel,s*0.33,h*0.62,0);
      add(g,cone(0.07,0.2,4),branch==='guerreiro'?accent:bronze,s*0.33,h*0.83,0);
    }
    if(tier>=5)add(g,box(0.32,0.16,0.05),branch==='guerreiro'?herald:bronze,0,h+0.12,-0.29);
  }else if(type==='archer'){
    foot(g,timber);
    for(const x of [-0.28,0.28])for(const z of [-0.28,0.28]){
      add(g,box(0.105,h-0.05,0.105),timberEdge,x,h*0.5+0.08,z);
      add(g,box(0.13,0.055,0.13),bronze,x,h+0.05,z);
    }
    for(const s of [-1,1]){
      beam(g,[s*0.28,0.2,-0.28],[s*0.28,h*0.75,0.28],0.026,timber);
      beam(g,[-0.28,0.2,s*0.28],[0.28,h*0.75,s*0.28],0.026,timber);
    }
    add(g,box(0.77,0.1,0.77),timber,0,h-0.02,0);
    add(g,box(0.68,0.025,0.68),paleStone,0,h+0.043,0);
    for(const x of [-0.32,0.32])for(const z of [-0.32,0.32])
      add(g,box(0.07,0.22,0.07),tier>=3?herald:timberEdge,x,h+0.15,z);
    if(tier>=2)banner(g,color,h*0.59,0.315);
    if(tier>=4){
      add(g,box(0.74,0.045,0.17),branch==='francoatiradora'?slate:herald,0,h+0.34,-0.27);
      for(const s of [-1,1])beam(g,[s*0.3,h+0.1,-0.28],[s*0.3,h+0.32,-0.28],0.024,timberEdge);
    }
  }else if(type==='mage'){
    foot(g,slate);
    add(g,cyl(0.26,0.36,h-0.1,6),slate,0,h*0.5+0.075,0);
    add(g,cyl(0.35,0.35,0.075,6),paleStone,0,h-0.045,0);
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3,x=Math.cos(a)*0.31,z=Math.sin(a)*0.31;
      add(g,box(0.075,h*0.48,0.05),i%2?bronze:herald,x,h*0.49,z).rotation.y=-a;
      if(tier>=3)add(g,oct(0.06),accent,x,h*0.82,z);
    }
    for(const s of [-1,1]){
      add(g,box(0.10,0.34,0.12),darkSlate,s*0.36,0.29,0);
      add(g,cone(0.09,0.24,4),branch==='piromante'?herald:steel,s*0.36,0.56,0);
    }
    if(tier>=2)rim(g,h-0.02,color,0.34);
    if(tier>=5)for(let i=0;i<3;i++){
      const a=i*Math.PI*2/3;add(g,oct(0.09),bright,Math.cos(a)*0.28,h+0.18,Math.sin(a)*0.28);
    }
  }else if(type==='frost'){
    foot(g,paleStone);
    add(g,cyl(0.31,0.37,h-0.1,10),limestone,0,h*0.5+0.08,0);
    add(g,cyl(0.36,0.36,0.07,10),slate,0,h-0.04,0);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4;
      add(g,cone(0.055,0.2+(tier>=4?0.1:0),5),i%2?bright:paleStone,Math.cos(a)*0.32,h+0.07,Math.sin(a)*0.32);
    }
    for(const s of [-1,1])add(g,oct(0.12),accent,s*0.33,0.32,0.12);
    if(tier>=2)rim(g,h-0.04,color,0.36);
    if(branch==='cristalina'&&tier>=3)for(const s of [-1,1]){
      const shard=add(g,oct(0.16),bright,s*0.22,h+0.22,-0.08);shard.scale.y=1.6;
    }
  }else if(type==='lightning'){
    foot(g,slate);
    add(g,cyl(0.30,0.36,h-0.08,8),steel,0,h*0.5+0.07,0);
    add(g,cyl(0.37,0.37,0.07,8),darkSlate,0,h-0.035,0);
    for(let j=0;j<3+(tier>=4?1:0);j++){
      const y=0.25+j*(h-0.28)/(2+(tier>=4?1:0));
      add(g,cyl(0.36,0.36,0.06,8),j%2?bronze:herald,0,y,0);
    }
    for(const s of [-1,1]){
      add(g,cyl(0.045,0.055,0.44,6),bronze,s*0.23,h+0.17,0);
      add(g,oct(0.09),bright,s*0.23,h+0.42,0);
    }
    if(branch==='canhao'&&tier>=3){
      add(g,cyl(0.105,0.14,0.45,8),darkSlate,0,h+0.10,0.23).rotation.x=Math.PI/2;
      add(g,cyl(0.13,0.13,0.06,8),bronze,0,h+0.10,0.48).rotation.x=Math.PI/2;
    }
    if(tier>=2)rim(g,h-0.02,color,0.35);
  }else if(type==='nature'){
    foot(g,timber);
    add(g,cyl(0.18,0.32,h-0.04,7),timber,0,h*0.5+0.08,0);
    for(let i=0;i<7;i++){
      const a=i*Math.PI*2/7;
      beam(g,[Math.cos(a)*0.43,0.12,Math.sin(a)*0.43],[Math.cos(a)*0.15,0.55,Math.sin(a)*0.15],0.055,timberEdge);
    }
    add(g,cyl(0.28,0.23,0.12,7),branch==='praga'?slate:std(0x526747,{roughness:0.95}),0,h-0.04,0);
    const count=5+(tier>=4?3:0);
    for(let i=0;i<count;i++){
      const a=i*Math.PI*2/count;
      const leaf=add(g,cone(0.10,0.25,5),i%3?herald:accent,Math.cos(a)*0.26,h+0.11,Math.sin(a)*0.26);
      leaf.rotation.z=Math.cos(a)*0.22;leaf.rotation.x=-Math.sin(a)*0.22;
    }
    if(tier>=2)rim(g,0.18,color,0.37);
    if(tier>=5)add(g,oct(0.13),bright,0,h+0.38,0);
  }else if(type==='necro'){
    foot(g,darkSlate);
    add(g,box(0.55,h-0.14,0.55),slate,0,h*0.5+0.075,0);
    for(const s of [-1,1]){
      add(g,box(0.08,h*0.63,0.06),bone,s*0.22,h*0.47,0.29);
      add(g,oct(0.075),accent,s*0.22,h*0.78,0.31);
    }
    add(g,box(0.67,0.08,0.67),limestone,0,h-0.04,0);
    for(const x of [-0.30,0.30])for(const z of [-0.30,0.30]){
      add(g,box(0.10,0.29,0.10),slate,x,h+0.11,z);
      add(g,cone(0.08,0.24,4),bone,x,h+0.38,z);
    }
    add(g,box(0.24,0.33,0.035),darkSlate,0,h*0.48,0.29);
    add(g,oct(0.08),bright,0,h*0.56,0.32);
    if(branch==='senhor'&&tier>=3)banner(g,color,h*0.70,0.39);
    if(tier>=2)rim(g,h-0.025,color,0.35);
  }else if(type==='trap'){
    // Perfil baixo: inimigos continuam podendo atravessar a armadilha.
    add(g,cyl(0.43,0.46,0.065,8),darkSlate,0,0.033,0);
    add(g,cyl(0.34,0.37,0.045,8),steel,0,0.08,0);
    add(g,cyl(0.23,0.25,0.025,8),herald,0,0.116,0);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4;
      add(g,box(0.065,0.025,0.11),i%2?bronze:accent,Math.cos(a)*0.32,0.105,Math.sin(a)*0.32).rotation.y=-a;
    }
    if(tier>=3)for(let i=0;i<6;i++){
      const a=i*Math.PI/3;
      add(g,cone(0.04,0.13+(tier>=5?0.07:0),4),branch==='explosiva'?bronze:steel,Math.cos(a)*0.21,0.19,Math.sin(a)*0.21);
    }
    if(tier>=2)rim(g,0.13,color,0.34);
    top=lastBase=0;
  }
  if(type!=='trap'&&tier>=5)for(const s of [-1,1])
    add(g,oct(0.055),bright,s*0.31,0.19,0.31);
  return {group:g,top,lastBase};
}
