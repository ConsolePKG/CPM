from pathlib import Path
from html import escape
import base64, math
OUT=Path(__file__).parent
ASSETS=OUT.parent/'v12/assets'
BG='#13131b'; PANEL='#1b1b25'; MUTED='#9c9baa'; WHITE='#f0eff5'; BLUE='#69baff'; LINE='#30303d'
names=['Cyberpunk 2077','God of War','Red Dead Redemption 2','Horizon Zero Dawn','The Witcher 3: Wild Hunt','Death Stranding','Sekiro: Shadows Die Twice','Detroit: Become Human','Days Gone','Hogwarts Legacy','Resident Evil 4','No Man’s Sky']
sizes=[76.4,45.2,105.3,48.1,39.8,55.6,24.8,42.7,38.4,79.2,32.1,14.6]
imgs=['data:image/jpeg;base64,'+base64.b64encode((ASSETS/f'{i}.jpg').read_bytes()).decode() for i in range(12)]
class SVG:
 def __init__(self,title):
  self.p=[f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1600" height="1040" viewBox="0 0 1600 1040" role="img"><title>{title}</title><desc>CPM 界面设计稿。下载速度、容量与任务状态均为演示数据。</desc><style>text{{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Segoe UI",sans-serif}}a{{cursor:pointer}}</style><defs><linearGradient id="fade" x2="0" y2="1"><stop stop-color="#13131b" stop-opacity="0"/><stop offset="1" stop-color="#101018" stop-opacity=".95"/></linearGradient></defs>'];self.rect(0,0,1600,1040,BG)
 def rect(self,x,y,w,h,c,r=0,stroke=None):self.p.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{c}"'+(f' stroke="{stroke}" stroke-width="1.5"' if stroke else '')+'/>')
 def text(self,x,y,s,size=16,c=WHITE,weight=400):self.p.append(f'<text x="{x}" y="{y}" fill="{c}" font-size="{size}" font-weight="{weight}">{escape(str(s))}</text>')
 def line(self,x1,y1,x2,y2,c=LINE,w=1):self.p.append(f'<path d="M{x1} {y1}L{x2} {y2}" stroke="{c}" stroke-width="{w}" fill="none"/>')
 def image(self,i,x,y,w,h,r=6):
  k='c'+str(len(self.p));self.p.append(f'<defs><clipPath id="{k}"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}"/></clipPath></defs><image xlink:href="{imgs[i]}" x="{x}" y="{y}" width="{w}" height="{h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#{k})"/>')
 def link(self,to):self.p.append(f'<a xlink:href="{to}">')
 def endlink(self):self.p.append('</a>')
 def button(self,x,y,w,label,active=False):self.rect(x,y,w,36,WHITE if active else '#272731',18);self.text(x+18,y+24,label,13,BG if active else '#c1c0cc',600)
 def icon(self,x,y,kind,c=MUTED):
  paths={'search':'M14 14l5 5 M16 9a7 7 0 1 1-14 0a7 7 0 1 1 14 0','filter':'M1 4h20M1 11h20M1 18h20M6 1v6M16 8v6M9 15v6','grid':'M2 2h7v7H2zM13 2h7v7h-7zM2 13h7v7H2zM13 13h7v7h-7z','download':'M11 1v13M5 8l6 6 6-6M2 16v5h18v-5','server':'M2 2h18v7H2zM2 13h18v7H2zM5 5h2M5 16h2','host':'M3 3h16v12H3zM7 20h8M11 15v5','settings':'M11 4a7 7 0 1 1 0 14a7 7 0 1 1 0-14M11 8a3 3 0 1 0 0 6a3 3 0 1 0 0-6'}
  self.p.append(f'<path transform="translate({x} {y})" d="{paths[kind]}" stroke="{c}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>')
 def save(self,name): (OUT/name).write_text(''.join(self.p)+'</svg>')
