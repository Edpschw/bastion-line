"""Original medieval-fantasy architecture following Bastion Line's eight classes."""
from geometry import *
import pathlib
ROOT=pathlib.Path(__file__).resolve().parents[2]/'assets'/'towers'/'detailed'
SOURCE=json.loads((ROOT/'source_towers.json').read_text())

def palette(kind,color):
 stone={'militia':'8c8980','archer':'928879','mage':'697486','frost':'a7bec4','lightning':'6b7173','nature':'777d66','trap':'766e5c','necro':'555264'}[kind]
 p={
 'stone':dict(color=stone,rough=.9),'trim':dict(color='b6ac93',rough=.8),'dark':dict(color='202a30',rough=.95),
 'wood':dict(color='694833',rough=.88),'woodLight':dict(color='987045',rough=.8),'iron':dict(color='495965',metal=.72,rough=.36),
 'steel':dict(color='a0b2bd',metal=.75,rough=.3),'bronze':dict(color='bc8b43',metal=.68,rough=.34),'roof':dict(color='344854',rough=.7),
 'accent':dict(color=color.lstrip('#'),rough=.7),'glow':dict(color=color.lstrip('#'),rough=.2,emit=.7),
 'bone':dict(color='d9cfb3',rough=.74),'leaf':dict(color='426448',rough=.9),'leafLight':dict(color='708445',rough=.9),
 'moss':dict(color='525e3c',rough=1),'ember':dict(color='ffc36b',rough=.35,emit=.8)}
 if kind=='frost':p['trim']['color']='d6e5e4';p['roof']['color']='47869a';p['steel']['color']='b3dadd'
 if kind=='necro':p['trim']['color']='868590';p['roof']['color']='333542'
 return p

def foundation(b,round=False):
 if round:
  b.cyl((0,0,0),1.96,.16,'dark',12);b.cyl((0,0,.16),1.85,.14,'stone',12,variation=.04)
  for i in range(12):b.wedge(1.64,1.85,.31,.055,i*TAU/12+.012,(i+1)*TAU/12-.012,'trim')
 else:
  b.box((0,0,.09),(3.65,3.65,.18),'dark',.07);b.box((0,0,.22),(3.43,3.43,.17),'stone',.065)
  for s in [-1,1]:
   for i in range(6):
    b.box((s*1.64,(i-2.5)*.54,.335),(.17,.51,.075),'trim',.01,variation=.07)
    b.box(((i-2.5)*.54,s*1.64,.335),(.51,.17,.075),'trim',.01,variation=.07)
 # Front entry steps and stone paving
 for i in range(3):b.box((0,-1.56+i*.15,.15+i*.06),(.86,.4,.12),'trim',.025)
 for i in range(4):
  b.box((-.9+i*.6,-1.23,.32),(.56,.34,.05),'stone',.01,variation=.12)

def masonry_square(b,w,d,z,h,rows=None):
 b.box((0,0,z+h/2),(w-.07,d-.07,h),'dark',.03)
 rows=rows or max(2,int(h/.3));rh=h/rows
 for row in range(rows):
  count=max(3,int(w/.4));width=w/count
  for face in range(4):
   extent=w if face%2==0 else d;cnt=max(3,int(extent/.42));bw=extent/cnt
   for j in range(cnt):
    t=-extent/2+(j+.5)*bw
    if face==0:c=(t,-d/2,z+(row+.5)*rh);dim=(bw-.022,.17,rh-.024)
    elif face==1:c=(w/2,t,z+(row+.5)*rh);dim=(.17,bw-.022,rh-.024)
    elif face==2:c=(t,d/2,z+(row+.5)*rh);dim=(bw-.022,.17,rh-.024)
    else:c=(-w/2,t,z+(row+.5)*rh);dim=(.17,bw-.022,rh-.024)
    b.box(c,dim,'stone',.014,variation=.1)

def masonry_round(b,r,z,h,rows=None,n=16):
 b.cyl((0,0,z),r-.018,h,'dark',n)
 rows=rows or max(2,int(h/.32));rh=h/rows
 for row in range(rows):
  for j in range(n):
   a=(j+(.5 if row%2 else 0))*TAU/n;b.wedge(r-.11,r,z+row*rh+.008,rh-.02,a+.012,a+TAU/n-.012,'stone',.10)

def crenellations(b,z,r=1.3,n=12):
 b.cyl((0,0,z-.1),r+.09,.18,'trim',n)
 b.cyl((0,0,z+.08),r+.01,.16,'stone',n)
 for j in range(n):
  a=j*TAU/n
  b.box(((r-.035)*math.cos(a),(r-.035)*math.sin(a),z+.37),(.34,.27,.4),'trim',.03,rotation=a,variation=.05)

