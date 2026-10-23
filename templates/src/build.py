import pathlib, math
from playwright.sync_api import sync_playwright
from PIL import Image
from PIL.PngImagePlugin import PngInfo
W, H = 1404, 1872
here = pathlib.Path(__file__).resolve().parent
FONTS = here / "fonts"
STARP = "M12 1.5 14.3 9.7 22.5 12 14.3 14.3 12 22.5 9.7 14.3 1.5 12 9.7 9.7z"
STAR = f"<svg class=st viewBox='0 0 24 24'><path d='{STARP}'/></svg>"
CSS = """
@font-face{font-family:EBG;src:url(fonts/ebg-roman.woff2);font-weight:400 600}
@font-face{font-family:EBG;src:url(fonts/ebg-italic.woff2);font-style:italic;font-weight:400 600}
@font-face{font-family:CG;src:url(fonts/cg-roman.woff2);font-weight:400 600}
@font-face{font-family:CG;src:url(fonts/cg-italic.woff2);font-style:italic;font-weight:400 600}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1404px;height:1872px;background:#fff;color:#111}
body{padding:44px 56px 34px;font-family:EBG;display:flex;flex-direction:column}
.mast{display:flex;align-items:flex-end;justify-content:space-between;gap:40px;padding-bottom:12px}
.mast h1{font-family:CG;font-weight:500;font-size:50px;line-height:1;white-space:nowrap}
.fields{display:flex;gap:34px;font-size:24px;font-variant:small-caps;letter-spacing:.09em;color:#3a3a3a;flex:1;justify-content:flex-end}
.f{display:flex;align-items:flex-end;gap:10px;white-space:nowrap}
.f b{display:block;border-bottom:1.5px solid #8a8a8a;height:28px;font-weight:400}
.rule{height:1.5px;background:#222;margin-bottom:22px}
.lbl{display:flex;align-items:center;gap:12px;font-variant:small-caps;letter-spacing:.14em;font-size:25px;color:#222;margin:0 0 10px;white-space:nowrap}
.lbl .st{width:15px;height:15px;fill:#444;flex:none}
.grid{border:1.5px solid #6e6e6e;background-image:
  linear-gradient(#a9a9a9 1px,transparent 1px),linear-gradient(90deg,#a9a9a9 1px,transparent 1px),
  linear-gradient(#d2d2d2 1px,transparent 1px),linear-gradient(90deg,#d2d2d2 1px,transparent 1px);
  background-size:220px 220px,220px 220px,44px 44px,44px 44px;background-position:-1px -1px}
.grid.light{border-color:#9a9a9a;background-image:linear-gradient(#dcdcdc 1px,transparent 1px),linear-gradient(90deg,#dcdcdc 1px,transparent 1px);background-size:44px 44px}
.ruled{background-image:repeating-linear-gradient(to bottom,transparent 0 50.5px,#b4b4b4 50.5px 52px)}
.top{border-top:2px solid #222}
.foot{display:flex;align-items:baseline;justify-content:center;gap:14px;padding-top:12px;white-space:nowrap}
.foot q{font-family:CG;font-style:italic;font-size:21px;color:#333;quotes:"\\201C" "\\201D"}
.foot small{font-size:15px;font-variant:small-caps;letter-spacing:.12em;color:#666}
.dia{display:flex;align-items:center;gap:12px;margin:10px 0 0}
.dia::before,.dia::after{content:'';flex:1;height:1.2px;background:linear-gradient(90deg,transparent,#888 30%,#888 70%,transparent)}
.dia i{width:8px;height:8px;border:1.3px solid #555;transform:rotate(45deg)}
table{border-collapse:collapse;width:100%;font-size:22px}
th{font-weight:400;font-variant:small-caps;letter-spacing:.1em;color:#333;text-align:left;padding:4px 10px 8px;border-bottom:2px solid #222;white-space:nowrap}
td{height:58px;border-bottom:1.5px solid #b4b4b4;padding:0 10px;color:#777;font-family:CG;font-size:24px}
td+td,th+th{border-left:1.5px solid #d0d0d0}
.kv{display:flex;flex-wrap:wrap;column-gap:22px;font-size:23px;font-variant:small-caps;letter-spacing:.08em;color:#3a3a3a}
.kv>span{display:flex;align-items:flex-end;gap:12px;white-space:nowrap;padding-top:16px}
.kv>span b{display:block;border-bottom:1.5px solid #9a9a9a;height:30px;flex:1;font-weight:400}
.o{display:inline-block;width:22px;height:22px;border:1.8px solid #555;border-radius:50%;vertical-align:-4px}
.sq{display:inline-block;width:22px;height:22px;border:1.8px solid #555;vertical-align:-4px}
.yn{white-space:nowrap;font-size:22px;font-variant:small-caps;letter-spacing:.08em;color:#3a3a3a;display:flex;gap:16px;align-items:center;padding-top:16px}
.yn span{display:inline-flex;align-items:center;gap:6px}
.key{font-size:21px;color:#444;display:flex;gap:28px;justify-content:space-between;margin:0 0 12px;align-items:baseline;white-space:nowrap}
.key .k{font-variant:small-caps;letter-spacing:.1em;color:#222}
.key b{font-family:CG;font-size:25px;font-weight:600;color:#111;margin-right:5px}
.col{display:flex;flex-direction:column}
.small{font-size:20px;font-variant:small-caps;letter-spacing:.1em;color:#555}
"""
SNAP = """
() => {
 const els=[...document.querySelectorAll('.grid,.ruled')];
 const m=els.map(e=>{const r=e.getBoundingClientRect();const cs=getComputedStyle(e);
   return {e,h:r.height,w:r.width,bt:parseFloat(cs.borderTopWidth),bb:parseFloat(cs.borderBottomWidth),bl:parseFloat(cs.borderLeftWidth),br:parseFloat(cs.borderRightWidth),mt:parseFloat(cs.marginTop),mb:parseFloat(cs.marginBottom),ml:parseFloat(cs.marginLeft),mr:parseFloat(cs.marginRight)}});
 for(const o of m){const e=o.e;const p=e.classList.contains('ruled')?52:44;
   const ih=o.h-o.bt-o.bb; const nh=Math.floor(ih/p)*p; const dh=ih-nh;
   const row=getComputedStyle(e.parentElement).flexDirection==='row'&&getComputedStyle(e.parentElement).display.includes('flex'); if(!row) e.style.flex='none'; else e.style.alignSelf='flex-start'; e.style.height=(nh+o.bt+o.bb)+'px';
   e.style.marginTop=(o.mt+dh/2)+'px'; e.style.marginBottom=(o.mb+dh/2)+'px';
   if(e.classList.contains('grid') && !e.dataset.keepw){const iw=o.w-o.bl-o.br; const nw=Math.floor(iw/44)*44; const dw=iw-nw;
     e.style.width=(nw+o.bl+o.br)+'px'; e.style.marginLeft=(o.ml+dw/2)+'px'; e.style.marginRight=(o.mr+dw/2)+'px'; if(!row) e.style.alignSelf='flex-start';}
 }
}"""
def doc(title, fields, body):
    fs = "".join(f"<span class=f>{k}<b style='width:{w}px'></b></span>" for k, w in fields)
    return f"<!doctype html><html><head><meta charset=utf-8><style>{CSS}</style></head><body><div class=mast><h1>{title}</h1><div class=fields>{fs}</div></div><div class=rule></div>{body}</body></html>"
