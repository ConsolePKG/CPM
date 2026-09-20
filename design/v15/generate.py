from pathlib import Path
source=(Path(__file__).parent.parent/'v13/generate.py').read_text().split("for m in ['controller','fixed','floating']:")[0]
source=source.replace('y=top+77;gap=26','y=top+71;gap=26').replace('(i//6)*(ch+48)','(i//6)*(ch+60)').replace('{970-y}', '{984-y}')
exec(compile(source,'v13-base','exec'))
base_icon=SVG.icon
def revised_icon(self,x,y,kind,c=MUTED):
 if kind!='settings':return base_icon(self,x,y,kind,c)
 self.p.append(f'<g transform="translate({x} {y})" stroke="{c}" stroke-width="1.6" fill="none"><circle cx="11" cy="11" r="7"/><circle cx="11" cy="11" r="2.8"/>')
 for angle in range(0,360,45):self.p.append(f'<path transform="rotate({angle} 11 11)" d="M9 4V1h4v3"/>')
 self.p.append('</g>')
SVG.icon=revised_icon

def shell(s,mode,page):
 s.text(66,65,'CPM',26,WHITE,800)
 for i,(label,x) in enumerate([('游戏库',646),('安装任务',806)]):
  selected=(page=='library' and i==0) or (page=='tasks' and i==1)
  s.link(f'cpm-{["library","tasks"][i]}-controller.svg')
  if selected:s.rect(x,29,148,55,WHITE,28)
  s.text(x+39 if i==0 else x+32,65,label,21,BG if selected else MUTED,650 if selected else 500);s.endlink()
 s.link('cpm-host-switch.svg');s.rect(1267,34,177,46,'#22222c',23);s.icon(1285,46,'host','#c3c2ce');s.text(1320,63,'PS4 · 客厅',15,WHITE,500);s.text(1417,62,'⌄',17,MUTED);s.endlink()
 s.link('cpm-settings-general.svg');s.rect(1482,34,46,46,'#22222c',23);s.icon(1494,46,'settings','#d0cfda');s.endlink()
 return 66,1462

def footer(s,mode,page):
 s.rect(0,976,1600,64,'#191923');s.text(66,1016,'God of War' if page=='library' else 'Cyberpunk 2077',16,WHITE,600);s.text(226,1016,'45.2 GB' if page=='library' else '下载中 · 47%',14,MUTED)
 for x,t in [(955,'×   打开' if page=='library' else '×   暂停 / 继续'),(1100,'○   返回'),(1244,'△   选项'),(1388,'L1 / R1   切换页面')]:s.text(x,1016,t,14,'#b7b6c4',500)

def footer(s,mode,page):
 pass