def shell(s,mode,page):
 labels=['游戏库','安装任务','文件服务器','PS4 主机','设置'];icons=['grid','download','server','host','settings'];active=0 if page=='library' else 1
 if mode=='controller':
  s.text(66,66,'CPM',25,WHITE,800)
  for i,x in enumerate([207,355,532,731,906]):
   if i<2:s.link(f'cpm-{["library","tasks"][i]}-{mode}.svg')
   if i==active:s.rect(x,29,119,55,WHITE,29)
   s.text(x+23,65,labels[i],21,BG if i==active else MUTED,650 if i==active else 500)
   if i<2:s.endlink()
  s.text(1324,63,'PS4 · 客厅',16,'#b7b6c4');s.text(1480,63,'21:08',16,'#b7b6c4');return 66,1462
 if mode=='fixed':
  s.rect(0,0,202,1040,'#171720');s.line(201,0,201,1040,'#242430');s.text(32,66,'CPM',25,WHITE,800)
  for i in range(5):
   y=134+i*65
   if i<2:s.link(f'cpm-{["library","tasks"][i]}-{mode}.svg')
   if i==active:s.rect(17,y-15,168,49,WHITE,25)
   s.icon(33,y,icons[i],BG if i==active else MUTED);s.text(68,y+17,labels[i],16,BG if i==active else MUTED,600)
   if i<2:s.endlink()
  s.text(32,945,'●  PS4 · 客厅',13,'#c0c3cf');s.text(32,970,'192.168.1.108',12,MUTED)
  return 242,1316
 s.rect(18,320,70,366,'#23232e',28,'#353540');s.text(26,65,'CPM',23,WHITE,800)
 for i in range(5):
  y=340+i*67
  if i<2:s.link(f'cpm-{["library","tasks"][i]}-{mode}.svg')
  if i==active:s.rect(26,y-7,54,54,WHITE,20)
  s.icon(42,y+9,icons[i],BG if i==active else MUTED)
  if i<2:s.endlink()
 return 130,1398

def footer(s,mode,page):
 s.rect(0 if mode=='controller' else 202 if mode=='fixed' else 108,976,1600,64,'#191923')
 x=66 if mode=='controller' else 242 if mode=='fixed' else 130
 s.text(x,1016,'God of War' if page=='library' else 'Cyberpunk 2077',16,WHITE,600)
 s.text(x+160,1016,'45.2 GB' if page=='library' else '下载中 · 47%',14,MUTED)
 if mode=='controller':
  for xx,t in [(955,'×   打开' if page=='library' else '×   暂停 / 继续'),(1100,'○   返回'),(1244,'△   选项'),(1388,'L1 / R1   切换页面')]:s.text(xx,1016,t,14,'#b7b6c4',500)
 else:
  s.text(1220,1016,'PC · '+('固定导航' if mode=='fixed' else '浮动导航'),13,MUTED);s.text(1440,1016,'演示数据',12,'#646473')