def lbl(t, right=""): return f"<div class=lbl>{STAR}{t}" + (f"<span style='margin-left:auto;font-size:21px;letter-spacing:.12em;color:#444'>{right}</span>" if right else "") + "</div>"
def foot(q, who): return f"<div class=dia><i></i></div><div class=foot><q>{q}</q><small>{who}</small></div>"
GAP = lambda h: f"<div style='height:{h}px;flex:none'></div>"
P = {}

# ---------- fixes ----------
P["the-blurt"] = doc("The <i>Blurt</i>", [("topic / section",520),("date",170)], f"""
{lbl("Recall")}<div class=grid style="height:1290px"></div>{GAP(18)}
{lbl("Gaps")}<div style="display:flex;flex:1"><div class="ruled top" style="flex:1;margin-right:22px"></div><div style="width:1.5px;background:#bbb"></div><div class="ruled top" style="flex:1;margin-left:22px"></div></div>
{foot("What I cannot create, I do not understand.","Richard Feynman")}""")

brk = "".join(f"<tr><td style='width:70px;text-align:center'>{i}</td><td></td><td style='width:150px'></td><td style='width:200px'></td></tr>" for i in range(1,9))
att = "".join(f"<tr><td style='width:70px;text-align:center'>{i}</td><td style='width:170px'></td><td style='width:190px'></td><td style='width:190px'></td><td style='width:170px'></td><td></td></tr>" for i in range(1,6))
P["the-time-trial"] = doc("The <i>Time Trial</i>", [("test",430),("date",170)], f"""
<div class=kv style="margin:-16px 0 22px"><span>length (min)<b style='width:110px;flex:none'></b></span><span>questions<b style='width:90px;flex:none'></b></span><span>points<b style='width:90px;flex:none'></b></span><span>min / point<b style='width:110px;flex:none'></b></span></div>
{lbl("Breakdown")}<table><tr><th>q</th><th>topic</th><th>points</th><th>budget (min)</th></tr>{brk}</table>{GAP(28)}
{lbl("Attempts")}<table><tr><th>#</th><th>date</th><th>total time</th><th>target</th><th>finished</th><th>slowest question</th></tr>{att}</table>{GAP(28)}
{lbl("Reflection")}<div class="ruled top" style="flex:1"></div>
{foot("The only reason for time is so that everything doesn&rsquo;t happen at once.","Ray Cummings, 1919 &middot; often credited to Einstein")}""")