def library(mode,filtered=False,scrolled=False):
 s=SVG('CPM 游戏库 · '+('滚动后固定模糊顶栏' if scrolled else '紧凑工具栏'))
 x=66;w=1462;cw=222;ch=333;gap=26;start=184-(188 if scrolled else 0)
 def cards():
  for i in range(12):
   xx=x+(i%6)*(cw+gap);yy=start+(i//6)*(ch+70)
   s.image(i,xx,yy,cw,ch)
   if i==1:
    s.rect(xx-6,yy-6,cw+12,ch+12,'none',12,BLUE);s.rect(xx,yy+ch-88,cw,88,'url(#fade)',6);s.rect(xx+14,yy+ch-45,cw-28,32,WHITE,18);s.text(xx+cw/2-28,yy+ch-23,'查看详情',13,BG,600)
   title=names[i] if len(names[i])<27 else names[i][:23]+'…'
   s.text(xx,yy+ch+26,title,15,WHITE,550);s.text(xx,yy+ch+49,f'PS4 · {sizes[i]} GB',13,MUTED)
 s.p.append('<defs><clipPath id="game-area"><rect x="0" y="172" width="1600" height="868"/></clipPath><clipPath id="header-area"><rect width="1600" height="172"/></clipPath><filter id="glass-blur" x="-10%" y="-40%" width="120%" height="180%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="18"/></filter></defs>')
 s.p.append('<g clip-path="url(#game-area)">');cards();s.p.append('</g>')
 if scrolled:
  s.p.append('<g clip-path="url(#header-area)"><g filter="url(#glass-blur)" opacity=".65">');cards();s.p.append('</g>');s.rect(0,0,1600,172,'#13131bc9');s.p.append('</g>');s.line(0,171,1600,171,'#ffffff16')
 else:s.rect(0,0,1600,172,BG)
 shell(s,mode,'library')
 # A single consolidated row; source and count share the same baseline.
 s.link('cpm-library-filter.svg');s.rect(66,118,40,36,'#252530',12);s.icon(76,125,'filter');s.endlink()
 s.text(122,143,'全部游戏',18,WHITE,650);s.text(212,143,'12',14,MUTED)
 s.line(244,128,244,145,'#3b3b46');s.text(263,143,'NAS / PS4 / Packages',13,MUTED)
 s.text(1358,143,'名称排序⌄',14,'#b9b8c5');s.rect(1482,113,46,46,'#252530',23);s.icon(1494,126,'search')
 s.rect(1584,184,3,830,'#292934',2);s.rect(1584,320 if scrolled else 184,3,300,'#676675',2)
 if filtered:
  px=66;py=164;s.rect(px+5,py+7,360,468,'#00000055',14);s.rect(px,py,360,468,'#252530',14,'#42424f');s.text(px+24,py+38,'筛选与显示',19,WHITE,600)
  s.text(px+24,py+82,'内容类型',13,MUTED)
  for j,t in enumerate(['全部','本体','补丁','DLC']):s.button(px+24+j*79,py+99,70,t,j==0)
  for yy,title,value in [(170,'下载状态','全部状态'),(264,'排序方式','名称 A → Z')]:
   s.text(px+24,py+yy,title,13,MUTED);s.rect(px+24,py+yy+15,312,38,'#1c1c26',7);s.text(px+40,py+yy+41,value,14);s.text(px+310,py+yy+40,'⌄',15,MUTED)
  s.text(px+24,py+354,'封面尺寸',13,MUTED);s.line(px+28,py+379,px+330,py+379,'#4a4a59',4);s.line(px+28,py+379,px+182,py+379,WHITE,4);s.rect(px+174,py+371,16,16,WHITE,8)
  s.text(px+24,py+439,'重置',14,MUTED);s.link('cpm-library-controller.svg');s.button(px+234,py+414,102,'完成',True);s.endlink()
 s.save('cpm-library-filter.svg' if filtered else 'cpm-library-scrolled.svg' if scrolled else 'cpm-library-controller.svg')

library('controller');tasks('controller');library('controller',True);library('controller',scrolled=True)
# Host popover shown over the unchanged library.
p=OUT/'cpm-library-controller.svg';base=p.read_text();s=SVG('切换主机');s.p=[base[:-6]]
s.rect(1150,93,375,322,'#00000044',15);s.rect(1144,87,375,322,'#252530',15,'#41414e');s.text(1166,121,'安装到',13,MUTED)
s.rect(1158,139,347,74,'#363644',9);s.icon(1174,157,'host',WHITE);s.text(1212,166,'PS4 · 客厅',16,WHITE,600);s.text(1212,190,'192.168.1.108:12801',12,MUTED);s.text(1468,176,'✓',18,WHITE)
s.icon(1174,236,'host',MUTED);s.text(1212,245,'PS4 · 书房',16);s.text(1212,269,'192.168.1.109:12801',12,MUTED)
s.line(1166,289,1498,289);s.link('cpm-add-host.svg');s.text(1174,321,'＋',21);s.text(1212,320,'添加主机',15);s.endlink();s.link('cpm-settings-hosts.svg');s.text(1212,379,'管理所有主机  →',14,MUTED);s.endlink();s.save('cpm-host-switch.svg')

sections=[('应用设置',[('general','常规'),('library','游戏库'),('transfer','下载与安装')]),('连接管理',[('servers','文件服务器'),('hosts','PS4 主机')]),('应用信息',[('advanced','更新与调试'),('about','关于 CPM')])]
def settings_shell(key,title,desc):
 s=SVG('CPM 全屏设置 · '+title);s.rect(0,0,480,1040,'#191922');s.text(256,96,'CPM',24,WHITE,800);s.text(256,125,'设置',13,MUTED)
 y=188
 for category,items in sections:
  s.text(256,y,category,12,'#777786',650);y+=25
  for ident,label in items:
   s.link(f'cpm-settings-{ident}.svg')
   if key==ident:s.rect(242,y-3,210,42,'#343440',7)
   s.text(256,y+24,label,16,WHITE if key==ident else '#a6a5b4',600 if key==ident else 400);s.endlink();y+=49
  y+=27
 s.line(256,793,433,793);s.text(256,822,'CPM · 桌面端',12,'#747482')
 s.text(540,107,title,29,WHITE,700);s.text(540,142,desc,14,MUTED)
 s.link('cpm-library-controller.svg');s.rect(1344,76,42,42,'none',21,'#686877');s.text(1356,105,'×',25,MUTED);s.text(1351,140,'ESC',11,MUTED);s.endlink()
 return s

def toggle(s,y,title,desc,on=True):
 s.text(540,y,title,18,WHITE,550)
 for n,line in enumerate(desc if isinstance(desc,list) else [desc]):s.text(540,y+28+n*22,line,14,MUTED)
 s.rect(1206,y-18,46,26,WHITE if on else '#444450',13);s.rect(1230 if on else 1210,y-14,18,18,BG if on else '#c2c2cf',9)
 s.line(540,y+83,1252,y+83)

s=settings_shell('general','常规','应用外观与基本偏好。');toggle(s,223,'显示应用 Logo','在导航品牌区域显示应用 Logo。',True);s.save('cpm-settings-general.svg')
s=settings_shell('library','游戏库','调整游戏内容的组织方式与打开行为。');toggle(s,223,'聚合模式',['将补丁与附加内容关联到游戏本体，不单独出现在游戏列表。','可在游戏详情中查看；建议搭配文件服务器的递归查询使用。']);toggle(s,369,'显示 PKG 原始标题','关闭时使用文件名作为游戏标题。',False)
s.text(540,515,'点击游戏时',18,WHITE,550);s.text(540,544,'选择点击游戏封面的默认行为。',14,MUTED)
for xx,label,active in [(540,'查看详情',True),(900,'直接安装',False)]:
 s.rect(xx,573,352,88,'#20202b',9,BLUE if active else '#383844');s.rect(xx+20,600,20,20,'none',10,BLUE if active else '#646472');
 if active:s.rect(xx+25,605,10,10,BLUE,5)
 s.text(xx+56,616,label,16,WHITE,550)
s.save('cpm-settings-library.svg')
s=settings_shell('transfer','下载与安装','安装任务的下载链接与传输偏好。');toggle(s,223,'强制 WebDAV 下载链接使用 HTTP',['向 PS4 发送安装任务前，将 WebDAV 下载链接转换为 HTTP。']);s.save('cpm-settings-transfer.svg')
s=settings_shell('advanced','更新与调试','桌面端专属功能。');toggle(s,223,'接收测试版更新','启用后可获取 Beta 版本更新。')
for y,title,desc,label in [(374,'开发者工具','查看 Console、Network 等信息，帮助定位问题。','打开'),(510,'应用日志','打开日志，查看运行记录与错误信息。','打开')]:
 s.text(540,y,title,18,WHITE,550);s.text(540,y+29,desc,14,MUTED);s.button(1163,y-19,89,label);s.line(540,y+74,1252,y+74)
s.save('cpm-settings-advanced.svg')
s=settings_shell('about','关于 CPM','应用信息与更新。');s.rect(540,194,94,94,WHITE,23);s.text(553,252,'CPM',25,BG,800);s.text(659,230,'CPM',25,WHITE,700);s.text(659,266,'1.0.0-beta.8',15,MUTED);s.button(1124,224,128,'检查更新');s.line(540,333,1252,333);s.text(540,393,'开源项目',18,WHITE,550);s.text(540,425,'在 GitHub 查看项目，或为它点一颗 Star。',14,MUTED);s.button(1124,383,128,'GitHub ↗');s.save('cpm-settings-about.svg')
s=settings_shell('hosts','PS4 主机','管理安装目标主机。');s.link('cpm-add-host.svg');s.button(1124,187,128,'＋ 添加主机',True);s.endlink()
for y,title,url,active in [(252,'PS4 · 客厅','192.168.1.108:12801',True),(400,'PS4 · 书房','192.168.1.109:12801',False)]:
 s.rect(540,y,712,126,'#20202a',9);s.icon(563,y+25,'host');s.text(605,y+42,title,19,WHITE,600);s.text(605,y+72,'http://'+url,14,MUTED);s.text(605,y+101,'当前安装主机' if active else '设为当前主机',12,BLUE if active else MUTED);s.text(1150,y+49,'编辑',14,MUTED);s.text(1200,y+49,'删除',14,MUTED)
s.save('cpm-settings-hosts.svg')
s=settings_shell('servers','文件服务器','管理游戏文件来源与查询方式。');s.button(1096,187,156,'＋ 添加服务器',True)
s.rect(540,252,712,170,'#20202a',9);s.icon(563,278,'server');s.text(605,293,'NAS / PS4',20,WHITE,600);s.text(605,325,'WebDAV · http://192.168.1.100:5005',14,MUTED);s.text(605,357,'目录 /PS4/Packages · 递归查询已开启',14,MUTED);s.text(605,391,'当前文件服务器',12,BLUE);s.text(1150,293,'编辑',14,MUTED);s.text(1200,293,'删除',14,MUTED)
s.text(540,476,'本地文件服务器',18,WHITE,550);s.text(540,508,'桌面端支持选择本地目录，并配置端口与网络接口。',14,MUTED);s.save('cpm-settings-servers.svg')
s=settings_shell('hosts','添加 PS4 主机','配置主机别名与 Remote Package Installer 地址。')
for y,label,value in [(216,'别名','PS4 · 卧室'),(337,'主机地址 *','http://     192.168.1.110:12801')]:
 s.text(540,y,label,14,'#c7c6d0',600);s.rect(540,y+18,712,48,'#20202b',6,'#383844');s.text(556,y+49,value,16,'#aaa9b9')
s.text(540,432,'请填写 IP 与端口，常用端口为 12800 或 12801。',13,MUTED);s.text(540,464,'主机上需要运行 Remote Package Installer。',13,MUTED);s.line(540,511,1252,511)
s.link('cpm-settings-hosts.svg');s.button(921,544,88,'取消');s.endlink();s.button(1021,544,110,'连接测试');s.button(1143,544,110,'确认添加',True);s.save('cpm-add-host.svg')
# Browsable SVG review page. Assets remain native SVG documents.
files=[('游戏库','cpm-library-controller.svg'),('滚动模糊','cpm-library-scrolled.svg'),('安装任务','cpm-tasks-controller.svg'),('切换主机','cpm-host-switch.svg'),('全屏设置','cpm-settings-general.svg'),('游戏库设置','cpm-settings-library.svg'),('添加主机','cpm-add-host.svg')]
(OUT/'index.html').write_text('<!doctype html><meta charset="utf-8"><title>CPM SVG 设计稿 v15</title><style>body{margin:0;background:#0d0d13;color:#aaa;font:13px system-ui}header{padding:12px 24px;display:flex;gap:24px}a{color:#ccc;text-decoration:none}iframe{width:100%;height:calc(100vh - 44px);border:0}</style><header>'+''.join(f'<a target="screen" href="{f}">{t}</a>' for t,f in files)+'</header><iframe name="screen" src="cpm-library-controller.svg"></iframe>')
print('SVG files:',len(list(OUT.glob('*.svg'))))