def window(b,x,y,z,w=.26,h=.55,glow=False):
 b.arch(x,y,z,w,h,'trim',.07)
 if glow:
  b.box((x,y-.015,z+h*.42),(w*.5,.025,h*.55),'glow',.005)
 b.box((x,y-.04,z+h*.36),(.035,.055,h*.7),'bronze',.005)
 b.box((x,y-.035,z+h*.4),(w*.8,.055,.035),'bronze',.005)
 b.box((x,y-.05,z-.03),(w+.2,.18,.07),'trim',.01)

def door(b,y,z=.35,w=.58,h=1.1):
 b.arch(0,y,z,w,h)
 for i in range(5):b.box(((i-2)*w/5,y-.022,z+h*.38),(w/5-.012,.055,h*.69),'wood',.008,variation=.07)
 for zz in [z+.15,z+.55]:b.box((0,y-.061,zz),(w*.9,.035,.05),'iron',.006)
 b.torus((w*.25,y-.09,z+.4),.05,.012,'bronze',12,4,axis='y')

def banner(b,x,y,z,color='accent',width=.45,height=.8):
 old=b.part;b.part='banners';b.beam((x-width*.6,y,z),(x+width*.6,y,z),.025,'bronze');b.ribbon(x,y,z,width,height,color)
 b.poly([[x-.07,y-.03,z-.16],[x+.07,y-.03,z-.16],[x,y-.025,z-.36]],'bronze');b.part=old

def shield(b,x,y,z,w=.5,h=.7):
 outline=[[-w/2,0,h/2],[w/2,0,h/2],[w*.42,0,-h*.1],[0,0,-h*.5],[-w*.42,0,-h*.1]]
 b.poly(np.array(outline[::-1])+[x,y,z],'bronze');b.poly(np.array(outline[::-1])*[.82,1,.83]+[x,y-.018,z+.02],'accent')
 b.box((x,y-.04,z+.06),(.055,.025,h*.52),'bronze',.004);b.box((x,y-.04,z+.12),(w*.52,.025,.055),'bronze',.004)
 for sx in [-1,1]:b.sphere((x+sx*w*.35,y-.04,z+h*.3),.025,'steel',8,4)

def brazier(b,x,y,z,s=.7):
 b.cyl((x,y,z),.13*s,.15*s,'iron',8,rt=.19*s);b.cyl((x,y,z+.15*s),.19*s,.24*s,'bronze',10,rt=.27*s)
 b.torus((x,y,z+.4*s),.27*s,.025*s,'iron',16,5)
 old=b.part;b.part='effects'
 for i in range(5):
  a=i*TAU/5;b.crystal((x+.1*s*math.cos(a),y+.1*s*math.sin(a),z+.34*s),.08*s,(.28+.1*(i%2))*s,'ember',5,lean=(.06*s,0))
 b.part=old

def tiled_roof(b,x,y,z,w,d,h):
 # Gable ridge along Y; overlapped tiles, cedar edge rafters, ridge caps.
 for side in [-1,1]:
  b.poly([[x,y-d/2,z+h],[x,y+d/2,z+h],[x+side*w/2,y+d/2,z],[x+side*w/2,y-d/2,z]],'roof')
  for row in range(6):
   a=row/6;aa=(row+1.13)/6
   for col in range(7):
    yl=y-d/2+col*d/7;yr=yl+d/7*.95
    b.poly([[x+side*w/2*a,yl,z+h*(1-a)+.03],[x+side*w/2*a,yr,z+h*(1-a)+.03],[x+side*w/2*aa,yr,z+h*(1-aa)+.03],[x+side*w/2*aa,yl,z+h*(1-aa)+.03]],'roof' if (row+col)%5 else 'iron')
  for yy in [y-d/2,y+d/2]:b.beam((x,yy,z+h),(x+side*w/2,yy,z),.06,'woodLight',6)
  b.beam((x+side*w/2,y-d/2,z),(x+side*w/2,y+d/2,z),.075,'woodLight',6)
 for j in range(7):b.box((x,y-d/2+(j+.5)*d/7,z+h+.045),(.17,d/7-.018,.09),'bronze',.018)