er = "".join("<tr><td style='width:60px;height:1px'></td><td style='width:290px'></td><td style='width:170px;text-align:center;font-size:23px;letter-spacing:.32em;white-space:nowrap'>C A R T M</td><td></td><td style='width:80px;text-align:center'><span class=o></span></td></tr>" for _ in range(15))
P["the-error-log"] = doc("The <i>Error Log</i>", [("course",300),("exam / set",300)], f"""
<div class=key><span class=k>mistake types:</span><span><b>C</b>concept</span><span><b>A</b>algebra / arithmetic</span><span><b>R</b>misread the question</span><span><b>T</b>ran out of time</span><span><b>M</b>forgot a fact</span></div>
<div style="flex:1;display:flex;flex-direction:column"><table style="height:100%"><tr style="height:1px"><th>q</th><th>what I did</th><th>type</th><th>the correct move</th><th>redone</th></tr>{er}</table></div>{GAP(24)}
{lbl("Tally")}<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:18px;height:84px">{''.join(f"<div style='border:1.5px solid #8a8a8a;border-top:2px solid #222;padding:6px 12px;font-family:CG;font-size:28px;color:#333'>{t}</div>" for t in "CARTM")}</div>
{foot("Experience is the name every one gives to their mistakes.","Oscar Wilde, Lady Windermere&rsquo;s Fan, 1892")}""")

