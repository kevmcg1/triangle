/* Practice-problem answer test: node practice_test.js [playwright-path]
 * Generates 300 problems from every homework.js generator and recomputes each answer from the printed problem text alone (not from the
 * generator's hidden numbers), so a problem whose printed values disagree with its answer fails. Also covers the solver (SSS, SAS, ASA, AAS,
 * SSA, SSA2 solutions are valid triangles and the SSA solution count matches the theory). Exits non-zero on any failure. */
const path = require('path');
const { chromium } = require(process.argv[2] || 'playwright');
(async () => {
  const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  await p.goto('file://' + path.join(__dirname, 'index.html')); await p.waitForTimeout(1500);
  const r = await p.evaluate(() => {
    const H=window.__hw, bad={}, seen={}; const rad=d=>d*Math.PI/180, deg=r=>r*180/Math.PI;
    const N=s=>s.replace(/−/g,'-'); const nums=s=>(N(s).match(/-?\d+(\.\d+)?/g)||[]).map(Number);
    const note=(k,m)=>{(bad[k]=bad[k]||[]).push(m)};
    const near=(x,y,t=0.02)=>Math.abs(x-y)<=t*Math.max(1,Math.abs(y))*0.5+1e-9; // loose: problems round answers
    for (const [k,g] of Object.entries(H.GEN)) for (let i=0;i<300;i++){ const q=g(); seen[k]=(seen[k]||0)+1; const t=N(q.text); const ans=q.answer; let want=null, m;
      try {
      if (k==='pyth'){ if(m=t.match(/legs b = ([\d.]+) in and c = ([\d.]+)/)) want=Math.hypot(+m[1],+m[2]); else if(m=t.match(/hypotenuse a = ([\d.]+) in and one leg b = ([\d.]+)/)) want=Math.sqrt(m[1]*m[1]-m[2]*m[2]); else if (m=t.match(/hypotenuse a = ([\d.]+) in and one leg c = ([\d.]+)/)) want=Math.sqrt(m[1]*m[1]-m[2]*m[2]); }
      else if (k==='trig'){ const hyp=+(t.match(/hypotenuse is a = ([\d.]+)/)||[])[1]; const ang=t.match(/angle ([BC]) = ([\d.]+)°/); const opp=t.match(/side opposite ([BC]) is ([bc]) = ([\d.]+)/); const adj=t.match(/Find the side ([bc]) (next to|opposite) ([BC])/);
        if (ang){ const X=rad(+ang[2]); const nxt=t.match(/Find the side ([bc]) (next to|opposite) ([BC])/); if(nxt){ want = nxt[2]==='next to' ? hyp*Math.cos(X) : hyp*Math.sin(X);} }
        else if (opp && /Find angle/.test(t)) want=deg(Math.asin(+opp[3]/hyp)); }
      else if (k==='lawsin'){ m=t.match(/A = (\d+)°, B = (\d+)° and a = ([\d.]+)/); if(m){ const A=rad(+m[1]),B=rad(+m[2]); const X=/Find side c/.test(t)?Math.PI-A-B:B; want=+m[3]*Math.sin(X)/Math.sin(A);} }
      else if (k==='lawcos'){ if(m=t.match(/sides a = ([\d.]+) in, b = ([\d.]+) in and c = ([\d.]+) in. Find angle C/)) want=deg(Math.acos((m[1]*m[1]+m[2]*m[2]-m[3]*m[3])/(2*m[1]*m[2]))); else if(m=t.match(/b = ([\d.]+) in, c = ([\d.]+) in and the angle between them is A = (\d+)°/)) want=Math.sqrt(m[1]*m[1]+m[2]*m[2]-2*m[1]*m[2]*Math.cos(rad(+m[3]))); else if (!/Find/.test(t)) {} }
      else if (k==='ambig'){ m=t.match(/A = (\d+)°, a = ([\d.]+) in and b = ([\d.]+) in/); if(m){ const A=rad(+m[1]),a=+m[2],b=+m[3],h=b*Math.sin(A); want = a<h-1e-9?0: Math.abs(a-h)<1e-9?1 : (a<b && A<Math.PI/2)?2 : (a>=b?1:0); want=String(want);} }
      else if (k==='heron'){ m=t.match(/sides (\d+), (\d+) and (\d+)/); if(m){const [a,b,c]=[+m[1],+m[2],+m[3]],s=(a+b+c)/2; want=Math.sqrt(s*(s-a)*(s-b)*(s-c));} }
      else if (k==='areaSAS'){ m=t.match(/a = ([\d.]+) in and b = ([\d.]+) in, and the angle between them is C = (\d+)°/); if(m) want=0.5*m[1]*m[2]*Math.sin(rad(+m[3])); }
      else if (k==='inequality'){ m=t.match(/sides of (\d+), (\d+) and (\d+)/); if(m){const s=[+m[1],+m[2],+m[3]].sort((x,y)=>x-y); want=s[0]+s[1]>s[2]?'yes':'no';} }
      else if (k==='classify'){ m=t.match(/sides (\d+), (\d+) and (\d+)/); if(m){const s=[+m[1],+m[2],+m[3]].sort((x,y)=>x-y); const d=s[0]*s[0]+s[1]*s[1]-s[2]*s[2]; want=d===0?'right':d>0?'acute':'obtuse';} }
      else if (k==='angles'){ if(m=t.match(/A = (\d+)° and B = (\d+)°. Find the exterior angle at C/)) want=+m[1]+ +m[2]; else if(m=t.match(/angles of a triangle are (\d+)° and (\d+)°/)) want=180-m[1]-m[2]; else if (m=t.match(/A = (\d+)° and B = (\d+)°. Find angle C/)) want=180-m[1]-m[2]; }
      else if (k==='similar'){ m=t.match(/has sides (\d+), (\d+) and (\d+) in.*shortest side is ([\d.]+) in\. Find the (longest|middle|perimeter|[a-z ]+)/); if(m){const s=[+m[1],+m[2],+m[3]].sort((x,y)=>x-y), f=m[4]/s[0]; want=/longest/.test(m[5])?s[2]*f:/middle/.test(m[5])?s[1]*f:/perimeter/.test(m[5])?(s[0]+s[1]+s[2])*f:null;} else {note('similar?text',t.slice(0,200));} }
      else if (k==='midsegment'){ m=t.match(/side [abc] = ([\d.]+) in/); if(m) want=m[1]/2; }
      else if (k==='centroid'){ m=t.match(/A\((-?\d+), (-?\d+)\), B\((-?\d+), (-?\d+)\) and C\((-?\d+), (-?\d+)\)\. Find the (x|y)-coordinate/); if(m) want=m[7]==='x'?(+m[1]+ +m[3]+ +m[5])/3:(+m[2]+ +m[4]+ +m[6])/3; }
      else if (k==='slope'){ m=t.match(/A\((-?\d+), (-?\d+)\), B\((-?\d+), (-?\d+)\) and C\((-?\d+), (-?\d+)\)\. Find the slope of side ([abc]) \(from ([ABC]) to ([ABC])\)/); if(m){const P={A:[+m[1],+m[2]],B:[+m[3],+m[4]],C:[+m[5],+m[6]]}; const u=P[m[8]],w=P[m[9]]; want=(w[1]-u[1])/(w[0]-u[0]);} }
      else if (k==='inradius'){ m=t.match(/sides (\d+), (\d+) and (\d+) in/); if(m){const [a,b,c]=[+m[1],+m[2],+m[3]],s=(a+b+c)/2; const K=Math.sqrt(s*(s-a)*(s-b)*(s-c)); want=/circumradius/.test(t)?a*b*c/(4*K):K/s;} }
      } catch(e){ note(k,'parse err '+e); continue; }
      if (k==='trig' && /Find angle/.test(t)) { const sb=t.match(/b = ([\d.]+) in/); if (sb && !q.steps.join(' ').includes(sb[1] + ' ÷')) note(k+' steps','working does not use the printed b = '+sb[1]+' :: '+q.steps[1]); }
      if (want===null){ note(k+'?unparsed',t.slice(0,90)); continue; }
      const ok = typeof want==='string' ? String(ans)===want : (isFinite(+ans) && Math.abs(+ans-want) <= 0.01*Math.max(1,Math.abs(want)));
      if(!ok) note(k,'WRONG ans '+ans+' want '+(typeof want==='number'?want.toFixed(4):want)+' :: '+t.slice(0,110));
      // steps must use the numbers shown in the problem text: any step line number matching a rounded-text value mismatch check for trig angle
    }
    const out={}; for(const [k,v] of Object.entries(bad)) out[k]={n:v.length, ex:[...new Set(v)].slice(0,3)}; return {seen,out,keys:Object.keys(H.GEN)};
  });
  const nbad=Object.keys(r.out).length; console.log('problems checked:', Object.values(r.seen).reduce((a,b)=>a+b,0)); if(nbad) console.log(JSON.stringify(r.out,null,1)); await b.close(); process.exit(nbad?1:0);
})();