def buttresses(b,z,h,r=1.3,n=4):
 for i in range(n):
  a=i*TAU/n+math.pi/4;x,y=r*math.cos(a),r*math.sin(a)
  b.box((x,y,z+h*.4),(.3,.34,h*.8),'trim',.04,rotation=a)
  b.box((x*1.1,y*1.1,z+.12),(.43,.48,.24),'stone',.025,rotation=a)
  b.beam((x*1.2,y*1.2,z+.25),(x*.85,y*.85,z+h),.13,'stone',4,rt=.08)

def ballista(b,x,y,z,size=1,repeater=False):
 b.cyl((x,y,z),.25*size,.18*size,'iron',16);b.box((x,y-.15*size,z+.33*size),(.27*size,1.45*size,.17*size),'woodLight',.025)
 for side in [-1,1]:
  pts=[(x,y-.58*size,z+.39*size),(x+side*.4*size,y-.46*size,z+.4*size),(x+side*.77*size,y-.24*size,z+.42*size)]
  b.tube(pts,.058*size,'wood',6)
  b.beam(pts[-1],(x,y+.35*size,z+.4*size),.01*size,'bone',4)
  b.torus((x+side*.19*size,y+.32*size,z+.32*size),.11*size,.027*size,'bronze',12,5,axis='x')
 for k in range(3 if repeater else 1):
  xx=x+(k-1)*.09*size if repeater else x
  b.beam((xx,y+.36*size,z+.48*size),(xx,y-.96*size,z+.48*size),.024*size,'woodLight',6)
  b.beam((xx,y-.92*size,z+.48*size),(xx,y-1.15*size,z+.48*size),.067*size,'steel',4,rt=0)
 b.markers['muzzle']=[x,y-1.0*size,z+.48*size]

def skull(b,x,y,z,s=.16):
 b.sphere((x,y,z),s,'bone',10,6,scale=(.85,.7,1))
 for side in [-1,1]:b.sphere((x+side*s*.34,y-s*.58,z+s*.08),s*.23,'dark',8,4,scale=(1,.2,1))
 b.box((x,y-s*.4,z-s*.65),(s*.92,s*.52,s*.55),'bone',.008)
 for side in [-1,0,1]:b.box((x+side*s*.21,y-s*.69,z-s*.72),(.008,.015,s*.25),'dark',0)

def runes(b,z,r=1.1,n=12):
 for i in range(n):
  a=i*TAU/n;x,y=r*math.cos(a),r*math.sin(a)
  b.box((x,y,z),(.09,.018,.04),'glow',.005,rotation=a)
  b.box((x+.035*math.cos(a),y+.035*math.sin(a),z+.055),(.09,.018,.025),'bronze',.004,rotation=a+math.pi/4)