stars = "".join(f"<div style='height:44px;display:flex;align-items:center;justify-content:center'><svg viewBox='0 0 24 24' width=20 height=20><path d='{STARP}' fill=none stroke='#888' stroke-width=1.6 /></svg></div>" for _ in range(8))
P["the-research"] = doc("The <i>Research</i>", [("talk / paper",460),("date",170)], f"""
<div class=kv style="margin:-16px 0 22px"><span style="flex:1">speaker<b></b></span><span style="flex:1">field<b></b></span></div>
{lbl("What I think the abstract means")}<div class="ruled top" style="height:262px"></div>{GAP(18)}
{lbl("The literature gap it&rsquo;s trying to fill")}<div class="ruled top" style="height:210px"></div>{GAP(18)}
{lbl("Key formulae")}<div style="display:flex;align-items:flex-start"><div class=grid data-keepw=1 style="flex:1;height:356px;border-right:none"></div><div style="width:56px;height:356px;border:1.5px solid #6e6e6e;padding-top:1px">{stars}</div></div>{GAP(18)}
<div style="display:flex;gap:34px;flex:1">
 <div class=col style="flex:1">{lbl("Key words")}<div class="ruled top" style="flex:1"></div></div>
 <div class=col style="flex:1">{lbl("Questions")}<div class="ruled top" style="flex:1"></div></div></div>
{foot("If I have seen further it is by standing on the shoulders of Giants.","Isaac Newton, letter to Robert Hooke, 1675")}""")

cx=cy=180; r=170
rad="".join(f"<line x1={cx} y1={cy} x2={cx+r*math.sin(2*math.pi*k/10):.1f} y2={cy-r*math.cos(2*math.pi*k/10):.1f} stroke='#bdbdbd' stroke-width=1.6 stroke-dasharray='2 7' stroke-linecap=round />" for k in range(10))
tk="".join(f"<line x1={cx+r*math.sin(2*math.pi*k/20):.1f} y1={cy-r*math.cos(2*math.pi*k/20):.1f} x2={cx+(r-(14 if k%2==0 else 7))*math.sin(2*math.pi*k/20):.1f} y2={cy-(r-(14 if k%2==0 else 7))*math.cos(2*math.pi*k/20):.1f} stroke='#555' stroke-width=1.6 />" for k in range(20))
pie=f"<svg width=360 height=360 viewBox='0 0 360 360'>{rad}<circle cx={cx} cy={cy} r={r} fill=none stroke='#333' stroke-width=2 />{tk}<circle cx={cx} cy={cy} r=3 fill='#555'/></svg>"
leg="".join("<div style='display:flex;gap:10px;align-items:flex-end;height:46px'><b style='flex:1;border-bottom:1.5px solid #9a9a9a'></b><b style='width:70px;border-bottom:1.5px solid #9a9a9a'></b><span style='font-size:22px;color:#555'>%</span></div>" for _ in range(6))
ex="".join("<tr><td style='width:34%'></td><td style='width:26%'></td><td></td></tr>" for _ in range(4))
P["the-class-hub"] = doc("The <i>Class Hub</i>", [("course",420),("term",170)], f"""
<div style="display:flex;gap:34px;flex:1">
<div class=col style="width:770px">
 {lbl("Professor")}
 <div class=kv><span style="flex:1">name<b></b></span><span style="width:210px">title<b></b></span></div>
 <div class=kv><span style="flex:1">office<b></b></span><span style="flex:1">office hrs<b></b></span></div>
 <div class=kv style="margin-bottom:24px"><span style="flex:1">email<b></b></span></div>
 {lbl("Class")}
 <div class=kv><span style="flex:1">days<b></b></span><span style="flex:1">time<b></b></span><span style="flex:1">room<b></b></span></div>
 <div class=yn style="margin-bottom:24px"><span>attendance graded</span><span><i class=o></i>yes</span><span><i class=o></i>no</span><span style="margin-left:30px">slides posted</span><span><i class=o></i>yes</span><span><i class=o></i>no</span></div>
 {lbl("Grade breakdown")}
 <div style="display:flex;gap:28px;align-items:center;margin-bottom:24px">{pie}<div style="flex:1">{leg}</div></div>
 {lbl("Exams")}<table style="margin-bottom:24px"><tr><th>exam</th><th>date</th><th>covers</th></tr>{ex}</table>
 {lbl("From the syllabus")}<div class="ruled top" style="flex:1"></div>
</div>
<div class=col style="flex:1">{lbl("Tasks &amp; notes")}<div class="grid light" style="flex:1"></div></div>
</div>""")