def library(mode,filtered=False):
 s=SVG('CPM 游戏库 · '+mode+(' · 筛选展开' if filtered else ''));x,w=shell(s,mode,'library');top=148 if mode=='controller' else 78
 s.text(x,top,'全部游戏',28,WHITE,700);s.text(x+144,top-2,'12',17,MUTED)
 # Left filter entry; right search collapsed
 s.link('cpm-library-filter.svg' if not filtered else 'cpm-library-controller.svg');s.rect(x,top+23,88,36,'#252530',18);s.icon(x+13,top+31,'filter');s.text(x+43,top+47,'筛选',14,'#c8c7d2');s.endlink()
 s.text(x+108,top+47,'NAS / PS4 / Packages',14,MUTED)
 s.rect(x+w-42,top-26,42,38,'#252530',19);s.icon(x+w-31,top-17,'search')
 s.text(x+w-169,top-1,'名称排序⌄',15,'#c8c7d2')
 y=top+77;gap=26;cw=(w-gap*5)/6;ch=cw*1.5
 s.p.append(f'<defs><clipPath id="viewport"><rect x="{x-8}" y="{y-8}" width="{w+16}" height="{970-y}"/></clipPath></defs><g clip-path="url(#viewport)">')
 for i in range(12):
  xx=x+(i%6)*(cw+gap);yy=y+(i//6)*(ch+48)
  s.image(i,xx,yy,cw,ch)
  if i==1:
   s.rect(xx-6,yy-6,cw+12,ch+12,'none',12,BLUE);s.rect(xx,yy+ch-88,cw,88,'url(#fade)',6);s.rect(xx+14,yy+ch-45,cw-28,32,WHITE,18);s.text(xx+cw/2-28,yy+ch-23,'查看详情',13,BG,600)
  title=names[i]
  if len(title)>26:title=title[:23]+'…'
  s.text(xx,yy+ch+26,title,15,WHITE,550);s.text(xx,yy+ch+49,f'PS4 · {sizes[i]} GB',13,MUTED)
 s.p.append('</g>');s.rect(1584,y,3,740,'#292934',2);s.rect(1584,y,3,300,'#676675',2)
 if filtered:
  px=x;py=top+68;s.rect(px+6,py+9,370,530,'#00000066',16);s.rect(px,py,370,530,'#252530',16,'#42424f');s.text(px+24,py+39,'筛选与显示',20,WHITE,650)
  s.text(px+24,py+81,'内容类型',13,MUTED)
  for j,(t,ww) in enumerate([('全部',70),('本体',70),('补丁',70),('DLC',70)]):s.button(px+24+j*80,py+96,ww,t,j==0)
  s.text(px+24,py+169,'下载状态',13,MUTED);s.rect(px+24,py+184,322,40,'#1c1c26',8);s.text(px+39,py+211,'全部状态',14);s.text(px+319,py+210,'⌄',16,MUTED)
  s.text(px+24,py+262,'排序方式',13,MUTED);s.rect(px+24,py+277,322,40,'#1c1c26',8);s.text(px+39,py+304,'名称 A → Z',14);s.text(px+319,py+303,'⌄',16,MUTED)
  s.text(px+24,py+355,'封面尺寸',13,MUTED);s.text(px+302,py+355,'中',13,MUTED);s.line(px+30,py+388,px+338,py+388,'#4a4a59',4);s.line(px+30,py+388,px+190,py+388,WHITE,4);s.rect(px+182,py+380,16,16,WHITE,8)
  s.line(px+24,py+424,px+346,py+424);s.text(px+24,py+471,'重置',14,MUTED);s.link('cpm-library-controller.svg');s.button(px+238,py+446,108,'完成',True);s.endlink()
 footer(s,mode,'library');s.save('cpm-library-filter.svg' if filtered else f'cpm-library-{mode}.svg')

def chart(s,x,y,w,seed):
 for j in range(52):
  h=10+abs(math.sin(j*.18+seed)*29+math.cos(j*.54)*12);s.rect(round(x+j*w/52,2),round(y+61-h,2),round(w/52-2,2),round(h,2),'#529ad1',1)
 points=' '.join(f'{x+j*w/51:.2f},{y+25+math.sin(j*.14+seed)*13+math.cos(j*.42)*3:.2f}' for j in range(52));s.p.append(f'<polyline points="{points}" fill="none" stroke="#a8cf87" stroke-width="2"/>');s.line(x,y+64,x+w,y+64,'#3c4051')
 s.text(x,y+87,'↓ 网络',11,'#69baff');s.text(x+70,y+87,'— 磁盘',11,'#a8cf87');s.text(x+w-60,y+87,'最近 60 秒',10,MUTED)

def tasks(mode):
 s=SVG('CPM 安装任务 · '+mode);x,w=shell(s,mode,'tasks');top=148 if mode=='controller' else 78
 s.text(x,top,'安装任务',28,WHITE,700);s.text(x+145,top-2,'5',17,MUTED);s.text(x+w-173,top-1,'PS4 · 客厅  ●',14,'#b9c7b1')
 sy=top+35
 for dx,title,value,unit in [(0,'总下载速度','61.5','MB/s'),(250,'磁盘写入','84.2','MB/s'),(495,'正在下载','2','个游戏'),(700,'主机可用空间','256','GB')]:
  s.text(x+dx,sy,title,12,MUTED);s.text(x+dx,sy+38,value,28,WHITE,600);s.text(x+dx+ (77 if len(value)>3 else 57 if len(value)>1 else 29),sy+36,unit,13,MUTED)
 s.button(x+w-112,sy+4,112,'全部暂停');s.line(x,sy+64,x+w,sy+64)
 rowy=sy+91;s.text(x,rowy,'正在下载',16,WHITE,600);s.text(x+89,rowy,'2',13,MUTED)
 for idx,(gi,p,done,speed,left,disk) in enumerate([(0,47,'35.9','42.9','16 分 07 秒','58.6'),(1,72,'32.5','18.6','11 分 39 秒','25.6')]):
  yy=rowy+18+idx*205;s.rect(x,yy,w,185,PANEL,10)
  if idx==0 and mode=='controller':s.rect(x-4,yy-4,w+8,193,'none',13,BLUE)
  s.image(gi,x+18,yy+18,98,148)
  bx=x+140;right=x+w-24;graphw=280;graphx=right-graphw-84;pw=graphx-bx-40
  s.text(bx,yy+38,names[gi],22,WHITE,650);s.text(bx,yy+61,'本体 · NAS / PS4 → PS4 · 客厅',12,MUTED)
  s.text(bx,yy+97,f'下载中  {p}%',14,BLUE,600);s.text(bx+pw-122,yy+97,'剩余 '+left,12,MUTED)
  s.rect(bx,yy+110,pw,5,'#3b3c4b',3);s.rect(bx,yy+110,pw*p/100,5,BLUE,3)
  s.text(bx,yy+140,f'{done} GB / {sizes[gi]} GB',14,'#cac9d4');s.text(bx,yy+164,f'下载 {speed} MB/s     ·     写入 {disk} MB/s',12,MUTED)
  chart(s,graphx,yy+51,graphw,idx+1)
  s.rect(right-53,yy+63,53,53,WHITE,15);s.text(right-34,yy+98,'Ⅱ',24,BG,600);s.text(right-40,yy+149,'暂停',12,MUTED)
 queue=rowy+431;s.text(x,queue,'下载队列',16,WHITE,600);s.text(x+89,queue,'2',13,MUTED);s.text(x+w-234,queue,'按队列顺序自动开始下载',12,MUTED)
 for idx,(gi,status,p,amount,action) in enumerate([(2,'已暂停',18,'19.0','继续'),(3,'等待中',0,'0','立即下载')]):
  yy=queue+17+idx*102;s.rect(x,yy,w,90,'#191922',8);s.image(gi,x+18,yy+12,45,66);s.text(x+82,yy+35,names[gi],17,WHITE,600);s.text(x+82,yy+60,'PS4 · 本体 · PS4 客厅',12,MUTED)
  bx=x+w*.44;pw=w*.30;s.text(bx,yy+28,f'{status}  {p}%',12,'#b4b3c3');s.rect(bx,yy+40,pw,4,'#353541',2)
  if p:s.rect(bx,yy+40,pw*p/100,4,'#868598',2)
  s.text(bx,yy+67,f'{amount} GB / {sizes[gi]} GB',12,MUTED);s.button(x+w-172,yy+26,104,action);s.text(x+w-45,yy+49,'×',22,MUTED)
 done=queue+237
 if done<947:
  s.text(x,done,'已完成',15,WHITE,600);s.text(x+78,done,'1',13,MUTED);s.text(x+125,done,'✓  Sekiro: Shadows Die Twice',14,'#a9c59a');s.text(x+w-168,done,'24.8 GB · 安装完成',12,MUTED)
 footer(s,mode,'tasks');s.save(f'cpm-tasks-{mode}.svg')
for m in ['controller','fixed','floating']:library(m);tasks(m)
library('controller',True)
print('Generated',len(list(OUT.glob('*.svg'))),'SVGs')