def build(kind,tier,branch):
 base=SOURCE['UNIT_BASE'][kind];color=SOURCE['BRANCHES'][kind][branch]['tier2']['color'] if branch else base['color'];b=Builder(palette(kind,color),13+list(SOURCE['UNIT_BASE']).index(kind))
 h=2.25+.21*(tier-1)
 if kind=='militia':
  foundation(b);masonry_square(b,2.35,2.15,.36,h);top=.36+h
  b.box((0,0,top+.05),(2.75,2.55,.19),'trim',.055)
  for s in [-1,1]:
   for i in [-1,0,1]:
    b.box((s*1.2,i*.82,top+.36),(.27,.38,.5),'stone',.025);b.box((i*.82,s*1.1,top+.36),(.38,.26,.5),'stone',.025)
  door(b,-1.19)
  for x in [-.78,.78]:window(b,x,-1.2,1.6,.18,.55)
  if tier>=2:
   banner(b,-.72,-1.235,1.49,width=.35,height=.69);banner(b,.72,-1.235,1.49,width=.35,height=.69)
  if tier>=3:
   for x in [-1.15,1.15]:
    for y in [-1.04,1.04]:
     b.cyl((x,y,.36),.3,top-.3,'stone',10);b.cyl((x,y,top+.06),.36,.13,'trim',10)
     for j in range(5):a=j*TAU/5;b.box((x+.26*math.cos(a),y+.26*math.sin(a),top+.37),(.18,.2,.37),'trim',.018,rotation=a)
  b.part='weapon';b.pivot=np.array([0,0,top+.13])
  if branch=='guerreiro':
   for s in [-1,1]:
    b.beam((s*.2,.35,top+.16),(-s*.45,.12,top+1.02),.06,'wood',8)
    b.poly([[s*.18,.08,top+.54],[s*.63,.08,top+1.17],[s*.84,.08,top+1.07],[s*.48,.08,top+.5]],'steel')
    b.box((s*.24,.08,top+.49),(.36,.12,.09),'bronze',.016,rotation=s*.4)
   shield(b,0,-.19,top+.45,.48,.7)
  else:
   shield(b,0,-.12,top+.65,.83,1.1)
   for s in [-1,1]:
    b.beam((s*.55,.1,top+.05),(s*.55,.1,top+1.03),.04,'wood')
    b.crystal((s*.55,.1,top+.95),.09,.34,'steel',4)
  b.part='structure'
  if tier>=4:
   for s in [-1,1]:brazier(b,s*.8,.78,top+.2,.62)
  if tier>=5:
   for s in [-1,1]:shield(b,s*.81,-1.25,top-.4,.4,.5)
 elif kind=='archer':
  foundation(b);masonry_square(b,1.98,1.76,.35,.6,2);top=h+.75
  for x in [-.94,.94]:
   for y in [-.83,.83]:
    b.box((x,y,(top+.45)/2),(.23,.23,top-.45),'wood',.025)
    for zz in [.75,top-.25]:b.box((x,y,zz),(.26,.26,.11),'iron',.02)
  for y in [-.86,.86]:
   b.beam((-.9,y,1.05),(.9,y,top-.18),.075,'woodLight',6);b.beam((.9,y,1.05),(-.9,y,top-.18),.075,'woodLight',6)
   b.box((0,y,1.65),(2.06,.15,.15),'wood',.025)
  for i in range(13):b.box(((i-6)*.21,0,top),(.198,2.48,.17),'woodLight',.015,variation=.12)
  for y in [-1.16,1.16]:
   for x in np.linspace(-1.16,1.16,7):b.box((x,y,top+.31),(.085,.09,.58),'wood',.009)
   b.box((0,y,top+.62),(2.62,.12,.12),'woodLight',.025)
  for x in [-1.21,1.21]:b.box((x,0,top+.61),(.12,2.5,.12),'woodLight',.018)
  for x in [-.27,.27]:b.beam((x,-1.44,.35),(x,-1.15,top),.055,'woodLight',6)
  for z in np.arange(.55,top,.23):b.beam((-.29,-1.44+(z-.35)*.29/(top-.35),z),(.29,-1.44+(z-.35)*.29/(top-.35),z),.035,'woodLight',6)
  for x in [-.94,.94]:b.box((x,.7,top+.58),(.14,.14,1.1),'wood',.018)
  tiled_roof(b,0,.65,top+1.05,2.38,1.25,.62 if tier>=3 else .42)
  if tier>=2:banner(b,.89,-1.25,top-.14,width=.46,height=.64)
  b.part='weapon';b.pivot=np.array([0,-.36,top+.14]);ballista(b,0,-.35,top+.14,.8 if branch!='francoatiradora' else 1.04,branch=='patrulheira')
  if tier>=5:
   if branch=='patrulheira':
    for side in [-1,1]:ballista(b,side*.82,-.3,top+.27,.43,True)
   else:
    b.beam((.14,.1,top+.7),(.14,-.55,top+.7),.075,'bronze',12)
    b.sphere((.14,-.57,top+.7),.06,'glow',10,6,scale=(1,.2,1))
  b.part='structure'
  if tier>=3:
   for s in [-1,1]:
    b.cyl((s*.72,.69,top+.1),.16,.38,'wood',10)
    for k in range(5):b.beam((s*.72+(k-2)*.04,.68,top+.22),(s*.72+(k-2)*.04,.68,top+.86),.012,'bone',4)
  if tier>=4:
   for s in [-1,1]:shield(b,s*.67,-1.28,top+.2,.35,.44)
 elif kind=='mage':
  foundation(b,True);masonry_round(b,1.17,.36,h,9,12);top=.36+h
  buttresses(b,.35,h,1.2,4);door(b,-1.185,w=.49,h=1.05)
  for x in [-.59,.59]:window(b,x,-1.02,1.65,.23,.68,True)
  for zz in [.55,1.42,top-.17]:b.cyl((0,0,zz),1.23,.085,'bronze',12)
  b.cyl((0,0,top),1.4,.2,'trim',12);b.cyl((0,0,top+.2),1.28,.1,'dark',12)
  for i in range(6):
   a=i*TAU/6;x,y=1.07*math.cos(a),1.07*math.sin(a)
   b.cyl((x,y,top+.3),.085,.55,'bronze',8);b.crystal((x,y,top+.79),.12,.24,'glow',6)
  b.part='weapon';b.pivot=np.array([0,0,top+.3]);b.cyl((0,0,top+.3),.4,.3,'bronze',12,rt=.27)
  if branch=='piromante':
   b.cyl((0,0,top+.58),.35,.23,'iron',12,rt=.66);b.torus((0,0,top+.82),.65,.065,'bronze',24,6)
   for i in range(7):
    a=i*TAU/7;b.crystal((.28*math.cos(a),.28*math.sin(a),top+.8),.2,.65+.13*(i%3),'glow',6,lean=(.09*math.cos(a),.09*math.sin(a)))
   b.crystal((0,0,top+1),.23,1,'ember',6)
  else:
   b.sphere((0,0,top+1.08),.28,'glow',16,10)
   for axis in ['x','y','z']:b.torus((0,0,top+1.08),.59,.035,'bronze',32,6,axis)
   for i in range(4):a=i*math.pi/2;b.crystal((.59*math.cos(a),.59*math.sin(a),top+1.08),.09,.19,'glow',6)
  b.part='structure'
  if tier>=2:runes(b,top+.39,1.3,12)
  if tier>=3:
   for s in [-1,1]:banner(b,s*.8,-1.02,1.25,width=.35,height=.65)
  if tier>=4:
   for s in [-1,1]:brazier(b,s*1.3,-.5,.37,.6)
  if tier>=5:
   b.torus((0,0,top+1.9),.38,.025,'bronze',24,6);b.crystal((0,0,top+1.84),.095,.32,'glow')
 elif kind=='frost':
  foundation(b,True);masonry_round(b,1.17,.36,h-.22,8,16);top=h+.16
  buttresses(b,.35,h-.18,1.22,6);crenellations(b,top,1.26,12)
  window(b,0,-1.19,.68,.48,1.18,True)
  for i in range(10):
   a=i*TAU/10;x,y=1.35*math.cos(a),1.35*math.sin(a)
   b.crystal((x,y,.4),.12,.47+(i%3)*.21,'accent',5,lean=(x*.06,y*.06))
  for i in range(12):
   a=i*TAU/12;b.beam((1.23*math.cos(a),1.23*math.sin(a),top),(1.28*math.cos(a),1.28*math.sin(a),top-.35-(i%3)*.08),.05,'steel',5,rt=.003)
  b.part='weapon';b.pivot=np.array([0,0,top+.18]);b.cyl((0,0,top+.18),.59,.15,'bronze',12)
  b.crystal((0,0,top+.34),.38,1.24 if branch=='cristalina' else .95,'glow',6)
  for i in range(6):
   a=i*TAU/6;r=.56 if branch=='cristalina' else .69
   b.crystal((r*math.cos(a),r*math.sin(a),top+.29),.17,.86 if branch=='cristalina' else .56,'accent',6,lean=(.1*math.cos(a),.1*math.sin(a)))
  if branch=='eterna':
   b.torus((0,0,top+1.25),.7,.027,'steel',36,5)
   for i in range(6):a=i*TAU/6;b.crystal((.7*math.cos(a),.7*math.sin(a),top+1.24),.09,.16,'glow',4)
  if tier>=5:
   for i in range(6):
    a=i*TAU/6+math.pi/6;b.crystal((.91*math.cos(a),.91*math.sin(a),top+.35),.11,.51,'steel',5)
  b.part='structure'
  if tier>=3:runes(b,top+.24,1.25,12)
  if tier>=4:
   for s in [-1,1]:banner(b,s*.68,-1.02,1.53,width=.3,height=.65)
 elif kind=='lightning':
  foundation(b,True);masonry_round(b,1.3,.36,h-.53,6,8);top=h-.17
  for zz in [.5,top-.25]:b.cyl((0,0,zz),1.42,.16,'iron',8)
  for i in range(8):
   a=i*TAU/8;x,y=1.29*math.cos(a),1.29*math.sin(a)
   b.box((x,y,(top+.36)/2),(.2,.25,top-.36),'iron',.025,rotation=a)
   for zz in [.66,top-.29]:b.sphere((x*1.055,y*1.055,zz),.045,'bronze',8,4)
  for x in [-.55,0,.55]:
   for zz in [.97,1.13,1.29]:b.box((x,-1.32,zz),(.35,.11,.07),'dark',.012)
  b.cyl((0,0,top),1.49,.16,'bronze',12);b.cyl((0,0,top+.16),1.34,.09,'iron',12)
  for i in range(4):
   a=i*TAU/4+math.pi/4;x,y=1.07*math.cos(a),1.07*math.sin(a)
   b.cyl((x,y,top+.25),.18,.47,'dark',12)
   for zz in np.linspace(top+.29,top+.71,6):b.torus((x,y,zz),.21,.035,'bone',16,5)
   b.sphere((x,y,top+.85),.16,'bronze',12,8)
  b.part='weapon';b.pivot=np.array([0,0,top+.24]);b.cyl((0,0,top+.24),.46,.23,'iron',16)
  if branch=='canhao':
   z=top+.78;b.beam((0,.48,z),(0,-1.32,z+.22),.22,'iron',16)
   for i in range(9):
    yy=.4-i*.19;zz=z+(.48-yy)*.22/1.8;b.torus((0,yy,zz),.26,.045,'bronze',20,6,axis='y')
   for s in [-1,1]:b.beam((s*.28,.37,z),(s*.28,-1.37,z+.22),.075,'steel',8)
   b.sphere((0,-1.4,z+.22),.15,'glow',12,8,scale=(1,.2,1));b.markers['muzzle']=[0,-1.43,z+.22]
  else:
   b.cyl((0,0,top+.46),.28,1.07,'dark',16)
   points=[]
   for t in np.linspace(0,TAU*(5+tier),210):points.append([.39*math.cos(t),.39*math.sin(t),top+.49+t/(TAU*(5+tier))*1.02])
   b.tube(points,.036,'bronze',5)
   b.cyl((0,0,top+1.55),.48,.09,'iron',20)
   b.torus((0,0,top+1.78),.44,.095,'bronze',32,8);b.sphere((0,0,top+1.76),.23,'glow',16,10)
  b.part='structure'
  if tier>=3:
   for s in [-1,1]:b.tube([(s*1.11,.4,top+.3),(s*1.12,.45,top+.9),(s*.7,.4,top+1.17)],.06,'bronze',8)
  if tier>=4:banner(b,0,-1.42,top-.31,width=.47,height=.59)
  if tier>=5:
   for side in [-1,1]:
    b.torus((side*.99,.28,top+.65),.23,.055,'bronze',24,6,axis='x')
    b.sphere((side*.99,.28,top+.65),.12,'glow',12,8)
 elif kind=='nature':
  foundation(b,True);top=3.35+.16*(tier-1)
  trunk=[(0,0,.33),(-.13,.05,1.15),(.15,-.04,2.15),(0,.05,3.1),(.13,0,top)]
  b.tube(trunk,.39,'wood',10,rt=.16)
  for i in range(9):
   a=i*TAU/9;x,y=math.cos(a),math.sin(a)
   b.tube([(x*1.5,y*1.5,.36),(x*.9,y*.9,.46),(x*.46,y*.46,.86),(0,0,1.5)],.14,'woodLight',6,rt=.06)
  for i in range(6):
   a=i*TAU/6;x,y=math.cos(a),math.sin(a)
   b.tube([(0,0,2.1),(.48*x,.48*y,2.75),(1.02*x,1.02*y,3.1),(1.32*x,1.32*y,3.55)],.16,'wood',7,rt=.032)
   if branch=='praga':
    for j in range(3):
     xx=x*(.85+.14*j);yy=y*(.85+.14*j);zz=3.03+.19*j
     b.cyl((xx,yy,zz),.045,.27,'bone',8);b.sphere((xx,yy,zz+.28),.25,'accent',10,6,scale=(1,1,.43))
     b.sphere((xx+.05,yy-.14,zz+.29),.043,'glow',8,4)
   else:
    # Layered leaf clusters, plus individual tapered leaves.
    b.sphere((x*.93,y*.93,3.48),.52,'leaf',12,8,scale=(1.1,1.1,.56))
    b.sphere((x*.71,y*.71,3.76),.47,'leafLight',12,8,scale=(1.12,1.12,.6))
    for j in range(12):
     aa=j*TAU/12;cx=x*.92+.4*math.cos(aa);cy=y*.92+.4*math.sin(aa)
     b.poly([[cx,cy,3.51],[cx+.17*math.cos(aa+.8),cy+.17*math.sin(aa+.8),3.6],[cx+.38*math.cos(aa),cy+.38*math.sin(aa),3.46],[cx+.17*math.cos(aa-.8),cy+.17*math.sin(aa-.8),3.57]],'leafLight')
  # Sacred grove altar and canopy focus
  b.cyl((0,-.52,.39),.6,.18,'stone',12);b.cyl((0,-.52,.57),.48,.12,'trim',12);b.torus((0,-.52,.72),.41,.035,'bronze',20,5)
  b.part='weapon';b.pivot=np.array([0,-.52,.7]);b.crystal((0,-.52,.77),.19,.47,'glow',6);b.part='structure'
  for i in range(5 if tier>=3 else 3):
   a=i*TAU/5+.25;x,y=1.43*math.cos(a),1.43*math.sin(a)
   b.cyl((x,y,.37),.13,.56,'stone',6,rt=.09);b.crystal((x,y,.93),.09,.18,'glow',4)
  for x,y in [(-1,-.7),(.9,-.8),(.6,.8)]:
   b.cyl((x,y,.34),.046,.26,'bone',8);b.sphere((x,y,.62),.21,'accent',10,6,scale=(1,1,.5))
  if tier>=4:
   for x in [-.63,.63]:b.tube([(x,.03,3),(x,-.04,2.52)],.017,'bronze',5);b.crystal((x,-.04,2.23),.13,.23,'glow',6)
  if tier>=5:
   b.torus((0,.05,1.77),.48,.03,'bronze',28,5,axis='y');b.crystal((0,-.39,1.58),.15,.35,'glow',6)
 elif kind=='trap':
  b.cyl((0,0,0),1.87,.12,'stone',12);b.cyl((0,0,.12),1.7,.09,'iron',12)
  for i in range(12):
   a=i*TAU/12;b.wedge(1.44,1.74,.23,.075,a+.018,a+TAU/12-.018,'bronze',.08)
   b.sphere((1.59*math.cos(a),1.59*math.sin(a),.315),.049,'steel',8,4,scale=(1,1,.45))
  for i in range(7):b.box(((i-3)*.32,0,.235),(.3,2.14,.07),'wood',.012,variation=.1)
  b.part='weapon';b.pivot=np.array([0,0,.25]);b.box((0,0,.3),(1.5,1.5,.13),'iron',.06)
  for s in [-1,1]:
   b.box((s*.5,0,.375),(.06,1.42,.035),'bronze',.006);b.box((0,s*.5,.375),(1.42,.06,.035),'bronze',.006)
  if branch=='explosiva':
   for x,y in [(-1.05,0),(1.05,0),(0,-1.05),(0,1.05)]:
    b.cyl((x,y,.22),.24,.22,'woodLight',12)
    for zz in [.24,.4]:b.torus((x,y,zz),.24,.028,'iron',16,5)
    b.tube([(x,y,.46),(x*.77,y*.77,.5),(x*.66,y*.66,.38)],.019,'bone',5)
   b.box((0,0,.4),(.39,.39,.08),'accent',.025)
  else:
   for i in range(4):
    a=i*TAU/4+math.pi/4;x,y=1.15*math.cos(a),1.15*math.sin(a)
    b.cyl((x,y,.22),.19,.28,'glow',12,rt=.16);b.cyl((x,y,.5),.12,.06,'bronze',12)
    b.tube([(x,y,.38),(x*.65,y*.65,.4),(x*.5,y*.5,.31)],.04,'bronze',6)
   for x in [-.45,0,.45]:
    for y in [-.45,0,.45]:b.cyl((x,y,.379),.055,.015,'dark',8)
  if tier>=3:
   for i in range(12):a=i*TAU/12;b.cyl((1.38*math.cos(a),1.38*math.sin(a),.22),.053,.27,'steel',5,rt=0)
  if tier>=4:
   for side in [-1,1]:
    b.box((side*.47,0,.399),(.1,1.19,.027),'accent',.004)
    for k in range(5):b.box((side*.47,(k-2)*.22,.42),(.17,.045,.035),'steel',.007)
  if tier>=5:
   b.torus((0,0,.42),.4,.033,'bronze',32,6)
   for i in range(8):
    a=i*TAU/8;b.tube([(.68*math.cos(a),.68*math.sin(a),.425),(.95*math.cos(a+.12),.95*math.sin(a+.12),.39),(1.32*math.cos(a+.12),1.32*math.sin(a+.12),.32)],.022,'accent',5)
   b.crystal((0,0,.45),.115,.17,'glow',6)
  b.part='structure';top=.4
 elif kind=='necro':
  foundation(b);masonry_square(b,2.1,2.1,.36,h-.25);top=h+.11
  b.box((0,0,top),(2.45,2.45,.16),'trim',.04)
  door(b,-1.16,w=.78,h=1.64)
  for s in [-1,1]:
   for yy in [-.85,.85]:
    x=s*1.18;b.box((x,yy,1.0),(.3,.34,1.38),'stone',.03)
    b.tube([(x*1.15,yy,.6),(x*1.12,yy,1.28),(x*.85,yy,2.22)],.105,'trim',5)
    b.cyl((x,yy,top+.12),.19,.45,'stone',8);b.cyl((x,yy,top+.57),.28,.6,'roof',8,rt=0)
    b.crystal((x,yy,top+1.14),.06,.17,'glow',4)
  for s in [-1,1]:window(b,s*.72,-1.17,1.67,.18,.52,True)
  b.box((0,.75,top+.3),(1.65,.9,.51),'stone',.04);tiled_roof(b,0,.75,top+.55,2.1,1.35,.64)
  skull(b,0,-1.2,2.35,.19)
  if tier>=2:
   for s in [-1,1]:banner(b,s*.69,-1.19,1.34,width=.28,height=.75)
  b.part='weapon';b.pivot=np.array([0,-.23,top+.13])
  if branch=='senhor':
   b.box((0,-.24,top+.4),(.82,.73,.23),'dark',.04);b.box((0,.04,top+.82),(.88,.15,.95),'bone',.03)
   for s in [-1,1]:
    b.box((s*.5,-.24,top+.6),(.15,.72,.18),'bone',.025);skull(b,s*.5,-.62,top+.65,.12)
   skull(b,0,-.05,top+1.38,.2)
   for i in range(5):b.cyl(((i-2)*.17,.06,top+1.2),.06,.4+(.2 if i==2 else 0),'bone',5,rt=0)
  else:
   b.cyl((0,-.28,top+.16),.36,.3,'stone',8,rt=.25)
   for s in [-1,1]:
    b.poly([[0,-.7,top+.6],[0,.04,top+.6],[s*.44,.01,top+.71],[s*.44,-.67,top+.71]],'bone')
    for j in range(4):b.box((s*.23,-.58+j*.14,top+.68),(.25,.012,.012),'dark',0)
   b.crystal((0,-.26,top+.97),.19,.45,'glow',6);b.torus((0,-.26,top+1.2),.48,.025,'bronze',28,5,axis='y')
  b.part='structure'
  if tier>=3:
   for s in [-1,1]:skull(b,s*.59,-1.19,top+.08,.15)
  if tier>=4:
   for s in [-1,1]:brazier(b,s*1.38,-.75,.38,.58)
  if tier>=5:
   for i in range(7 if branch=='senhor' else 4):skull(b,-.76+i*(1.52/(6 if branch=='senhor' else 3)),-1.2,.59,.075)
 # Architecture progression: small details accumulate, footprint is invariant.
 if tier>=2 and kind not in ['trap','nature']:
  for s in [-1,1]:
   for j in range(4):b.sphere((s*1.4,-.95+j*.58,.4),.033,'bronze',8,4)
 if tier==1:
  # The first tier is deliberately simpler: no ornate trim surfaces/effects.
  b.items=[it for it in b.items if it['part'] not in ['banners','effects']]
 if kind not in ['trap','nature'] and tier>=3:
  for i in range(6):
   x=-1.42+i*.52;y=1.39+.03*math.sin(i)
   b.sphere((x,y,.38),.1,'moss',8,4,scale=(1.3,.8,.32))
 b.markers.setdefault('muzzle',[0,-.5,top+.8 if kind!='trap' else .4])
 b.markers['ground']=[0,0,0]
 b.markers['occupant_socket']=[0,0,top+.18 if kind!='trap' else .4]
 return b