# ---------- new ----------
tp="".join("<tr><td></td><td style='width:100px;text-align:center'><i class=o></i></td><td style='width:130px;text-align:center'><i class=o></i></td><td style='width:100px;text-align:center'><i class=o></i></td><td style='width:130px;text-align:center'><i class=o></i></td></tr>" for _ in range(12))
box=lambda t: f"<div class=col style='flex:1'>{lbl(t)}<div class='ruled top' style='flex:1'></div></div>"
P["the-exam-plan"] = doc("The <i>Exam Plan</i>", [("exam",430),("date",170)], f"""
<div class=kv style="margin:-16px 0 24px"><span style="flex:1.4">course<b></b></span><span style="flex:1">time<b></b></span><span style="flex:1">room<b></b></span><span style="width:190px">weight<b></b>%</span></div>
{lbl("Topics")}<table><tr><th>topic</th><th style="text-align:center">read</th><th style="text-align:center">practiced</th><th style="text-align:center">solid</th><th style="text-align:center">panicking</th></tr>{tp}</table>{GAP(26)}
<div class=kv style="margin:-16px 0 26px"><span style="flex:1">allowed materials<b></b></span></div>
<div style="display:flex;gap:34px;flex:1">{box("Three weeks out")}{box("Two weeks out")}</div>{GAP(22)}
<div style="display:flex;gap:34px;flex:1">{box("One week out")}{box("Final days")}</div>
{foot("Chance favors only the prepared mind.","Louis Pasteur, 1854")}""")

days=["mon","tue","wed","thu","fri","sat","sun"]
hrs=[(h,"") for h in ["6","7","8","9","10","11","12","1","2","3","4","5","6","7","8","9","10","11"]]
wk="".join(f"<tr><td style='width:62px;text-align:right;font-size:22px;color:#666;height:1px'>{h}</td>"+"<td></td>"*7+"</tr>" for h,_ in hrs)
P["the-study-week"] = doc("The <i>Study Week</i>", [("week of",220)], f"""
<div style="flex:1;display:flex"><table style="height:100%;table-layout:fixed"><tr style="height:1px"><th style="width:62px"></th>{''.join(f"<th style='text-align:center'>{d}</th>" for d in days)}</tr>{wk}</table></div>{GAP(24)}
<div style="display:flex;gap:34px;height:280px">{box("Important dates")}{box("Notes")}</div>
{foot("Take rest; a field that has rested gives a bountiful crop.","Ovid, Ars Amatoria")}""")


