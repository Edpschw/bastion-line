"""Small deterministic mesh builder. Z-up internally; glTF export is Y-up."""
import numpy as np, math, json, struct
from collections import defaultdict
TAU=2*math.pi

def unit(v):
 v=np.asarray(v,float);return v/max(np.linalg.norm(v),1e-10)
def rgb(h):
 h=h.lstrip('#');return np.array([int(h[i:i+2],16)/255 for i in [0,2,4]])
def linear(c):return np.where(c<=.04045,c/12.92,((c+.055)/1.055)**2.4)
def convert(a):
 a=np.array(a,float).copy();a=a[:,[0,2,1]];a[:,2]*=-1;return a

class Builder:
 def __init__(self,palette,seed=11):
  self.palette=palette;self.rng=np.random.default_rng(seed);self.items=[];self.part='structure';self.pivot=np.zeros(3);self.markers={}
 def add(self,v,faces,mat='stone',variation=0):
  v=np.array(v,float);tri=[]
  for f in faces:
   for i in range(1,len(f)-1):tri.append(v[[f[0],f[i],f[i+1]]])
  t=np.array(tri);n=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]);valid=np.linalg.norm(n,axis=1)>1e-10
  t=t[valid];n=n[valid];n/=np.linalg.norm(n,axis=1)[:,None]
  col=np.clip(rgb(self.palette[mat]['color'])*(1+self.rng.uniform(-variation,variation)),0,1)
  self.items.append({'p':t.astype('f4'),'n':np.repeat(n[:,None,:],3,axis=1).astype('f4'),'c':np.tile(col,(len(t),3,1)).astype('f4'),'mat':mat,'part':self.part})
 def poly(self,points,mat='stone'):self.add(points,[list(range(len(points)))],mat)
 def box(self,c,d,mat='stone',bevel=0.025,rotation=0,variation=0):
  c=np.array(c);e=np.array(d)/2;b=min(bevel,min(e)*.6)
  faces=[];vs=[]
  def face(ps):
   arr=np.array(ps);n=np.cross(arr[1]-arr[0],arr[2]-arr[0]);
   if np.dot(n,arr.mean(0))<0:arr=arr[::-1]
   k=len(vs);vs.extend(arr);faces.append(list(range(k,k+len(arr))))
  if b<=0:
   for axis in range(3):
    others=[j for j in range(3) if j!=axis]
    for s in [-1,1]:
     q=[]
     for a,z in [(-1,-1),(1,-1),(1,1),(-1,1)]:
      p=np.zeros(3);p[axis]=s*e[axis];p[others[0]]=a*e[others[0]];p[others[1]]=z*e[others[1]];q.append(p)
     face(q)
  else:
   for axis in range(3):
    oth=[j for j in range(3) if j!=axis]
    for s in [-1,1]:
     q=[]
     for a,z in [(-1,-1),(1,-1),(1,1),(-1,1)]:
      p=np.zeros(3);p[axis]=s*e[axis];p[oth[0]]=a*(e[oth[0]]-b);p[oth[1]]=z*(e[oth[1]]-b);q.append(p)
     face(q)
   for axis in range(3):
    i,j=[k for k in range(3) if k!=axis]
    for si in [-1,1]:
     for sj in [-1,1]:
      q=[]
      for end,which in [(-1,0),(1,0),(1,1),(-1,1)]:
       p=np.zeros(3);p[axis]=end*(e[axis]-b);p[i]=si*(e[i]-(b if which else 0));p[j]=sj*(e[j]-(0 if which else b));q.append(p)
      face(q)
   for sx in [-1,1]:
    for sy in [-1,1]:
     for sz in [-1,1]:
      s=np.array([sx,sy,sz]);face([s*(e-np.array([0,b,b])),s*(e-np.array([b,0,b])),s*(e-np.array([b,b,0]))])
  v=np.array(vs);R=np.array([[math.cos(rotation),-math.sin(rotation),0],[math.sin(rotation),math.cos(rotation),0],[0,0,1]])
  self.add(v@R.T+c,faces,mat,variation)
 def cyl(self,c,r,h,mat='stone',n=16,rt=None,start=0,variation=0):
  rt=r if rt is None else rt;x,y,z=c
  v=[[x+rr*math.cos(start+i*TAU/n),y+rr*math.sin(start+i*TAU/n),zz] for zz,rr in [(z,r),(z+h,rt)] for i in range(n)]
  faces=[list(range(n-1,-1,-1)),list(range(n,2*n))]
  faces += [[i,(i+1)%n,(i+1)%n+n,i+n] for i in range(n)]
  self.add(v,faces,mat,variation)
 def tube(self,points,r,mat='iron',n=8,rt=None):
  points=np.array(points,float);v=[];ln=len(points)
  for i,p in enumerate(points):
   tangent=unit(points[min(i+1,ln-1)]-points[max(i-1,0)]);u=unit(np.cross(tangent,[0,0,1] if abs(tangent[2])<.9 else [0,1,0]));w=np.cross(tangent,u)
   radius=r if rt is None else r+(rt-r)*i/(ln-1)
   for j in range(n):v.append(p+radius*(u*math.cos(j*TAU/n)+w*math.sin(j*TAU/n)))
  faces=[list(range(n-1,-1,-1)),list(range((ln-1)*n,ln*n))]
  for i in range(ln-1):
   for j in range(n):faces.append([i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j])
  self.add(v,faces,mat)
 def beam(self,a,b,r=.07,mat='wood',n=8,rt=None):self.tube([a,b],r,mat,n,rt)
 def torus(self,c,r,t,mat='bronze',n=24,m=6,axis='z'):
  v=[];c=np.array(c)
  for i in range(n):
   a=i*TAU/n
   for j in range(m):
    b=j*TAU/m;p=np.array([(r+t*math.cos(b))*math.cos(a),(r+t*math.cos(b))*math.sin(a),t*math.sin(b)])
    if axis=='y':p=p[[0,2,1]]
    elif axis=='x':p=p[[2,1,0]]
    v.append(p+c)
  f=[]
  for i in range(n):
   for j in range(m):f.append([i*m+j,((i+1)%n)*m+j,((i+1)%n)*m+(j+1)%m,i*m+(j+1)%m])
  self.add(v,f,mat)
 def sphere(self,c,r,mat='iron',n=12,m=8,scale=(1,1,1)):
  v=[]
  for i in range(m+1):
   a=math.pi*i/m
   for j in range(n):
    b=j*TAU/n;v.append(np.array(c)+r*np.array(scale)*np.array([math.sin(a)*math.cos(b),math.sin(a)*math.sin(b),math.cos(a)]))
  f=[]
  for i in range(m):
   for j in range(n):f.append([i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j])
  self.add(v,[face[::-1] for face in f],mat)
 def crystal(self,c,r,h,mat='glow',n=6,lean=(0,0)):
  x,y,z=c;v=[[x,y,z-h*.12]]
  for zz,rr in [(z,r*.7),(z+h*.7,r)]:
   for i in range(n):v.append([x+math.cos(i*TAU/n)*rr,y+math.sin(i*TAU/n)*rr,zz])
  v.append([x+lean[0],y+lean[1],z+h]);f=[]
  for i in range(n):j=(i+1)%n;f += [[0,1+j,1+i],[1+i,1+j,1+n+j,1+n+i],[1+n+i,1+n+j,2*n+1]]
  self.add(v,f,mat)
 def wedge(self,r0,r1,z,h,a0,a1,mat='stone',variation=.08):
  v=[[r*math.cos(a),r*math.sin(a),zz] for zz in [z,z+h] for r in [r0,r1] for a in [a0,a1]]
  self.add(v,[[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]],mat,variation)
 def arch(self,x,y,z,w,h,mat='trim',depth=.18):
  # Facade facing -Y. Dark recess, stone jambs and voussoirs.
  rad=w/2;stem=h-rad
  v=[[x-rad,y,z],[x+rad,y,z],[x+rad,y,z+stem]]+[[x+rad*math.cos(a),y,z+stem+rad*math.sin(a)] for a in np.linspace(0,math.pi,13)]+[[x-rad,y,z]]
  self.poly(v,'dark')
  for s in [-1,1]:
   for j in range(max(2,int(stem/.2))):
    hh=stem/max(2,int(stem/.2));self.box((x+s*(rad+.085),y-.035,z+(j+.5)*hh),(.15,depth,hh-.018),mat,.014,variation=.07)
  for i in range(11):
   a=(i+.5)*math.pi/11;self.box((x+(rad+.07)*math.cos(a),y-.035,z+stem+(rad+.07)*math.sin(a)),(.16,depth,(rad+.14)*math.pi/11*.91),mat,.009)
   # Rotate individual arch stones around Y to follow arch.
   item=self.items[-1];p=item['p'];center=np.array([x+(rad+.07)*math.cos(a),y-.035,z+stem+(rad+.07)*math.sin(a)]);ang=math.pi/2-a
   R=np.array([[math.cos(ang),0,math.sin(ang)],[0,1,0],[-math.sin(ang),0,math.cos(ang)]])
   item['p']=(p-center)@R.T+center;item['n']=item['n']@R.T
 def ribbon(self,x,y,z,w,h,mat='accent',phase=0):
  for i in range(10):
   a=i/10;b=(i+1)/10
   pa=[x-w/2+w*a,y+.05*math.sin(a*7+phase),z];pb=[x-w/2+w*b,y+.05*math.sin(b*7+phase),z]
   self.poly([pa,pb,[pb[0],pb[1]+.05,z-h+(abs(b-.5)*.16)],[pa[0],pa[1]+.05,z-h+(abs(a-.5)*.16)]][::-1],mat)
 def export(self,path,name,extras=None,scale=.22):
  grouped=defaultdict(list)
  for it in self.items:grouped[(it['part'],it['mat'])].append(it)
  binary=bytearray();views=[];access=[];materials=[];matids={}
  for key,m in self.palette.items():
   matids[key]=len(materials);d={'name':key,'pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'metallicFactor':m.get('metal',0),'roughnessFactor':m.get('rough',.8)}}
   if m.get('emit'):d['emissiveFactor']=(linear(rgb(m['color']))*m['emit']).tolist()
   if key in ['accent','leaf','leafLight']:d['doubleSided']=True
   materials.append(d)
  def acc(arr,typ):
   arr=np.asarray(arr,dtype='<f4');start=len(binary);binary.extend(arr.tobytes());views.append({'buffer':0,'byteOffset':start,'byteLength':arr.nbytes,'target':34962})
   access.append({'bufferView':len(views)-1,'componentType':5126,'count':len(arr),'type':typ,'min':arr.min(0).tolist(),'max':arr.max(0).tolist()});return len(access)-1
  nodes=[{'name':name,'children':[],'extras':extras or {}}];ms=[]
  for part in sorted(set(k[0] for k in grouped)):
   prims=[];pivot=self.pivot if part=='weapon' else np.zeros(3)
   for (pt,mat),its in grouped.items():
    if pt!=part:continue
    p=np.concatenate([it['p'] for it in its]).reshape(-1,3);n=np.concatenate([it['n'] for it in its]).reshape(-1,3);c=np.concatenate([it['c'] for it in its]).reshape(-1,3)
    prims.append({'attributes':{'POSITION':acc(convert(p-pivot)*scale,'VEC3'),'NORMAL':acc(convert(n),'VEC3'),'COLOR_0':acc(linear(c),'VEC3')},'material':matids[mat]})
   ms.append({'name':part,'primitives':prims});nodes[0]['children'].append(len(nodes));nodes.append({'name':part,'mesh':len(ms)-1,'translation':convert([pivot])[0].__mul__(scale).tolist()})
  for key,p in self.markers.items():nodes[0]['children'].append(len(nodes));nodes.append({'name':key,'translation':convert([p])[0].__mul__(scale).tolist(),'extras':{'socket':True}})
  doc={'asset':{'version':'2.0','generator':'Bastion Line detailed tower kit 2.0'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':nodes,'meshes':ms,'materials':materials,'buffers':[{'byteLength':len(binary)}],'bufferViews':views,'accessors':access}
  js=json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode();js+=b' '*((-len(js))%4)
  path.write_bytes(struct.pack('<III',0x46546c67,2,28+len(js)+len(binary))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary)
  verts=np.concatenate([it['p'].reshape(-1,3) for it in self.items]);return {'triangles':sum(len(it['p']) for it in self.items),'primitives':sum(len(m['primitives']) for m in ms),'bounds':(convert(verts)*scale).min(0).tolist()+(convert(verts)*scale).max(0).tolist(),'bytes':path.stat().st_size}
