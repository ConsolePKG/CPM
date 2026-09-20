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