def month(n):
    Wt=1292; Hh=230; dx=Hh/math.tan(math.radians(60)); Ht=1676; tot=56
    dc=84; cw=96; nh=9; xs=[dc+i*cw for i in range(nh+1)]; xe=xs[-1]
    rh=(Ht-Hh-tot)/n
    L=[]
    for x in xs: L.append(f"<line x1={x} y1={Hh} x2={x+dx:.1f} y2=0 stroke='#777' stroke-width=1.5 />")
    L.append(f"<line x1={xs[0]+dx:.1f} y1=0.75 x2={xe+dx:.1f} y2=0.75 stroke='#777' stroke-width=1.5 />")
    L.append(f"<line x1=0 y1={Hh} x2={Wt} y2={Hh} stroke='#222' stroke-width=2 />")
    L.append(f"<text x=8 y={Hh-12} font-family=EBG font-size=22 fill='#333' style='font-variant:small-caps;letter-spacing:.1em'>day</text>")
    L.append(f"<text x={Wt-8} y={Hh-12} text-anchor=end font-family=EBG font-size=22 fill='#333' style='font-variant:small-caps;letter-spacing:.1em'>notes</text>")
    for i in range(n):
        y=Hh+(i+1)*rh
        L.append(f"<line x1=0 y1={y:.1f} x2={Wt} y2={y:.1f} stroke='#c4c4c4' stroke-width=1.3 />")
        L.append(f"<text x={dc/2} y={y-rh/2+8:.1f} text-anchor=middle font-family=CG font-size=24 fill='#666'>{i+1}</text>")
    yb=Hh+n*rh
    for x in xs[1:-1]: L.append(f"<line x1={x} y1={Hh} x2={x} y2={Ht} stroke='#8c8c8c' stroke-width=1.8 />")
    for x in (xs[0],xe): L.append(f"<line x1={x} y1={Hh} x2={x} y2={Ht} stroke='#8a8a8a' stroke-width=1.5 />")
    L.append(f"<line x1=0 y1={yb:.1f} x2={Wt} y2={yb:.1f} stroke='#222' stroke-width=2 />")
    L.append(f"<line x1=0 y1={Ht-1} x2={Wt} y2={Ht-1} stroke='#b4b4b4' stroke-width=1.3 />")
    L.append(f"<text x=8 y={yb+tot/2+7:.1f} font-family=EBG font-size=20 fill='#333' style='font-variant:small-caps;letter-spacing:.1em'>total</text>")
    svg=f"<svg width={Wt} height={Ht} viewBox='0 0 {Wt} {Ht}' style='flex:none'>{''.join(L)}</svg>"
    return doc("The <i>Month</i>", [("month",260)], svg)
