/* Independent animation direction A: practical miniature stage mechanisms. */
(() => {
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const range = (t,a,b) => clamp((t-a)/(b-a));
  const ease = (v) => {v=clamp(v); return v*v*(3-2*v);};
  const mix = (a,b,t) => a+(b-a)*t;
  const pulse = (t,a,b) => Math.sin(Math.PI*range(t,a,b));
  const treatments = {
    move:['Ratchet receipt winch','Telescoping chassis catch-up','Hinged price tiles','Cardboard loading ramp','Stubborn caster straightens'],
    turn:['Head knocks on body','Tape-gun anchor pivot','Threaded lifting screw','Folding aisle arrow','Pinned foot sweeps an arc'],
    push:['Handle escort','Pleated body extension','Static cheek peel','Queue lean and frantic feet','Displacement till receipt'],
    chain:['Nested cart frames','Backward eye-roll relay','Shared running undercarriage','Delayed spring squash','Tearing queue-ticket strip'],
    blocked:['Receipt-return wall slot','Chassis piles over feet','Chalk door peels away','Polite telescoping finger','Antenna pressure release'],
    edge:['Hinged flooring sample','Barcode strips descend','Stockroom strip curtain','Clipboard permission to fall','Caster circles after chassis'],
    pit:['Gusseted bagging trap','Spiral drain and last antenna','Descending elevator cabinet','Useless measured rescue','Origami parcel fold'],
    reboot:['Flat-pack screw assembly','Returns-hatch delivery','Printer extrusion','Maintenance wringer','Inventory outline and parts'],
    fire:['Folding barcode scanner','Rewinding luminous tape','Lamp cone squeezed into muzzle','Laser filament spool','Swelling muzzle and shutter dab'],
    hit:['Internal hardware shelves','Migrating sprung dent','Late face-loading dial','Impact thermal receipt','Double-clapping hinged panel'],
    belt:['Reverse-running treadmill','Folding luggage handle','Cable reel and tidy bow','Checkout-divider escort','Walking conveyor slats'],
    panel:['Parcel drawer ejector','Bell and padded finger','Shelf-sweeper arm','Accordion-wall bellows','Inflating test cushion'],
    gear:['Jar-grip release pop','Display platter and price tag','Gear-combed cables','Delayed wind-up key','Record platter and stylus'],
    energy:['Vending tongue pickup','Cable-spaghetti intake','Rolling power label','One-unit helper crank','Nested battery shells'],
    checkpoint:['Timecard hole punch','Tangling velvet rope','Shadow-only stock stamp','Receipt-fold crown badge','Bowing security gates'],
    damage:['Return-loop junk mail','Filing-drawer replacement','Card-driven marionette','Accordion coupon refold','Arguing printer rollers'],
    shield:['Warranty-book umbrella','Local envelope shredder','Inward packing-bubble pop','Dropping service shutter','Laser-lint roller sheet'],
    upgrade:['Self-selecting mounting tool','EMP closing-sign wave','Fitting-room swap','Tractor base tape','Displacement drawer slide'],
    shutdown:['Settling showroom cover','Cash-drawer eye shutters','Folded resting chair','Rolling maintenance sleeve','Appendages stop in sequence'],
    win:['Expanding portrait frame','Receipt snaps to winner','Flat cartons form plinth','Retail fittings take a bow','Tiny snip opens banner']
  };
  function draw(ctx,scenarioId,ideaIndex,t,palette) {
    const p=palette, i=ideaIndex, T=Math.min(.85,clamp(t));
    const q=ease(range(T,.24,.70)), a=range(T,.06,.24), k=range(T,.24,.70);
    ctx.save(); ctx.clearRect(0,0,400,240); ctx.fillStyle=p.bg; ctx.fillRect(0,0,400,240);
    ctx.lineWidth=2;ctx.lineCap='round';ctx.lineJoin='round';
    const line=(x,y,x2,y2,c=p.fg,w=2)=>{ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();};
    const box=(x,y,w,h,c=p.robot,stroke=p.fg)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.strokeRect(x,y,w,h);}};
    const circle=(x,y,r,c=p.robot,stroke=p.fg)=>{ctx.beginPath();ctx.arc(x,y,Math.max(.01,r),0,Math.PI*2);ctx.fillStyle=c;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}};
    const poly=(points,c=p.robot,stroke=p.fg)=>{ctx.beginPath();points.forEach(([x,y],j)=>j?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=c;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}};
    const text=(s,x,y,c=p.fg,size=12)=>{ctx.font=`500 ${size}px sans-serif`;ctx.fillStyle=c;ctx.textAlign='center';ctx.fillText(s,x,y);};
    const floor=(hole=-1)=>{for(let n=0;n<5;n++){const x=45+n*62;ctx.save();ctx.globalAlpha=.2;box(x,176,62,23,p.muted,null);ctx.restore();line(x,176,x,199,p.line,1);line(x,176,x+62,176,p.line,1);if(n===hole)box(x+1,176,60,23,p.bg,null);}line(45,199,355,199,p.line,1);line(45,201,355,201,p.fg,.5);};
    const bot=(x,y=177,{rot=0,sx=1,sy=1,color=p.robot,eye=0,alpha=1,face=1,heading=0}={})=>{ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,y);ctx.rotate(rot);ctx.scale(sx,sy);ctx.beginPath();ctx.ellipse(0,-2,25,6,0,0,Math.PI*2);ctx.strokeStyle=color;ctx.lineWidth=1;ctx.shadowColor=color;ctx.shadowBlur=7;ctx.stroke();ctx.shadowBlur=0;const g=ctx.createLinearGradient(-20,-54,20,-8);g.addColorStop(0,p.fg);g.addColorStop(.12,color);g.addColorStop(.68,p.bg);g.addColorStop(1,color);ctx.fillStyle=g;ctx.beginPath();ctx.roundRect(-19,-54,38,44,14);ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=1;ctx.stroke();ctx.beginPath();ctx.ellipse(-6,-43,6,3,-.4,0,Math.PI*2);ctx.fillStyle=p.fg;ctx.globalAlpha=alpha*.3;ctx.fill();ctx.globalAlpha=alpha;ctx.shadowColor=p.fg;ctx.shadowBlur=10;circle(8*face+eye,-33,3.4,p.fg,null);ctx.shadowBlur=0;ctx.save();ctx.translate(0,-2);ctx.rotate(heading);poly([[27*face,-3],[34*face,0],[27*face,3]],p.fg,null);ctx.restore();ctx.restore();};
    const receipt=(x,y,len=50,rot=0)=>{ctx.save();ctx.translate(x,y);ctx.rotate(rot);box(-12,0,24,len,p.bg);for(let n=8;n<len-3;n+=7)line(-7,n,7,n,p.muted,1);poly([[-12,len],[-6,len-3],[0,len],[6,len-3],[12,len]],p.bg);ctx.restore();};
    const spring=(x1,y1,x2,y2,coils=7)=>{ctx.beginPath();ctx.moveTo(x1,y1);for(let n=1;n<coils*2;n++){let v=n/(coils*2);ctx.lineTo(mix(x1,x2,v)+(n%2?4:-4),mix(y1,y2,v));}ctx.lineTo(x2,y2);ctx.strokeStyle=p.fg;ctx.lineWidth=2;ctx.stroke();};
    const gear=(x,y,r,rot=0)=>{ctx.save();ctx.translate(x,y);ctx.rotate(rot);for(let n=0;n<8;n++){ctx.save();ctx.rotate(n*Math.PI/4);box(-4,-r-5,8,10,p.accent);ctx.restore();}circle(0,0,r,p.accent);circle(0,0,r*.3,p.bg);ctx.restore();};
    const cart=(x,y=178,rot=0)=>{ctx.save();ctx.translate(x,y);ctx.rotate(rot);poly([[-25,-35],[23,-35],[15,-10],[-20,-10]],p.bg);for(let n=-12;n<20;n+=8)line(n,-34,n-3,-11,p.line);line(-25,-35,-33,-44);circle(-14,-4,5,p.muted);circle(14,-4,5,p.muted);ctx.restore();};
    const stamp=(x,y,label='OK',rot=0)=>{ctx.save();ctx.translate(x,y);ctx.rotate(rot);box(-22,-9,44,18,p.accent);box(-9,-30,18,21,p.muted);text(label,0,4,p.fg,10);ctx.restore();};
    const bolt=(x,y,s=1)=>poly([[x+2*s,y-16*s],[x-10*s,y+2*s],[x,y+2*s],[x-2*s,y+16*s],[x+11*s,y-3*s],[x+2*s,y-3*s]],p.accent);
    const shutter=(x,y,w,h,n)=>{box(x,y,w,h,p.bg);for(let j=0;j<n;j++)line(x,y+j*h/n,x+w,y+j*h/n,p.line);};
    const arc=(x,y,r,start,end,c=p.fg,w=2)=>{ctx.beginPath();ctx.arc(x,y,r,start,end);ctx.strokeStyle=c;ctx.lineWidth=w;ctx.stroke();};
    const card=(x,y,label,rot=0,c=p.bg)=>{ctx.save();ctx.translate(x,y);ctx.rotate(rot);box(-15,-21,30,42,c);text(label,0,5,p.fg,12);ctx.restore();};
    const beam=(x1,y1,x2,y2)=>{line(x1,y1,x2,y2,p.danger,5);line(x1,y1,x2,y2,p.bg,1);};
    const piston=(x,y,extension)=>{box(x-12,y-25,24,25,p.muted);box(x-5,y,10,extension,p.fg);box(x-30,y+extension,60,10,p.accent);};
    const puff=(x,y,r)=>{for(let n=0;n<5;n++)circle(x+Math.cos(n*1.25)*r*.5,y+Math.sin(n*1.25)*r*.5,r*.45,p.bg,p.line);};
    floor();
    switch(scenarioId) {
      case 'move': {
        const x=mix(107,231,q), wob=pulse(T,.24,.70);
        if(i===0){receipt(231,175,-0+8);line(x,151,231,178,p.accent,3);circle(x+14,151,8,p.muted);line(x+14,151,x+14+7*Math.cos(q*26),151+7*Math.sin(q*26));bot(x);if(T>.70){line(225,175,229,179);line(234,175,238,179);}}
        if(i===1){circle(mix(107,231,ease(range(T,.10,.38)))-11,171,7,p.muted);circle(mix(107,231,ease(range(T,.10,.38)))+11,171,7,p.muted);spring(x,156,mix(107,231,ease(range(T,.10,.38))),171,8);bot(x,177,{sx:1+wob*.55,sy:1-wob*.18});}
        if(i===2){for(let n=0;n<3;n++){const z=range(T,.16+n*.15,.36+n*.15);ctx.save();ctx.translate(107+n*62,179);ctx.scale(1,Math.cos(z*Math.PI));box(-28,-48,56,48,p.muted);if(z>0&&z<1)bot(0,0,{alpha:.5});ctx.restore();}bot(x,177,{alpha:T<.7?.55:1});}
        if(i===3){const z=ease(range(T,.02,.22));ctx.save();ctx.translate(77,181);ctx.rotate(-.6*(1-z));box(-30,-10,60,10,p.accent);ctx.restore();card(64,116,'→',-.35*(1-z));bot(x,177-18*(1-q));}
        if(i===4){bot(x,177,{rot:-.06*wob});for(let n=0;n<4;n++){ctx.save();ctx.translate(x-18+n*12,178);ctx.rotate(n===3?Math.PI/2*(1-ease(range(T,.12,.3))):0);box(-5,-3,10,6,p.muted);ctx.restore();}if(T<.3)arc(x+19,176,13,-Math.PI/2,Math.PI/2,p.accent);}
        break;
      }
      case 'turn': {
        const h=q*Math.PI/2;
        if(i===0){bot(200,177,{heading:h});ctx.save();ctx.translate(200,132);ctx.scale(Math.max(.2,Math.abs(Math.cos(Math.PI*range(T,.04,.22)))),1);box(-16,-8,32,15,p.bg);circle(5,0,2,p.fg);ctx.restore();if(T>.16&&T<.35)line(225,133,218,146,p.accent,4);}
        if(i===1){circle(200,181,6,p.accent);const x=200+65*Math.cos(h),y=163+24*Math.sin(h);box(x-7,y-12,14,24,p.accent);line(200,150,x,y,p.muted,4);bot(200,177,{heading:h,sx:1-.22*pulse(T,.24,.7)});}
        if(i===2){const lift=25*pulse(T,.12,.7);spring(200,177,200,177-lift);bot(200,177-lift,{heading:h});for(let n=0;n<3;n++)arc(200,181-lift*.3+n*5,13,0,Math.PI,p.line);}
        if(i===3){const z=ease(range(T,.02,.20));ctx.save();ctx.translate(200,mix(64,119,ease(range(T,.68,.82))));ctx.rotate(z*Math.PI/2);poly([[-24,-8],[10,-8],[10,-16],[28,0],[10,16],[10,8],[-24,8]],p.accent);ctx.restore();bot(200,177,{heading:h,eye:T<.24?-2:0});}
        if(i===4){arc(200,178,37,0,h,p.accent,3);circle(200,178,5,p.fg);circle(200+37*Math.cos(h),178+10*Math.sin(h),7,p.muted);bot(200,177,{heading:h+.16*Math.sin(range(T,.7,.85)*Math.PI*2)*(1-range(T,.7,.85))});}
        break;
      }
      case 'push': {
        const x=107+62*q,y=169+62*q,w=pulse(T,.22,.7);
        if(i===0){line(y-22,139,y-40,139,p.fg,3);line(y-40,139,y-40,151,p.fg,3);bot(y,177,{color:p.other});bot(x,177,{rot:.12*w});if(T>.7)line(y-22,139,y-22,150);}
        if(i===1){bot(x);bot(y,177,{color:p.other,sx:1-.35*w,sy:1+.1*w});for(let n=0;n<5;n++)line(y-15+n*7,140,y-20+n*7,163,p.line);}
        if(i===2){if(T>.2&&T<.7){for(let n=0;n<5;n++)line(x+22,136+n*6,y-22,136+n*6,p.accent,1+2*w);}bot(x,177,{rot:.14*w});bot(y,177,{color:p.other,rot:-.14*w});}
        if(i===3){bot(x,177,{rot:.18*w});bot(y,177,{color:p.other,eye:-3,rot:-.05*w});for(let n=0;n<2;n++){const z=Math.sin(k*36+n*Math.PI)*8*w;line(y-10+n*20,168,y-10+n*20+z,180,p.fg,3);}}
        if(i===4){bot(x);bot(y,177,{color:p.other,eye:-2});if(T>.12&&T<.76){receipt(y-18,144,30* Math.min(1,a));line(y-25,155,y-35,155);text('1',y-18,160,p.fg,10);}}
        break;
      }
      case 'chain': {
        const xs=[83,145,207].map(v=>v+62*q),w=pulse(T,.2,.72);
        if(i===0){xs.forEach((x,n)=>{cart(x,177);bot(x,170,{sx:1-.25*w,sy:1-.18*w,color:n?p.other:p.robot});});}
        if(i===1){xs.forEach((x,n)=>{bot(x,177,{eye:Math.sin(range(T,.35+(2-n)*.1,.5+(2-n)*.1)*Math.PI)*-4,color:n?p.other:p.robot});if(T>.15+n*.1&&T<.4+n*.1)line(x+24,143,x+37,136,p.accent,3);});}
        if(i===2){xs.forEach((x,n)=>{bot(x,177,{color:n?p.other:p.robot});for(let j=0;j<3;j++){const z=Math.sin(k*32+n+j)*9*w;line(x-18+j*16,165,x-18+j*16+z,179,p.fg,3);}});}
        if(i===3){xs.forEach((x,n)=>{const z=pulse(T,.18+n*.08,.55+n*.08);bot(x,177,{sx:1-.25*z,sy:1+.2*z,color:n?p.other:p.robot});spring(x+22,143,x+39,143);});}
        if(i===4){line(xs[0]-20,118,xs[2]+20,118,p.accent,3);xs.forEach((x,n)=>{bot(x,177,{color:n?p.other:p.robot});card(x,103,String(n+1),0,p.bg);if(T>.7){box(x+27,114,8,8,p.bg,null);}});}
        break;
      }
      case 'blocked': {
        box(235,90,22,91,p.muted);for(let n=0;n<5;n++)line(235,100+n*17,257,100+n*17,p.line);const w=pulse(T,.15,.7);
        if(i===0){bot(200);receipt(mix(200,231,pulse(T,.12,.63)),144,25,Math.PI/2);if(T>.4&&T<.74)stamp(210,111,'RETURN');}
        if(i===1){bot(200,177,{sx:1+.4*w,sy:1-.22*w,rot:.15*w});circle(189,171,7,p.muted);circle(211,171,7,p.muted);}
        if(i===2){bot(200,177,{eye:3});const z=range(T,.08,.35);ctx.save();ctx.translate(236,176);ctx.rotate(range(T,.52,.75)*1.3);ctx.globalAlpha=T>.75?0:1;box(-1,-65*z,18,65*z,p.bg);circle(12,-30,2,p.fg);ctx.restore();line(222,139,235,120+25*(1-z),p.accent,3);}
        if(i===3){bot(200,177,{rot:-.1*w});box(234-20*w,120,20*w,10,p.accent);circle(234-20*w,125,5,p.accent);}
        if(i===4){bot(200,177,{sx:1-.12*w,sy:1+.08*w});line(200,116,200,116-60*w,p.fg,3);circle(200,114-60*w,4,p.accent);}
        break;
      }
      case 'edge': {
        box(235,178,165,62,p.bg,null);line(235,181,235,212,p.line,3);
        const x=mix(200,260,ease(range(T,.1,.34))),drop=ease(range(T,.4,.76)),y=177+150*drop;
        if(i===0){ctx.save();ctx.translate(235,181);ctx.rotate(1.5*ease(range(T,.2,.65)));box(-27,-4,54,8,p.muted);ctx.restore();if(drop<1)bot(x,y,{rot:drop*.7});}
        if(i===1){if(T<.38)bot(x);else for(let n=0;n<7;n++){const d=ease(range(T,.38+n*.025,.65+n*.025));if(d<1)box(240,115+n*8+160*d,40,5,n%2?p.robot:p.fg,null);}if(T>.35&&T<.79){receipt(235,157,25);text('ID',235,172,p.fg,10);}}
        if(i===2){for(let n=0;n<4;n++){const z=range(T,.18,.5);ctx.save();ctx.translate(235+n*10,95+drop*140);ctx.rotate((n-1.5)*.22*z);box(-5,0,10,85,p.muted,p.line);ctx.restore();}if(drop<1)bot(x,y);}
        if(i===3){const d=ease(range(T,.52,.7));if(d<1)bot(x,177+180*d,{eye:2});if(T>.19&&T<.77){const yy=86+150*ease(range(T,.66,.78));box(280,yy,30,40,p.bg);line(260,137,281,yy+30);box(285,yy+10,8,8,p.bg);if(T>.44){line(286,yy+14,289,yy+18,p.accent);line(289,yy+18,297,yy+8,p.accent);}}}
        if(i===4){if(drop<1)bot(x,y);const z=range(T,.3,.65),d=ease(range(T,.65,.82));if(d<1){circle(260+20*Math.cos(z*Math.PI*2),157+10*Math.sin(z*Math.PI*2)+140*d,8,p.muted);line(260+20*Math.cos(z*Math.PI*2),150+10*Math.sin(z*Math.PI*2)+140*d,260+20*Math.cos(z*Math.PI*2),140+10*Math.sin(z*Math.PI*2)+140*d);}}
        break;
      }
      case 'pit': {
        box(169,180,62,28,p.bg,null);line(169,181,169,210,p.line);line(231,181,231,210,p.line);const d=ease(range(T,.47,.78)),y=177+140*d;
        ctx.save();ctx.beginPath();ctx.rect(0,0,400,180);ctx.clip();
        if(i===0){if(T<.35)bot(200);const z=ease(range(T,.12,.35));box(173,179-64*z+140*d,54,64*z,p.muted);poly([[173,179-64*z+140*d],[183,145+140*d],[200,159+140*d],[218,145+140*d],[227,179-64*z+140*d]],p.muted);arc(200,116+140*d,15,Math.PI,Math.PI*2,p.fg,3);}
        if(i===1){const z=range(T,.18,.7);bot(200+18*Math.sin(z*9)*(1-z),177+80*z,{sx:1-z*.8,sy:1-z*.85,rot:z*2});arc(200,177,28*(1-z),z*8,z*8+4,p.accent,3);}
        if(i===2){bot(200,y);if(T>.13){box(170,106+140*d,60,73,p.muted);line(200,107+140*d,200,179+140*d);poly([[195,119+140*d],[205,119+140*d],[200,126+140*d]],p.accent);}}
        if(i===3){bot(200,y,{eye:-3});const z=pulse(T,.12,.45);line(200,148+140*d,200-45*z,161,p.accent,4);for(let n=1;n<6;n++)line(200-n*8*z,148+(13*n/6),200-n*8*z,144+(13*n/6),p.fg,1);circle(200,148+140*d,7,p.muted);}
        if(i===4){const z=ease(range(T,.13,.43));if(z<1)bot(200,177,{sx:1+z*.3,sy:1-z*.85});ctx.save();ctx.translate(200,171+140*d);ctx.rotate(z*Math.PI/2);if(z>0)box(-26,-8*z,52,16*z,p.robot);line(-26,0,26,0,p.line);ctx.restore();if(T>.4&&T<.73)circle(224,123+30*range(T,.6,.73),4,p.bg);}
        ctx.restore();
        break;
      }
      case 'reboot': {
        box(170,181,60,6,p.accent,null);const z=ease(range(T,.18,.70));
        if(i===0){box(174,169,52,9*(1-z),p.muted);bot(200,177,{sy:Math.max(.05,z),sx:1+.4*(1-z),heading:Math.PI*2*(1-z)});if(T<.68){line(200,65,200,112*z,p.fg,4);box(192,58,16,12,p.accent);}}
        if(i===1){box(168,82,64,98,p.muted);box(175,91,50,79,p.bg);bot(200,177-65*(1-z),{sx:.6+.4*z,face:-1+2*Math.round(z),alpha:z});if(T>.45&&T<.78){receipt(229,133,26,-.3);text('R',229,148,p.fg,10);}if(T>.7){box(168,82,64,25*(1-ease(range(T,.7,.85))),p.muted);}}
        if(i===2){box(164,177,72,12,p.muted);ctx.save();ctx.beginPath();ctx.rect(172,177-70*z,56,70*z);ctx.clip();bot(200);ctx.restore();if(z<1)line(174,177-70*z,226,177-70*z,p.accent,3);}
        if(i===3){const h=range(T,.1,.6);circle(181,82,13,p.muted);circle(219,82,13,p.muted);line(181,82,181+10*Math.cos(h*20),82+10*Math.sin(h*20));line(219,82,219+10*Math.cos(-h*20),82+10*Math.sin(-h*20));box(195,92,10,80*h,p.robot);bot(200,177,{sx:Math.max(.05,z),sy:Math.max(.1,z)});if(T>.6&&T<.8)circle(228,145+30*range(T,.6,.8),3,p.accent);}
        if(i===4){ctx.save();ctx.setLineDash([4,4]);ctx.strokeStyle=p.line;ctx.strokeRect(179,118,42,57);ctx.restore();if(z<1){box(mix(90,181,z),mix(80,133,z),20,26,p.robot);box(mix(310,201,z),mix(80,133,z),20,26,p.robot);circle(mix(70,189,z),mix(171,171,z),7,p.muted);circle(mix(330,211,z),171,7,p.muted);}bot(200,177,{alpha:z});if(T>.08&&T<.65)line(166,105+75*range(T,.08,.65),234,105+75*range(T,.08,.65),p.accent,2);}
        break;
      }
      case 'fire': {
        bot(107);bot(293,177,{color:p.other});const on=T>.35&&T<.58,shoot=range(T,.35,.43),off=range(T,.58,.73);
        if(i===0){ctx.save();ctx.translate(139,148);ctx.rotate(-.8*(1-ease(range(T,.08,.3))));box(-3,-13,24,24,p.muted);for(let n=0;n<4;n++)line(1+n*5,-10,1+n*5,7,p.fg,1);ctx.restore();if(T>.17&&T<.35)line(160,135,271,156,p.accent,1);if(on)beam(161,148,273,148);}
        if(i===1){const end=mix(139,273,T<.58?shoot:1-off);if(T>.3&&T<.73){line(139,148,end,148,p.accent,5);for(let x=145;x<end;x+=9)line(x,144,x,152,p.fg,1);}if(on)beam(139,148,273,148);}
        if(i===2){line(200,29,200,54,p.line,3);poly([[182,54],[218,54],[225,66],[175,66]],p.muted);if(T>.1&&T<.35){const z=ease(range(T,.1,.35));poly([[190,66],[210,66],[mix(145,139,z),mix(165,148,z)],[mix(70,139,z),mix(165,148,z)]],p.accent,null);}if(on)beam(139,148,273,148);}
        if(i===3){circle(139,148,13,p.muted);circle(139,148,5,p.accent);line(139,148,139+11*Math.cos(T*40),148+11*Math.sin(T*40));if(T>.2&&T<.62)line(139,148,mix(139,273,ease(range(T,.2,.4))),148,p.accent,on?5:2);if(T>.55&&T<.7){line(273,137,268,158,p.fg,3);line(268,137,273,158,p.fg,3);}}
        if(i===4){const w=pulse(T,.12,.39);box(131,138-7*w,24+8*w,20+14*w,p.robot);if(on)beam(155,148,273,148);if(T>.6&&T<.8){box(150,132+17*pulse(T,.6,.8),9,20,p.bg);line(145,164,153,158);}}
        break;
      }
      case 'hit': {
        const w=pulse(T,.24,.68);bot(200);if(T>.16&&T<.28)beam(50,148,180,148);
        if(i===0&&T>.24&&T<.68){box(181,134,38,30,p.bg);line(182,145,218,145,p.line);line(182,156,218,156,p.line);for(let n=0;n<3;n++){gear(188+n*12,139+(n===1?11*q:0),3,T*8);}}
        if(i===1){const ang=range(T,.26,.65)*Math.PI*2;circle(200+20*Math.cos(ang),147+14*Math.sin(ang),6*w,p.bg,p.line);if(T>.62&&T<.8)receipt(180,146,24*range(T,.62,.72));}
        if(i===2){if(T>.25&&T<.61){arc(200,147,10,0,T*35,p.accent,3);}if(T>.61&&T<.80){line(189,128,196,131,p.fg,3);line(204,131,211,128,p.fg,3);box(194,136,12,5,p.fg);}}
        if(i===3&&T>.24&&T<.8){receipt(181,148,42*pulse(T,.24,.8),-.4*pulse(T,.4,.7));line(177,147,184,147,p.danger,3);if(T>.4&&T<.65)line(175,164,188,171,p.fg,3);}
        if(i===4){const z=T<.5?pulse(T,.24,.5):.6*pulse(T,.5,.75);ctx.save();ctx.translate(181,136);ctx.rotate(-z*1.2);box(-15,0,15,27,p.robot);ctx.restore();}
        break;
      }
      case 'belt': {
        const x=mix(107,231,q),w=pulse(T,.12,.75);for(let n=0;n<12;n++){const xx=51+(n*25+q*62)%300;line(xx,183,xx+8,187,p.accent,1);line(xx+8,187,xx,191,p.accent,1);}
        if(i===0){bot(x,177,{rot:-.08*w});for(let n=0;n<2;n++)line(x-12+n*24,166,x-12+n*24+12*Math.sin(k*40+n*Math.PI)*w,178,p.robot,2);box(228,176,6,5,p.accent,null);}
        if(i===1){const z=pulse(T,.05,.8);bot(x,177,{sy:1-.5*z,sx:1+.35*z});if(z>.1){arc(x,137+25*z,10,Math.PI,Math.PI*2,p.fg,2);line(x-10,137+25*z,x-10,145+25*z);line(x+10,137+25*z,x+10,145+25*z);}}
        if(i===2){bot(x);const xx=mix(130,250,q);ctx.beginPath();ctx.moveTo(x+15,151);ctx.quadraticCurveTo(xx+25,170,xx,182);ctx.strokeStyle=p.accent;ctx.lineWidth=2;ctx.stroke();if(T>.7){arc(x+20,165,5,0,Math.PI*2,p.accent);arc(x+30,165,5,0,Math.PI*2,p.accent);}}
        if(i===3){bot(x);box(x-37,164,7,18,p.accent);line(x-34,164,x-12,164,p.fg,2);}
        if(i===4){for(let n=0;n<4;n++){const xx=x-27+n*18,z=Math.sin(k*25+n)*7*w;line(xx,178,xx+z,188,p.accent,2);line(xx+z,188,xx+z+7,188,p.accent,2);}bot(x);}
        break;
      }
      case 'panel': {
        const x=169+62*q,w=pulse(T,.15,.75);box(80,105,24,77,p.bg,p.fg);
        if(i===0){box(104,130,12+62*q*(1-range(T,.7,.85)),43,p.muted);for(let n=0;n<3;n++){const xx=116+n*14+q*28*(1-range(T,.7,.85));box(xx,140+(n%2)*12,20,15,p.bg,p.accent);}bot(x);}
        if(i===1){arc(94,96,9,Math.PI,Math.PI*2,p.accent,2);line(85,96,103,96,p.accent);circle(94,99,2,p.accent);if(T>.06&&T<.22){arc(94,96,15,3.3,6.1,p.line);arc(94,96,20,3.3,6.1,p.line);}box(104,144,38+62*q*(1-range(T,.7,.85)),9,p.muted);circle(142+62*q*(1-range(T,.7,.85)),148,9,p.accent);bot(x,177,{eye:-3});}
        if(i===2){line(103,111,103+62*q,111,p.fg,3);line(103+62*q,111,x-25,157,p.fg,3);box(x-29,145,8,30,p.accent);line(120,178,265,178,p.fg,1);bot(x);}
        if(i===3){const end=145+62*q*(1-range(T,.7,.85));for(let n=0;n<8;n++){const xx=mix(104,end,n/8);poly([[xx,120],[xx+8,131],[xx,173],[xx-8,161]],p.bg,p.line);}line(end,119,end,174,p.accent,4);bot(x);}
        if(i===4){ctx.save();ctx.translate(104,148);ctx.scale(Math.max(.02,w),1);ctx.beginPath();ctx.ellipse(45,0,58,25,0,0,Math.PI*2);ctx.fillStyle=p.muted;ctx.fill();ctx.strokeStyle=p.accent;ctx.stroke();ctx.restore();bot(x,177,{rot:.04*w});}
        break;
      }
      case 'gear': {
        const h=q*Math.PI/2,w=pulse(T,.15,.72);ctx.save();ctx.translate(200,181);ctx.scale(1,.25);gear(0,0,36,h);ctx.restore();
        if(i===0){bot(200,177-13*pulse(T,.44,.66),{heading:h});if(T>.12&&T<.55){line(170,166,179,151,p.accent,3);line(230,166,221,151,p.accent,3);}}
        if(i===1){ctx.beginPath();ctx.ellipse(200,177,39,10,0,0,Math.PI*2);ctx.strokeStyle=p.fg;ctx.stroke();bot(200,172,{heading:h});const x=200+45*Math.cos(h-.5*w),y=177+12*Math.sin(h-.5*w);line(x,y,x,y-20,p.line);card(x,y-30,'1',0,p.bg);}
        if(i===2){for(let n=0;n<4;n++){ctx.beginPath();ctx.moveTo(186+n*9,153);ctx.quadraticCurveTo(186+n*9+20*w,174,190+n*8+25*w,180);ctx.strokeStyle=p.accent;ctx.stroke();}bot(200,177,{heading:h});}
        if(i===3){const xx=200+40*Math.cos(h*4),yy=182+10*Math.sin(h*4);line(200,179,xx,yy,p.accent,3);circle(xx,yy,7,p.bg);circle(xx+10,yy,7,p.bg);bot(200,177,{heading:ease(range(T,.35,.72))*Math.PI/2});}
        if(i===4){ctx.save();ctx.translate(200,180);ctx.scale(1,.3);for(let n=0;n<4;n++)circle(0,0,35-n*6,p.bg,p.line);line(0,0,35*Math.cos(h),35*Math.sin(h),p.accent);ctx.restore();bot(200,177,{heading:h});if(T<.7){line(200,122,234,104,p.fg);line(234,104,228,178,p.fg);}}
        break;
      }
      case 'energy': {
        bot(200);const z=ease(range(T,.20,.65));
        if(i===0){box(211,146,34*pulse(T,.08,.70),6,p.muted);box(mix(239,207,z),mix(104,146,Math.min(1,z*2)),15*(1-z),15*(1-z),p.accent);if(T>.6&&T<.8){line(200,123,200,105,p.accent,2);}}
        if(i===1){ctx.beginPath();ctx.moveTo(210,143);ctx.bezierCurveTo(250,151,222,190,270-60*z,176-30*z);ctx.strokeStyle=p.accent;ctx.lineWidth=3;ctx.stroke();box(264-60*z,169-30*z,10*(1-z),14*(1-z),p.accent);if(T>.65)box(211,142,60,42,p.bg,null);}
        if(i===2){if(T<.65){ctx.save();ctx.translate(200,148);ctx.rotate(-1.7*z);box(-16,-10,32,20,p.bg);text('LOW',0,4,p.muted,9);ctx.restore();}circle(mix(250,200,z),156-18*Math.sin(z*Math.PI),8*(1-z),p.accent);}
        if(i===3){const angle=range(T,.2,.62)*Math.PI*2;line(222,148,237,148,p.line,2);line(237,148,237+12*Math.cos(angle),148+12*Math.sin(angle),p.accent,3);circle(237+12*Math.cos(angle),148+12*Math.sin(angle),4,p.fg);if(T>.62){line(233,147,243,158,p.muted,2);}}
        if(i===4){for(let n=0;n<3;n++){const zz=ease(range(T,.08+n*.12,.27+n*.12));const size=28-n*8;box(258-size/2-zz*(10+n*3),133-size/2,size/2,size,p.bg,p.accent);box(258+zz*(10+n*3),133-size/2,size/2,size,p.bg,p.accent);}if(T>.45&&T<.7)bolt(mix(258,206,ease(range(T,.45,.7))),133,.3);}
        if(T>=.7){bolt(200,99,.35);text('+1',225,104,p.accent,12);}
        break;
      }
      case 'checkpoint': {
        bot(200);const w=pulse(T,.15,.72);line(200,180,200,196,p.accent,2);
        if(i===0){receipt(224,104,55*w);if(T>.25&&T<.65){piston(224,68,35*w);circle(224,139,4,p.bg);}if(T>.64)text('1',200,99,p.accent,18);}
        if(i===1){for(const x of [154,246]){line(x,181,x,128,p.muted,2);circle(x,128,4,p.accent);}ctx.beginPath();ctx.moveTo(154,128);ctx.bezierCurveTo(190,128+60*w,215,128-20*w,246,128);ctx.strokeStyle=p.accent;ctx.lineWidth=3;ctx.stroke();if(T>.65){ctx.beginPath();ctx.ellipse(200,180,31,8,0,0,Math.PI*2);ctx.stroke();text('1',200,99,p.accent,18);}}
        if(i===2){stamp(200,60+44*pulse(T,.1,.64),'1');if(T>.42){ctx.save();ctx.translate(200,187);ctx.scale(1,.6);text('1',0,0,p.accent,28);ctx.restore();}}
        if(i===3){const z=ease(range(T,.15,.6));if(T<.6)receipt(200,70,50*(1-z));poly([[180,114],[180,98],[190,106],[200,94],[210,106],[220,98],[220,114]],p.accent);text('1',200,111,p.bg,12);if(T>.65){box(178,91,44,25,p.bg,null);circle(218,151,9,p.accent);text('1',218,155,p.bg,12);}}
        if(i===4){for(const sign of [-1,1]){ctx.save();ctx.translate(200+sign*48,180);ctx.rotate(sign*.5*ease(range(T,.4,.72)));box(-7,-64,14,64,p.bg,p.accent);ctx.restore();}if(T>.15&&T<.4)line(157,152,243,152,p.accent,1);if(T>.6)text('1',200,99,p.accent,18);}
        break;
      }
      case 'damage': {
        bot(135);const z=ease(range(T,.16,.68));box(245,155,60,27,p.bg,p.line);
        if(i===0){const travel=T<.42?range(T,.13,.42):range(T,.42,.75);const x=T<.42?mix(260,146,travel):mix(146,275,travel),y=T<.42?135:135+28*Math.sin(travel*Math.PI);card(x,y,'SP',-.2*Math.sin(travel*Math.PI),p.bg);if(T>.42){line(145,175,275,175,p.line,1);for(let n=0;n<7;n++)circle(155+n*18,179,3,p.muted);}}
        if(i===1){box(211,117,100,60,p.muted);box(215,124,92,45,p.bg);line(250,148,270,148,p.accent,3);card(mix(263,326,z),mix(146,180,z),'SP',z*.8);card(mix(230,263,z),146,'→',0,p.accent);}
        if(i===2){card(135,66,'HW',-.12*Math.sin(T*20));for(let n=0;n<3;n++){const x=120+n*15,yy=140+Math.sin(T*25+n)*10*pulse(T,.15,.65);line(135,87,x,yy,p.accent,1);circle(x,yy,3,p.robot);}if(T>.68){box(112,85,46,75,p.bg,null);bot(135);poly([[173,128],[195,128],[195,122],[207,133],[195,144],[195,138],[173,138]],p.accent);}}
        if(i===3){const w=pulse(T,.1,.70);for(let n=0;n<7;n++){const x=210+n*12*w;ctx.save();ctx.translate(x,113+n*5*w);ctx.rotate((n%2?1:-1)*.35*w);box(-9,-17,18,34,p.bg,p.line);line(-5,-8,5,-8,p.muted,1);ctx.restore();}if(T>.7){box(200,90,100,65,p.bg,null);card(265,143,'SP',0,p.bg);}}
        if(i===4){box(213,108,104,61,p.muted);circle(236,145,10,p.bg);circle(291,145,10,p.bg);line(236,145,236+8*Math.cos(T*40),145+8*Math.sin(T*40),p.accent);line(291,145,291+8*Math.cos(-T*40),145+8*Math.sin(-T*40),p.accent);if(T<.42)card(265,90+40*z,'SP');else card(265,145+29*ease(range(T,.42,.72)),'→',0,p.accent);}
        break;
      }
      case 'shield': {
        bot(200);const on=T>.28&&T<.48,w=pulse(T,.13,.70);if(on)beam(50,148,165,148);
        if(i===0){ctx.save();ctx.translate(172,148);ctx.rotate(Math.PI/2);poly([[-33,0],[-24,-15],[0,-23],[24,-15],[33,0]],p.bg,p.accent);line(0,0,0,29,p.accent,2);ctx.restore();if(on){circle(164,145,3,p.accent);circle(165,154,2,p.accent);}if(T>.6)box(147,112,36,65,p.bg,null);}
        if(i===1){if(T>.15&&T<.68){box(158,127,12,42,p.bg,p.accent);if(T>.36){card(156,148,'R',Math.PI/2,p.bg);for(let n=0;n<4;n++)line(151+n*4,157,151+n*4,160+25*range(T,.44,.68),p.accent,1);}}}
        if(i===2){const r=18*w;ctx.save();ctx.globalAlpha=.25;circle(174,148,r,p.robot,null);ctx.restore();arc(174,148,r,0,Math.PI*2,p.accent,1);if(T>.42&&T<.55){for(let n=0;n<6;n++){const ang=n*Math.PI/3;line(174+12*Math.cos(ang),148+12*Math.sin(ang),174+4*Math.cos(ang),148+4*Math.sin(ang),p.accent,1);}}}
        if(i===3){const z=pulse(T,.13,.7);shutter(173,112,54,67*z,6);if(T>.25&&T<.6)text('CLOSED',200,145,p.fg,9);}
        if(i===4){const yy=119+55*ease(range(T,.17,.58));line(168,yy,177,yy-12,p.fg,2);box(155,yy-8,13,24,p.muted,p.accent);if(T>.43&&T<.73){receipt(160,yy+6,20*(1-range(T,.43,.73)));line(151,yy+8,169,yy+8,p.accent,3);}}
        break;
      }
      case 'upgrade': {
        if(i===0){bot(200);const z=ease(range(T,.13,.68)),x=T<.4?mix(275,178,ease(range(T,.13,.4))):mix(178,220,ease(range(T,.4,.68))),yy=125-40*Math.sin(z*Math.PI);box(259,110,35,55,p.bg,p.line);circle(x,yy,8,p.accent);line(x,yy+7,x,yy+26,p.accent,5);if(T>.68){circle(220,143,8,p.accent);line(220,150,220,167,p.accent,5);}}
        if(i===1){bot(107);bot(231,177,{color:p.other});bot(293,177,{color:p.other});const r=180*ease(range(T,.16,.65));if(T>.16&&T<.65){ctx.save();ctx.translate(107,177);ctx.scale(1,.5);arc(0,0,r,0,Math.PI*2,p.accent,2);ctx.restore();}for(const [n,x] of [107,231,293].entries()){card(x,83,T>.18+n*.1&&T<.60?'×':'○',0,p.bg);}}
        if(i===2){const closed=pulse(T,.10,.75),swap=T<.42?0:1;bot(swap?262:138);bot(swap?138:262,177,{color:p.other});for(const x of [138,262]){line(x-36,100,x+36,100,p.fg,2);for(let n=0;n<6;n++){const xx=x-30+n*12;box(xx,105,12,73*closed,p.bg,p.accent);}}}
        if(i===3){bot(107);bot(293-62*q,177,{color:p.other});circle(130,158,10,p.muted);if(T>.14&&T<.73){line(130,158,293-62*q,173,p.accent,3);line(293-62*q,173,293-62*q,167,p.fg,2);for(let n=0;n<12;n++){const x=140+n*10;if(x<293-62*q)line(x,159+(x-130)/11,x,163+(x-130)/11,p.fg,1);}}}
        if(i===4){bot(107);const w=pulse(T,.13,.74),x=231+62*q;bot(x,177,{sy:1-.82*w,sx:1+.2*w,color:p.other});box(x-30,171-15*w,60,14*w,p.bg,p.accent);line(x-9,171-6*w,x+9,171-6*w,p.fg,2);}
        break;
      }
      case 'shutdown': {
        const z=ease(range(T,.13,.70));
        if(i===0){bot(200);ctx.save();ctx.globalAlpha=.2+.8*z;poly([[172,177],[176,117],[190,110],[209,112],[225,127],[229,177]],p.muted,p.line);line(181,145,178,177,p.line,1);line(216,143,221,177,p.line,1);ctx.restore();if(T<.6)line(200,113,200,113-15*(1-z),p.accent,1);}
        if(i===1){bot(200);box(182,138,36,23,p.bg,p.line);box(182+25*(1-z),140,36,18,p.muted);line(190+25*(1-z),148,211+25*(1-z),148,p.accent,2);if(T>.5){box(201,139,13,7,p.bg,null);line(204,141,211,141,p.line,2);}if(T>.6&&T<.77)line(226,152,218,152,p.fg,2);}
        if(i===2){bot(200,177,{sy:1-.56*z,sx:1+.32*z});line(180,176,180,160,p.robot,2);line(220,176,220,160,p.robot,2);if(T>.65)line(179,154,221,154,p.line,2);}
        if(i===3){bot(200);const y=177-68*z;box(174,y,52,68*z,p.muted,p.line);for(let n=0;n<10;n++){const yy=y+n*7;if(yy<177){line(174,yy,226,yy,p.line,1);for(let x=178;x<226;x+=8)line(x,yy,x+4,Math.min(177,yy+5),p.line,1);}}if(T>.4){receipt(229,120,27);text('M',229,138,p.fg,10);}}
        if(i===4){bot(200);for(let n=0;n<3;n++){const stop=clamp(1-range(T,.15+n*.14,.35+n*.14)),x=180+n*20,y=112;line(x,125,x,y,p.line,1);ctx.save();ctx.translate(x,y);ctx.rotate(T*32*stop);for(let j=0;j<3;j++){ctx.rotate(Math.PI*2/3);poly([[0,0],[9*stop,-3],[9*stop,3]],p.accent);}ctx.restore();}if(T>.7){box(204,139,10,7,p.bg,null);line(204,142,211,142,p.line,2);}}
        break;
      }
      case 'win': {
        bot(200);const z=ease(range(T,.10,.7));
        if(i===0){const yy=mix(10,90,z),w=40+12*ease(range(T,.5,.7));ctx.save();ctx.strokeStyle=p.accent;ctx.lineWidth=3;ctx.strokeRect(200-w,yy,w*2,91);ctx.restore();box(172,183,56,13,p.bg,p.accent);text('WINNER',200,193,p.fg,10);}
        if(i===1){if(T<.55){receipt(236,34,140*ease(range(T,.1,.4)));bot(200,177,{eye:3});}else{box(137,76,126,27,p.bg,p.accent);text('WINNER',200,94,p.fg,16);}}
        if(i===2){for(let n=0;n<3;n++){const h=8*ease(range(T,.1+n*.12,.32+n*.12));box(166-n*8,184+n*8,68+n*16,h,p.bg,p.line);line(166-n*8,184+n*8,200,184+n*8+h,p.line,1);}if(T>.4){poly([[165,119],[165,75],[184,94],[200,67],[216,94],[235,75],[235,119]],p.bg,p.accent);bot(200);}}
        if(i===3){for(const sign of [-1,1]){ctx.save();ctx.translate(200+sign*100,177);ctx.rotate(-sign*.38*pulse(T,.13,.55));line(0,0,0,-95,p.line,2);box(-22,-95,44,18,p.bg,p.accent);line(0,-78,-sign*27,-58,p.line,2);ctx.restore();}bot(200,177,{rot:.15*pulse(T,.55,.8)});}
        if(i===4){const s=ease(range(T,.38,.72));line(173,143,227,143,p.accent,2);if(T>.2&&T<.5){line(197,138,202,147,p.fg,1);line(202,138,197,147,p.fg,1);}if(s>0){box(200-135*s,72,270*s,29,p.bg,p.accent);if(s>.7)text('WINNER',200,92,p.fg,17);}if(T>.5){line(173,143,190,150,p.accent,2);line(210,150,227,143,p.accent,2);}}
        break;
      }
      default: throw new Error(`Unknown mechanical scene: ${scenarioId}`);
    }
    ctx.restore();
  }
  globalThis.RRMechanical={name:'Mechanical theatre',draw,treatments,coverage:treatments};
})();