if __name__=='__main__':
 manifest={'title':'Bastion Line — Medieval Collection','version':2,'source':{'repository':'https://github.com/Edpschw/bastion-line','files':['index.html','js/render3d/towerArchitecture.js','js/render3d/actors.js'],'read_date':'2026-09-25'},'units':'1 cell = 1 world unit; Y-up; ground Y=0','models':[]}
 for kind in SOURCE['UNIT_BASE']:
  variants=[(1,None,1)]+[(tier,branch,level) for tier,level in [(2,5),(3,10),(4,15),(5,20)] for branch in SOURCE['BRANCHES'][kind]]
  for tier,branch,level in variants:
   name=f'{kind}__{branch or "base"}__L{level:02d}';b=build(kind,tier,branch);path=ROOT/f'{name}.glb'
   entry={'id':name,'type':kind,'branch':branch,'level':level,'tier':tier,'file':path.name,'name':SOURCE['UNIT_BASE'][kind]['name'],'branch_name':SOURCE['BRANCHES'][kind][branch]['label'] if branch else 'Base'}
   if level>=10:entry['evolution_name']=SOURCE['TOWER_LEVELS'][kind][branch][str(level)]['name']
   entry.update(b.export(path,name,{'towerType':kind,'branch':branch,'level':level,'walkable':kind=='trap'}));manifest['models'].append(entry)
  print(kind,'exported',flush=True)
 (ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));print('TOTAL',len(manifest['models']),sum(x['bytes'] for x in manifest['models']))