for n in (28,30,31): P[f"the-month-{n}"]=month(n)
def todo(n): return "".join(f"<div style='display:flex;align-items:flex-end;gap:14px;flex:1;min-height:40px;border-bottom:1.5px solid #c4c4c4;padding-bottom:8px'><i class=sq></i><span style='font-family:CG;font-size:22px;color:#888;width:26px'>{i:02d}</span></div>" for i in range(1,15))
rc=150; rings=[120,96,72,48]; dl=["m","t","w","t","f","s","s"]
spk="".join(f"<line x1={rc+30*math.sin(2*math.pi*k/7):.1f} y1={rc-30*math.cos(2*math.pi*k/7):.1f} x2={rc+138*math.sin(2*math.pi*k/7):.1f} y2={rc-138*math.cos(2*math.pi*k/7):.1f} stroke='#999' stroke-width=1.4 stroke-dasharray='3 5'/>" for k in range(7))
lab="".join(f"<text x={rc+146*math.sin(2*math.pi*(k+.5)/7):.1f} y={rc-146*math.cos(2*math.pi*(k+.5)/7)+6:.1f} text-anchor=middle font-family=EBG font-size=19 fill='#555' style='font-variant:small-caps;letter-spacing:.08em'>{d}</text>" for k,d in enumerate(dl))
nums=''.join(f"<text x={rc+7} y={rc-q+5} font-family=CG font-size=15 fill='#777'>{i}</text>" for i,q in zip(range(1,5),[108,84,60,39]))
ring=f"<svg width=300 height=300 viewBox='0 0 300 300'>{spk}{''.join(f'<circle cx={rc} cy={rc} r={q} fill=none stroke=#333 stroke-width=1.6 />' for q in rings)}<circle cx={rc} cy={rc} r=30 fill=none stroke=#333 stroke-width=1.6 />{lab}{nums}</svg>"
hleg="".join(f"<div style='display:flex;align-items:flex-end;gap:10px;height:44px'><span style='font-family:CG;font-size:22px;color:#666'>{i}</span><b style='flex:1;border-bottom:1.5px solid #9a9a9a'></b></div>" for i in ["1","2","3","4"])
prog="<div style='position:relative;height:22px;border:1.6px solid #333;margin-top:18px'>"+"".join(f"<i style='position:absolute;left:{k*10}%;top:0;bottom:0;border-left:1px dotted #aaa'></i>" for k in range(1,10))+"</div>"
wins="".join("<div style='display:flex;align-items:flex-end;gap:14px;height:56px'><i style='width:16px;height:16px;border:1.6px solid #444;transform:rotate(45deg);margin:0 4px 6px'></i><b style='flex:1;border-bottom:1.5px solid #9a9a9a'></b></div>" for _ in range(3))
weekcols="".join(f"<div class=col style='flex:1;border-left:{'none' if i==0 else '1.5px solid #c4c4c4'};padding:0 12px'><div class=small style='border-bottom:1.5px solid #333;padding-bottom:4px'>{d}</div></div>" for i,d in enumerate(days))
def week(intent):
    return doc("The <i>Week</i>", [("week of",220)], f"""
<div style="display:flex;gap:40px;height:{900 if intent else 970}px">
 <div class=col style="width:610px">{lbl("To do","due")}<div class="top col" style="padding-top:2px;flex:1">{todo(0)}</div></div>
 <div class=col style="flex:1">
  {lbl("Week goal")}<div class="ruled top" style="height:106px"></div><div style="display:flex;align-items:center;gap:14px"><span class=small style="padding-top:16px">progress</span><div style="flex:1">{prog}</div></div>{GAP(30)}
  {lbl("Habit rings")}<div style="display:flex;gap:20px;align-items:center">{ring}<div style="flex:1">{hleg}</div></div>{GAP(26)}
  {lbl("Wins")}<div class=top>{wins}</div>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:0 20px">
   <div class=dia style="width:70%;margin:0 0 18px"><i></i></div>
   <div style="font-family:CG;font-style:italic;font-size:29px;line-height:1.35;color:#333">&ldquo;Life is like riding a bicycle. To keep your balance you must keep moving.&rdquo;</div>
   <div style="font-size:16px;font-variant:small-caps;letter-spacing:.12em;color:#666;margin-top:10px">Albert Einstein, letter to his son Eduard, 1930</div>
  </div>
 </div></div>{GAP(24)}
{lbl("Week")}<div class=top style="display:flex;flex:1;padding-top:10px">{weekcols}</div>
{f'{GAP(24)}<div class=kv style="margin-top:-16px"><span style="flex:1">this week&rsquo;s intention<b></b></span></div>' if intent else ''}""")
P["the-week"]=week(False)

with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":W,"height":H})
    for n,html in P.items():
        f=here/f".{n}.html"; f.write_text(html); pg.goto(f.as_uri()); pg.wait_for_timeout(350)
        pg.evaluate(SNAP); pg.wait_for_timeout(100)
        sh=pg.evaluate("document.body.scrollHeight")
        o=here.parent/"nomad"/f"{n}.png"; o.parent.mkdir(exist_ok=True)
        pg.screenshot(path=str(o),clip={"x":0,"y":0,"width":W,"height":H})
        meta=PngInfo()
        title=" ".join(w.capitalize() for w in n.split("-"))
        for k,v in {"Title":title,
                    "Author":"The Scholium",
                    "Copyright":"(c) 2026 The Scholium. Licensed CC BY-NC-SA 4.0: https://creativecommons.org/licenses/by-nc-sa/4.0/",
                    "Source":"https://github.com/TheScholium/scholium",
                    "Description":"Study template for Supernote Nomad (1404x1872). Instagram @the.scholium, Reddit u/the_scholium, Pinterest @thescholium. Contact: scholium.notes@gmail.com",
                    "Software":"The Scholium template builder"}.items(): meta.add_text(k,v)
        Image.open(o).convert("L").save(o,optimize=True,pnginfo=meta)
        f.unlink(); print(n, "OVERFLOW" if sh>H else "ok", sh)
    b.close()
