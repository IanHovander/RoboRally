/* Independent folded-light animation studies for Lumen. Pure 400 × 240 renderer. */
(() => {
  const clamp = v => Math.max(0, Math.min(1, v));
  const phase = (t, a = .18, b = .72) => clamp((t - a) / (b - a));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);
  let c, p;
  function path(points, fill, stroke = p.fg, close = true) {
    c.beginPath(); points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));
    if(close)c.closePath(); if(fill){c.fillStyle=fill;c.fill();} if(stroke){c.strokeStyle=stroke;c.lineWidth=1.5;c.stroke();}
  }
  function rect(x,y,w,h,fill,stroke=p.fg){c.fillStyle=fill;c.fillRect(x,y,w,h);if(stroke){c.strokeStyle=stroke;c.lineWidth=1.3;c.strokeRect(x,y,w,h);}}
  function line(x,y,X,Y,color=p.fg,width=2){c.beginPath();c.moveTo(x,y);c.lineTo(X,Y);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
  function circle(x,y,r,fill,stroke=p.fg){c.beginPath();c.arc(x,y,r,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=1.3;c.stroke();}}
  function word(s,x,y,color=p.fg,size=12){c.fillStyle=color;c.font=`500 ${size}px system-ui`;c.textAlign='center';c.fillText(s,x,y);}
  function star(x,y,r=12,color=p.accent,spin=0){let pts=[];for(let k=0;k<12;k++){let a=k*Math.PI/6+spin,rr=k%2?r*.4:r;pts.push([x+Math.cos(a)*rr,y+Math.sin(a)*rr]);}path(pts,color);}
  function tag(x,y,w=48,h=24,angle=0,label='') {c.save();c.translate(x,y);c.rotate(angle);path([[-w/2,-h/2],[w/2-6,-h/2],[w/2,h/2],[ -w/2,h/2]],p.bg);circle(-w/2+6,0,2,p.fg,null);if(label)word(label,3,4,p.fg,11);c.restore();}
  function bot(x,y=160,angle=0,color=p.robot,opts={}) {
    c.save();c.translate(x,y);c.rotate(angle);c.scale(opts.sx??1,opts.sy??1);c.globalAlpha*=opts.alpha??1;
    if(opts.string){line(-12,-40,-12,-120,p.muted,1);line(13,-40,13,-120,p.muted,1);}
    path([[-22,-41],[18,-44],[25,-9],[-20,-5]],color,p.line);
    path([[18,-44],[26,-37],[30,-11],[25,-9]],p.muted,p.line);
    path([[-22,-41],[-14,-45],[18,-44],[-15,-37]],p.fg,null);
    rect(-15,-35,29,15,p.bg,p.line);
    c.shadowColor=p.fg;c.shadowBlur=opts.sleep?0:7;
    if(opts.sleep)line(-5,-28,5,-28,p.muted,2);else circle(0,-28,4.5,p.fg,null);
    c.shadowBlur=0;
    line(-1,-44,-1,-52);circle(-1,-54,3,p.accent);
    path([[-18,-7],[-18,0],[-6,0],[-7,-7]],p.fg);path([[8,-7],[7,0],[20,0],[19,-7]],p.fg);
    line(-13,-11,17,-13,p.fg,1);
    if(opts.arm!==undefined)line(23,-28,39,-28+opts.arm);
    c.restore();
    c.save();c.translate(x,y+3);c.globalAlpha*=opts.alpha??1;c.scale(1,.3);
    circle(0,0,29,null,color);c.restore();
    const da=angle,dx=Math.cos(da),dy=Math.sin(da);
    path([[x+dx*34,y+3+dy*14],[x+dx*25-dy*4,y+3+dy*10+dx*4],[x+dx*25+dy*4,y+3+dy*10-dx*4]],color,null);
  }
  function floor({hole=-1,edge=false}={}) {
    c.save();c.globalAlpha=.18;path([[25,165],[edge?300:375,165],[edge?293:368,192],[18,192]],p.muted,null);c.restore();
    for(let i=0;i<5;i++){let x=25+i*70;if(i===hole) {path([[x,165],[x+65,165],[x+58,188],[x-7,188]],p.bg,p.line);continue;}if(edge&&i>=4)continue;
      path([[x,165],[x+65,165],[x+58,188],[x-7,188]],p.bg,p.line);line(x+6,174,x+51,174,p.line,1);
    }
    line(18,190,370,190,p.muted,1); if(edge){line(300,165,293,189,p.fg,3);line(300,189,300,220,p.line,1);}
  }
  function sheet(x,y,w,h,fold=0,label=''){rect(x,y,w,h,p.bg);path([[x+w-12,y],[x+w,y+12],[x+w-12,y+12]],p.muted);for(let k=0;k<3;k++)line(x+7,y+19+k*8,x+w-8,y+19+k*8,p.line,1);if(label)word(label,x+w/2,y+15,p.fg,10);if(fold)line(x,y+h*fold,x+w,y+h*fold,p.fg,1);}
  function wheel(x,y,r=22,a=0){c.save();c.translate(x,y);c.rotate(a);for(let i=0;i<8;i++){c.rotate(Math.PI/4);rect(-4,-r-5,8,10,p.accent);}circle(0,0,r,p.bg);line(-r+4,0,r-4,0,p.muted);line(0,-r+4,0,r-4,p.muted);circle(0,0,5,p.fg);c.restore();}
  function zig(x,y,w,h,color=p.accent){path([[x,y],[x+w*.55,y+h*.2],[x+w*.35,y+h*.55],[x+w,y+h],[x+w*.45,y+h*.65],[x+w*.6,y+h*.3]],color);}
  function arrow(x,y,w=40,d=1){path([[x,y-3],[x+w*d-d*10,y-3],[x+w*d-d*10,y-10],[x+w*d,y],[x+w*d-d*10,y+10],[x+w*d-d*10,y+3],[x,y+3]],p.accent,null);}
  function box(x,y,w=50,h=42,open=0){rect(x-w/2,y-h,w,h,p.muted);line(x,y-h,x,y);path([[x-w/2,y-h],[x-w/2-open*18,y-h-open*20],[x,y-h-open*15],[x,y-h]],p.bg);path([[x,y-h],[x,y-h-open*15],[x+w/2+open*18,y-h-open*20],[x+w/2,y-h]],p.bg);}
  function threads(x,y,w=60){line(x-w/2,y,x+w/2,y,p.muted,1);for(let i=0;i<5;i++)line(x-w/2+i*w/4,y,x-w/2+i*w/4,y-9,p.muted,1);}
  const treatments = {
    move:['Pull-tab receipt reels a hinged chassis along the grid','Accordion legs drag a trailing cutout body','Three hinged shelf cards flip robot silhouettes in sequence','A register card folds into a ramp and releases the chassis','Paper caster tabs disagree, then fold into a straight running row'],
    turn:['Head disc turns and knocks a reluctant body tab','Price label ribbon pulls a pinned paper pivot','Threaded paper column unwinds and reseats','Hinged aisle arrow folds into the robot after directing it','Pinned foot swings the body along a pencilled quarter arc'],
    push:['Cart-handle tab folds out for a one-tile escort','Pleated target compresses, extends, and folds its rear back','A static paper silhouette stretches between peeling bodies','Shopper lean makes the target hurriedly carry its feet','A displacement receipt folds into a tiny ledger before the glide'],
    chain:['Three nested cutout carts unfold into a full shifted queue','Shoulder-tap arms relay forward; complaint eyes relay backward','One scalloped many-legged strip carries three upright bodies','A delayed concertina pulse passes over synchronized bases','A numbered ticket strip pulls, perforates, and releases the queue'],
    blocked:['A wall mail slot returns a folded refusal receipt','A pleated body piles over stationary feet and unfolds','A drawn door peels down as a useless flat card','A wall finger presses the robot back without moving its base','A vertical paper antenna unfolds the rejected force upwards'],
    edge:['A loose floor corner folds downward with the robot','Horizontal cutout strips peel downward into a barcode','Stockroom fringe parts and then collapses below the edge','A clipboard tick delays a whole-cutout gravity drop','Body cutout drops; one caster completes an independent loop'],
    pit:['Bag gussets fold around the robot and sink','The robot winds into a spiral; its antenna is the last plug','Elevator paper doors rise, close, and fold into the pit','A measuring ribbon reaches the rim and uselessly recoils','A robot folds into a narrow parcel and slips edge-first through'],
    reboot:['A flat-packed net rises into a robot from a carton','A returns flap spits out a backward cutout and sheds its label','A full-height printed silhouette accordion-folds into thickness','A wringer turns a ribbon back into a stiff paper robot','Loose shapes migrate into a dashed inventory silhouette'],
    fire:['A folded scanner fan pinches into a precise straight ray','A ruler ribbon extends to the endpoint and snaps back','A hinged lamp cone concertinas into the barrel','A paper spool unreels a thread cut exactly at the target','Pinched muzzle pleats swell, release, then receive a paper dab'],
    hit:['An x-ray window opens onto paper shelves of loose nuts','A punched dent circles the body then becomes a damage chit','A smiling face card flips late after a loading-wheel pause','A scorch mark unrolls into an itemized damage receipt','A hinged side panel claps twice before its tab slots shut'],
    belt:['Scissor legs run backward over a sliding conveyor strip','A paper suitcase folds shut, travels, and opens on the destination','A loose cable is pulled into the belt then folded into a bow','A divider card escorts the robot like a checkout fence','Accordion slats walk beneath a rigidly upright passenger'],
    panel:['A parcel-stuffed drawer extends then swallows its contents','A paper bell folds out before a padded finger delivers the shove','A sweeping shelf tab slides the robot as the final product','An accordion wall expands and collapses to a single crease','A cushion inflates from folded facets then creases flat'],
    gear:['A jar-grip collar twists a resisting cutout body','A lazy-Susan price card trails the quarter-turn display','Comb teeth gather cable strips and rotate the body','A key winds one way before a delayed spring turn','A quarter-record platter catches an antenna stylus'],
    energy:['A chest tongue catches one cube and retracts','A glowing cable concertinas into the mouth with one last plug tap','A LOW label peels away as a fresh charge label rolls in','A tiny hinged arm cranks once and folds exhausted','Three nested paper cubes collapse into one counted cell'],
    checkpoint:['A punch clips a timecard and leaves a numeral-shaped hole','A folding rope gate tangles and closes into a numbered ring','A stamp descends but prints only the robot shadow','A receipt folds into a numbered crown then a small badge','Two security gate cutouts bow after a scan'],
    damage:['One counted envelope is rejected then rerouted into the deck','A filing drawer ejects SPAM and seats its actual replacement','Haywire strings tug only cosmetic limbs then form a command arrow','An accordion coupon train refolds into a single damage card','Opposing printer rollers eject one face-up replacement'],
    shield:['Book pages fan into an umbrella and drain the beam into its spine','A return stamp folds incoming light into a locally shredded envelope','A packing bubble folds inward around the absorbed light','A corrugated service shutter drops and lifts after blocking','A lint roller captures the ray on a peel-away strip'],
    upgrade:['A tool tests three mounting tabs before locking onto the side','A circular closing wave flips only the affected store signs','Two fitting-room curtains fold shut and reveal swapped robots','A ruled pull-tab retracts the target exactly one tile','A shallow paper drawer folds around and transports the target'],
    shutdown:['A showroom dust cover lowers and its antenna poke settles','A till drawer folds shut and a final finger presses it flush','A robot folds into a chair for the whole shutdown hold','A knitted paper sleeve rolls up with a hanging service tag','Paper fan, arm, and antenna wind down on successive beats'],
    win:['An employee frame expands around the awkward antenna','A long itemized receipt folds into a large winner banner','Three carton nets build a stationary display pedestal','Shelf cards and lamps bow before the robot returns the gesture','Tiny scissors clip a ribbon that unfolds into a giant banner']
  };
  function draw(ctx, scenario, idea, time, palette) {
    c=ctx;p=palette;
    const t=time>=.85?.85:Math.floor(clamp(time)*36)/36, u=ease(phase(t));
    c.save();c.clearRect(0,0,400,240);c.fillStyle=p.bg;c.fillRect(0,0,400,240);
    // Every shot is staged as folded planes of light above a smoked-glass strip.
    floor({hole:scenario==='pit'?3:-1,edge:scenario==='edge'});
    render(scenario,idea,t,u);
    c.restore();
  }
  function render(s,i,t,u) {
    const q=phase(t,.2,.68), act=Math.sin(Math.PI*q), exit=phase(t,.65,.8);
    const x=lerp(130,200,u), a=Math.PI/2*u;
    if(s==='move') {
      if(i===0){rect(130,154,70,6,p.bg);for(let j=0;j<5;j++)line(140+j*10,154,140+j*10,160,p.line,1);bot(x);line(x,-1+160,x,143,p.fg);if(q>.85){line(200,151,207,158,p.fg);line(207,151,200,158,p.fg);}}
      if(i===1){const f=phase(t,.15,.42),b=phase(t,.38,.73);let fx=130+70*ease(f),bx=130+70*ease(b);path([[bx-15,148],[bx+5,143],[fx-8,150],[fx+15,151]],p.muted);bot(bx,160,0,p.robot,{sy:1-.25*Math.sin(Math.PI*b)});rect(fx-18,158,13,6,p.fg);rect(fx+5,158,13,6,p.fg);}
      if(i===2){for(let j=0;j<3;j++){let f=phase(t,.13+j*.17,.29+j*.17);c.save();c.translate(130+j*35,160);c.scale(Math.max(.05,Math.abs(Math.cos(f*Math.PI))),1);tag(0,-25,36,50);if(f>.35&&f<.8)bot(0,0,0,p.robot,{sx:.6,sy:.7});c.restore();}if(t<.15)bot(130);if(t>.68)bot(200);}
      if(i===3){let r=phase(t,.08,.25);sheet(94,104,52,52,0,'MOVE 1');path([[94,156],[146,156],[146+35*r,165],[94+35*r,165]],p.muted);bot(x,160-12*(1-u));}
      if(i===4){bot(x,155);for(let j=0;j<4;j++){c.save();c.translate(x-18+j*12,161);c.rotate(j===3?(1-u)*1.7:0);rect(-4,-2,8,5,p.fg);c.restore();}if(q<.5)arrow(x+25,155,15,-1);}
    }
    else if(s==='turn') {
      if(i===0){let b=ease(phase(t,.35,.72)),h=ease(phase(t,.1,.3));bot(200,160,b*Math.PI/2);c.save();c.translate(200,132);c.rotate(h*Math.PI/2);rect(-17,-12,34,18,p.bg,p.line);circle(0,-4,4,p.fg,null);c.restore();if(t>.27&&t<.42)line(214,132,225,139,p.accent,3);}
      if(i===1){rect(242,156,19,9,p.muted);line(248,157,200+Math.cos(a)*20,137+Math.sin(a)*20,p.accent,4);circle(200,163,4,p.fg);bot(200,160,a);}
      if(i===2){let h=18*act;for(let j=0;j<4;j++)line(187,157-j*5-h/2,213,151-j*5-h/2,p.muted,1);bot(200,160-h,a);}
      if(i===3){const f=1-exit;line(200,24,200,62,p.muted,1);c.save();c.translate(200,60+70*exit);c.rotate(a);c.scale(f||.01,f||.01);arrow(-24,0,48);c.restore();bot(200,160,Math.PI/2*ease(phase(t,.3,.7)));}
      if(i===4){c.beginPath();c.arc(200,160,40,-Math.PI/2,-Math.PI/2+a);c.strokeStyle=p.muted;c.stroke();circle(200,160,4,p.accent);bot(200,160,a+.14*Math.sin(Math.PI*q*2)*(1-q));}
      circle(200,190,3,p.muted);c.save();c.translate(200,205);c.rotate(a);arrow(0,0,24,1);c.restore();
    }
    else if(s==='push') {
      const px=110+70*u,tx=180+70*u;
      if(i===0){bot(px);bot(tx,160,0,p.other);let h=act;path([[tx-23,132],[tx-42,132-12*h],[tx-42,151],[tx-23,151]],null);line(px+23,134,tx-42,134,p.robot,4);}
      if(i===1){bot(px);bot(tx,160,0,p.other,{sx:1-.38*act});for(let j=0;j<4;j++)line(tx-13+j*8,122,tx-18+j*8,151,p.fg,1);}
      if(i===2){path([[px+20,128],[tx-21,124],[tx-12,148],[px+21,149]],p.muted);bot(px,160,-.12*act);bot(tx,160,.12*act,p.other);}
      if(i===3){bot(px,160,.2*act);bot(tx,160,-.09*act,p.other);for(let j=0;j<2;j++)line(tx-12+j*23,154,tx-20+j*23+8*Math.sin(q*30),164,p.fg,4);}
      if(i===4){bot(px);bot(tx,160,0,p.other);sheet(tx+15,107,31,36*(.2+.8*act),0,q<.8?'1 TILE':'');if(t>.7)tag(tx+10,147,19,10);}
    }
    else if(s==='chain') {
      for(let j=0;j<3;j++){
        const bx=80+j*75+70*u;
        if(i===0){bot(bx,160,0,j%2?p.other:p.robot,{sx:1-.4*act});line(bx+21,130,bx+43,130);path([[bx+39,130],[bx+43,147],[bx+15,147]],null);}
        if(i===1){bot(bx,160,0,j%2?p.other:p.robot);let tap=Math.sin(Math.PI*phase(t,.15+j*.1,.4+j*.1));line(bx+24,132,bx+39,132-8*tap);if(t>.48&&t<.74){let look=phase(t,.48+(2-j)*.06,.54+(2-j)*.06);line(bx-9,128,bx-2,128-4*look,p.fg,2);}}
        if(i===2){bot(bx,153,0,j%2?p.other:p.robot);for(let k=0;k<4;k++)line(bx-22+k*13,151,bx-25+k*13+7*Math.sin(q*30+k),164,p.fg,3);}
        if(i===3){let sq=.35*Math.sin(Math.PI*phase(t,.12+j*.1,.46+j*.1));bot(bx,160,0,j%2?p.other:p.robot,{sx:1-sq,sy:1+sq*.3});}
        if(i===4){line(55+70*u,108,275+70*u,108,p.accent,4);bot(bx,160,0,j%2?p.other:p.robot);tag(bx,108,24,19,0,String(j+1));if(t>.67){line(bx+30,103,bx+36,113,p.bg,6);}}
      }
    }
    else if(s==='blocked') {
      rect(238,90,24,76,p.muted);for(let j=0;j<6;j++)line(238,98+j*11,262,98+j*11,p.line,1);
      if(i===0){bot(200);rect(237,119,8,5,p.fg);let sx=200+33*Math.sin(q*Math.PI);sheet(sx,126,29,22,0,q>.5?'RETURN':'');}
      if(i===1){bot(200,160,0,p.robot,{sx:1+.45*act,sy:1-.3*act});rect(183,158,13,5,p.fg);rect(207,158,13,5,p.fg);}
      if(i===2){bot(200);let f=phase(t,.47,.75);c.save();c.translate(239,153);c.rotate(f*1.5);rect(-1,-49,25,49,p.bg);circle(19,-24,2,p.fg);c.restore();line(221,135,235,116,p.fg,2);}
      if(i===3){bot(200,160,-.13*act);rect(222-13*act,123,17+13*act,9,p.bg);circle(222-13*act,127,5,p.bg);}
      if(i===4){bot(200,160,0,p.robot,{sx:1+.15*act});rect(196,105-60*act,7,7+60*act,p.bg);for(let j=0;j<4;j++)line(196,109-j*14*act,203,109-j*14*act,p.line,1);circle(200,102-60*act,4,p.accent);}
    }
    else if(s==='edge') {
      const travel=ease(phase(t,.08,.35)),drop=ease(phase(t,.48,.76)),bx=260+55*travel;
      if(i===0){c.save();c.translate(300,165);c.rotate(drop*1.7);path([[-35,0],[22,0],[22,7],[-35,7]],p.bg);if(drop<.97)bot(8,0,drop*.35,p.robot,{alpha:1-drop});c.restore();if(t<.25)bot(bx);}
      if(i===1){if(t<.34)bot(bx);else for(let j=0;j<8;j++){let d=phase(t,.32+j*.025,.6+j*.025);if(d<1){rect(294+j%2*3,112+j*6+110*d,38-j%3*4,4,p.robot);}}if(t>.35&&t<.73)tag(315,100+70*drop,31,22,drop,'ID');}
      if(i===2){if(drop<1)bot(bx,160+105*drop,0,p.robot,{alpha:1-drop});for(let j=0;j<5;j++){let xx=293+j*10;path([[xx,70+150*drop],[xx+9,70+150*drop],[xx+9+18*act,163+150*drop],[xx+18*act,157+150*drop]],p.muted);}}
      if(i===3){if(drop<1)bot(bx,160+130*drop,0,p.robot,{alpha:1-drop});let cd=phase(t,.6,.81);if(cd<1){sheet(330,94+150*cd,35,43);if(t>.4){line(338,116+150*cd,344,122+150*cd,p.accent,3);line(344,122+150*cd,355,105+150*cd,p.accent,3);}}}
      if(i===4){let bd=phase(t,.29,.56);if(bd<1)bot(bx,160+140*bd,0,p.robot,{alpha:1-bd});let wd=phase(t,.65,.81);if(wd<1){let ang=phase(t,.3,.65)*Math.PI*2;circle(315+18*Math.sin(ang),149-18*Math.cos(ang)+120*wd,6,p.fg);}}
    }
    else if(s==='pit') {
      const d=ease(phase(t,.57,.79)),bx=270,by=160+110*d;
      if(i===0){if(d<1){bot(bx,by,0,p.robot,{alpha:1-d});path([[bx-29,by-12],[bx-23,by-65*q],[bx+24,by-65*q],[bx+30,by-12]],p.muted);path([[bx-23,by-65*q],[bx,by-45*q],[bx+24,by-65*q]],null);c.beginPath();c.arc(bx,by-65*q,12,Math.PI,0);c.strokeStyle=p.fg;c.stroke();}}
      if(i===1){let r=22*(1-q),ang=q*Math.PI*4;if(q<.94)bot(bx+r*Math.cos(ang),155+90*d,ang*.15,p.robot,{sx:1-q*.85,sy:1-q*.65});if(q>.65&&d<1){line(bx,167,bx,155+60*d);circle(bx,155+60*d,3,p.accent);}}
      if(i===2){if(d<1){bot(bx,by);rect(bx-30,by-67,60,8,p.muted);let close=phase(t,.25,.48);rect(bx-30,by-59,30*close,59,p.bg);rect(bx+30-30*close,by-59,30*close,59,p.bg);word('↓',bx,by-74,p.accent,20);}}
      if(i===3){if(d<1){bot(bx,by,0,p.robot,{alpha:1-d});let reach=Math.sin(Math.PI*phase(t,.16,.58));line(bx,by-22,bx-55*reach,160,p.accent,4);for(let j=0;j<6;j++)line(bx-j*8*reach,by-22+(22*j/6),bx-j*8*reach,by-27+(22*j/6),p.fg,1);}}
      if(i===4){let fold=phase(t,.15,.51);if(d<1){bot(bx,by,fold*Math.PI/2,p.robot,{sx:1-.85*fold,sy:1-.15*fold,alpha:1-d});if(fold>.5){line(bx-7,by-34,bx+7,by-20);line(bx-7,by-20,bx+7,by-5);}}if(t>.6&&t<.8)circle(289,145+24*phase(t,.6,.8),4,p.bg);}
    }
    else if(s==='reboot') {
      const r=ease(phase(t,.2,.7));
      if(i===0){box(200,166,58,10+18*(1-r),1-r);if(r>0)bot(200,160,Math.PI*2*(1-r),p.robot,{sy:r});}
      if(i===1){rect(155,99,90,67,p.muted);path([[155,99],[245,99],[245,99+55*r],[155,99+55*r]],p.bg);if(r>0)bot(200,160,Math.PI*(1-r),p.robot,{alpha:r});if(r>.3&&r<.95)tag(222+20*r,132+20*r,45,20,r,'RETURN');}
      if(i===2){rect(165,159,70,11,p.muted);if(r>0){c.save();c.beginPath();c.rect(160,160-60*r,80,60*r);c.clip();bot(200,160);c.restore();for(let j=0;j<4;j++)line(178,156-j*12*r,220,156-j*12*r,p.line,1);}}
      if(i===3){wheel(183,92,12,q*5);wheel(217,92,12,-q*5);path([[191,96],[210,96],[211,160],[190,160]],p.robot);bot(200,160,0,p.robot,{sx:Math.max(.12,r),sy:.6+.4*r});if(q>.8)circle(224,150+15*exit,3,p.accent);}
      if(i===4){c.setLineDash([4,4]);c.strokeStyle=p.muted;c.strokeRect(176,111,48,50);c.setLineDash([]);if(r<1){rect(lerp(80,178,r),lerp(65,117,r),42,34,p.robot);rect(lerp(300,185,r),lerp(75,122,r),28,13,p.bg);rect(lerp(125,181,r),lerp(194,155,r),12,7,p.fg);rect(lerp(290,207,r),lerp(202,155,r),12,7,p.fg);}else bot(200);}
    }
    else if(s==='fire') {
      bot(75);bot(320,160,0,p.other);const fire=phase(t,.34,.54),on=t>.34&&t<.59;
      if(i===0){path([[96,123],[115,116],[127,123],[115,133]],p.muted);if(t>.18&&t<.37){line(120,124,300,101+85*phase(t,.18,.37),p.danger,1);}if(on)line(120,125,296,125,p.danger,4);}
      if(i===1){let reach=t<.5?fire:1-phase(t,.5,.73);line(99,126,99+197*reach,126,p.danger,on?5:3);for(let j=0;j<10*reach;j++)line(100+j*19,122,100+j*19,129,p.fg,1);}
      if(i===2){path([[158,31],[188,31],[178,43]],p.muted);if(t<.36){path([[176,43],[98,122],[115+70*(1-q),126]],p.danger,null);}if(on)line(100,125,296,125,p.danger,5);}
      if(i===3){wheel(103,128,11,q*10);if(t>.25&&t<.65){line(114,125,lerp(114,296,phase(t,.25,.45)),125,p.danger,on?4:1);if(t>.5){line(290,116,301,132,p.fg,2);line(301,116,290,132,p.fg,2);}}}
      if(i===4){let swell=Math.sin(Math.PI*phase(t,.14,.36));circle(104,126,5+10*swell,p.robot);if(on)line(113,125,296,125,p.danger,4);if(t>.6&&t<.77){rect(109-10*exit,119,12,15,p.bg);}}
      if(on)star(295,125,10,p.danger,q);
    }
    else if(s==='hit') {
      bot(200);if(t>.15&&t<.27)line(35,130,178,130,p.danger,4);
      if(i===0&&t>.23&&t<.65){rect(181,117,38,37,p.bg);for(let j=0;j<3;j++){line(183,125+j*10,216,125+j*10,p.fg,1);for(let k=0;k<3;k++)circle(187+k*12,121+j*10+(j===0&&k===1?9*q:0),2,p.muted);}}
      if(i===1){let ang=q*Math.PI*2;if(q>0&&q<.87)circle(200+22*Math.cos(ang+Math.PI),135+17*Math.sin(ang+Math.PI),6,p.bg);if(q>.8)tag(221,140-20*exit,23,15,exit,'1');}
      if(i===2){if(q<.68){c.beginPath();c.arc(200,133,7,0,Math.PI);c.strokeStyle=p.fg;c.stroke();wheel(231,118,8,q*9);}else{line(187,126,195,130);line(204,130,212,126);line(194,139,205,139);}}
      if(i===3){star(179,136,6,p.danger);let h=35*Math.sin(Math.PI*q);sheet(169,135,26,h,0,q>.15?'DMG':'');if(q>.85)tag(207,148,15,10);}
      if(i===4){let f=Math.sin(Math.PI*q*3)*(1-q);c.save();c.translate(219,124);c.rotate(-Math.abs(f)*1.6);rect(0,0,22,27,p.muted);c.restore();}
      if(t>.73)tag(240,145,25,18,0,'1');
    }
    else if(s==='belt') {
      for(let j=0;j<11;j++){let bx=90+j*16+(q*32)%16;path([[bx,170],[bx+7,175],[bx,180]],null,p.accent);}
      if(i===0){bot(x,155);for(let j=0;j<2;j++)line(x-12+j*24,151,x-18+j*24-9*Math.sin(q*36+j),163,p.fg,4);tag(200,95,24,20,0,'→');}
      if(i===1){let fold=Math.sin(Math.PI*q);if(fold>.65){rect(x-24,124,48,35,p.robot);path([[x-8,124],[x-8,115],[x+8,115],[x+8,124]],null);rect(x-19,159,7,5,p.fg);rect(x+12,159,7,5,p.fg);}else bot(x,160,0,p.robot,{sy:1-.5*fold});}
      if(i===2){bot(x);path([[x+20,144],[x+34,158],[x+20+20*act,173],[x-10,173]],null,p.accent);if(q>.85){path([[x+20,145],[x+10,139],[x+12,151],[x+20,145],[x+30,139],[x+28,151]],null,p.accent);}}
      if(i===3){rect(x-42,142,10,24,p.accent);path([[x-47,141],[x-29,141],[x-33,136],[x-43,136]],p.bg);bot(x);}
      if(i===4){bot(x,155-3*Math.sin(q*25));for(let j=0;j<4;j++){let xx=x-28+j*18;path([[xx,168],[xx+6,158+5*Math.sin(q*25+j)],[xx+12,168]],null,p.accent);}}
    }
    else if(s==='panel') {
      rect(65,94,30,70,p.muted);const reach=70*act;bot(x);
      if(i===0){rect(95,119,reach,36,p.bg);for(let j=0;j<3;j++)box(99+reach*(j+1)/4,151,12,16,0);}
      if(i===1){if(t<.4){c.save();c.translate(91,88);c.rotate(Math.sin(q*30)*.3);path([[-10,0],[0,-14],[10,0]],p.accent);circle(0,3,3,p.fg);c.restore();}rect(95,128,reach,10,p.bg);circle(95+reach,133,7,p.muted);}
      if(i===2){line(95,110,95+reach,110,p.accent,5);rect(90+reach,110,10,42,p.muted);for(let j=0;j<5;j++)line(92+reach,150,89+reach+j*2,158,p.fg,1);}
      if(i===3){let pts=[[95,108]];for(let j=1;j<=8;j++)pts.push([95+reach*j/8,108+(j%2?7:0)]);pts.push([95+reach,151]);for(let j=8;j>=0;j--)pts.push([95+reach*j/8,151+(j%2?7:0)]);path(pts,p.bg);}
      if(i===4){c.save();c.translate(95,134);c.scale(Math.max(.04,act),1);circle(31,0,34,p.bg);path([[0,-12],[31,0],[59,-12],[31,0],[59,12],[31,0],[0,12]],null,p.line);c.restore();}
    }
    else if(s==='gear') {
      wheel(200,169,30,a);bot(200,158-(i===0?10*act:0),Math.PI/2*ease(phase(t,i===3?.38:.2,.72)));
      if(i===0){c.save();c.translate(200,160);c.rotate(a);path([[-30,-8],[-27,8],[27,8],[30,-8]],null,p.accent);c.restore();}
      if(i===1){c.save();c.translate(200,165);c.rotate(a);tag(42,-8,35,19,-a,'SALE');c.restore();}
      if(i===2){for(let j=0;j<5;j++){line(185+j*7,146,185+j*7+25*act,165,p.accent,2);line(173+j*12,172,173+j*12,157,p.muted,3);}}
      if(i===3){c.save();c.translate(200,180);c.rotate(q*Math.PI);line(-19,0,19,0,p.fg,4);circle(-18,0,7,p.bg);circle(18,0,7,p.bg);c.restore();}
      if(i===4){circle(200,172,30,null,p.fg);circle(200,172,22,null,p.muted);line(200,105,230-20*u,158,p.accent,2);}
    }
    else if(s==='energy') {
      bot(200);const r=phase(t,.24,.65);
      if(i===0){rect(214,138,28*act,8,p.muted);if(q<.85){rect(lerp(246,217,r),lerp(99,138,r),13*(1-r*.7),13*(1-r*.7),p.accent);}}
      if(i===1){let end=270-65*r;path([[205,131],[220,141],[232,123],[245,144],[end,129]],null,p.accent);if(q<.9)rect(end,124,9,11,p.bg);}
      if(i===2){if(q<.8){c.save();c.translate(185+40*r,139-28*r);c.rotate(r*2);tag(0,0,37,17,0,'LOW');c.restore();}if(q>.35){tag(200,145,23,15,0,'+1');}}
      if(i===3){wheel(224,143,10,q*Math.PI*2);line(223,128,231+11*Math.sin(q*Math.PI*2),143-11*Math.cos(q*Math.PI*2),p.muted,4);}
      if(i===4){for(let j=0;j<3;j++){let size=(24-j*6)*(1-r*.85);rect(250-size/2-45*r,137-size/2,size,size,p.accent);}if(q>.8)circle(204,138,3,p.accent);}
      if(t>.7)tag(200,86,35,21,0,'+1');
    }
    else if(s==='checkpoint') {
      bot(200);const v=Math.sin(Math.PI*phase(t,.17,.65));
      if(i===0){sheet(225,114,25,43,0,'1');rect(220,94+28*v,37,9,p.muted);if(q>.55)circle(238,134,5,p.bg,p.accent);}
      if(i===1){path([[158,154],[165,110-15*v],[200,100+30*v],[235,110-15*v],[242,154]],null,p.accent);circle(158,155,4,p.fg);circle(242,155,4,p.fg);}
      if(i===2){rect(180,22+52*v,40,17,p.muted);rect(194,7+52*v,12,16,p.bg);if(q>.5)word('1',200,183,p.accent,18);}
      if(i===3){const print=phase(t,.08,.30),fold=phase(t,.30,.58),pack=phase(t,.65,.80);if(print>0&&t<.30){const height=54*print;rect(173,160-height,54,height,p.bg);for(let j=7;j<height;j+=8)line(179,160-j,221,160-j,p.muted,1);}else if(t>=.30&&pack<1){c.save();c.translate(200+18*pack,106+40*pack);c.scale(1-.65*pack,1-.35*pack);path([[-27,0],[-20,-11*fold],[-10,-1*fold],[0,-15*fold],[10,-1*fold],[21,-11*fold],[27,0],[27,7],[-27,7]],p.bg);word('1',0,3,p.accent,12);c.restore();}else if(pack===1)tag(218,146,19,15,0,'1');}
      if(i===4){for(const sign of [-1,1]){c.save();c.translate(200+sign*48,164);c.rotate(sign*.45*v);rect(-7,-65,14,65,p.muted);rect(-4,-56,8,17,p.accent);c.restore();}if(q<.5)line(154,125,246,125,p.accent,1);}
      if(t>.7)tag(200,81,38,23,0,'CP 1');
    }
    else if(s==='damage') {
      bot(115);rect(270,123,44,43,p.muted);word('DECK',292,183,p.fg,11);
      if(i===0){const r=phase(t,.15,.73);let ex=r<.35?lerp(240,135,r/.35):r<.65?lerp(135,190,(r-.35)/.3):lerp(190,290,(r-.65)/.35);tag(ex,121-25*Math.sin(r*Math.PI),37,24,0,'SPAM');path([[ex-18,109-25*Math.sin(r*Math.PI)],[ex,121-25*Math.sin(r*Math.PI)],[ex+18,109-25*Math.sin(r*Math.PI)]],null);}
      if(i===1){rect(174,128,70,36,p.muted);sheet(180+70*u,120-15*act,43,40,0,'SPAM');sheet(190,131-30*u,43,40,0,'MOVE 1');}
      if(i===2){sheet(170,44,64,45,0,'HAYWIRE');for(let j=0;j<3;j++)line(179+j*22,89,100+j*15+10*act,129+10*Math.sin(q*20+j),p.muted,1);if(q>.7)arrow(185,108,42);}
      if(i===3){let w=90*act;for(let j=0;j<6;j++){c.save();c.translate(174+j*w/6,118+j%2*8);c.rotate((j%2?1:-1)*.2*act);sheet(0,0,22,31,0,j===0?'1':'');c.restore();}if(q>.85)sheet(270,112,42,45,0,'SPAM');}
      if(i===4){rect(175,121,80,40,p.muted);wheel(192,133,11,q*8);wheel(237,133,11,-q*8);if(q<.4)sheet(193,82+35*q,43,37,0,'SPAM');if(q>.45)sheet(193,142+15*phase(t,.4,.7),43,35,0,'MOVE 1');}
    }
    else if(s==='shield') {
      bot(230);const on=t>.26&&t<.56; if(on)line(38,132,195,132,p.danger,4);
      if(i===0){c.save();c.translate(204,133);c.rotate(-Math.PI/2);path([[-29,0],[-18,-18],[0,-26],[18,-18],[29,0]],p.bg);for(let j=0;j<5;j++)line(0,0,-29+j*14.5,-22*Math.sin(j*Math.PI/4),p.muted,1);line(0,0,0,22,p.fg,2);c.restore();if(on)circle(196,134+18*q,3,p.accent);}
      if(i===1){rect(191,115,10,38,p.muted);if(on)tag(178,132,35,23,0,'RET');if(t>.53&&t<.74){for(let j=0;j<6;j++)rect(176+j*3,138+50*phase(t,.53,.74),2,17,p.accent);}}
      if(i===2){circle(205,132,18*(1-.6*act),p.bg,p.accent);if(on){circle(203,132,5*(1-q),p.accent);}}
      if(i===3){let f=t<.6?phase(t,.12,.25):1-phase(t,.6,.77);rect(195,104,65,60*f,p.muted);for(let j=0;j<6*f;j++)line(195,108+j*9,260,108+j*9,p.line,1);if(f>.7)tag(228,133,44,19,0,'CLOSED');}
      if(i===4){let yy=110+40*q;rect(196,yy,12,27,p.bg);line(202,yy+27,216,yy+40,p.muted,3);if(on)rect(195,yy+5,3,18,p.accent);if(q>.75&&q<.98){path([[194,yy],[184,yy+15],[190,yy+32]],null,p.accent);}}
    }
    else if(s==='upgrade') {
      if(i===0){bot(200);let r=phase(t,.14,.71),tx=r<.3?270-150*r:r<.65?225-90*(r-.3):193+70*(r-.65);let ty=95+45*r;rect(263,88,28,47,p.bg);c.save();c.translate(tx,ty);c.rotate(r*5);line(0,-9,0,12,p.muted,5);path([[-8,-12],[-7,-3],[7,-3],[8,-12]],null,p.fg,3);c.restore();}
      if(i===1){bot(130);bot(270,160,0,p.other);let radius=135*q;circle(130,138,radius,null,p.accent);for(let j=0;j<3;j++){let xx=160+j*55;tag(xx,85,45,20,0,radius>xx-130&&q<.9?'CLOSED':'OPEN');}}
      if(i===2){const close=Math.sin(Math.PI*q);bot(130+140*u);bot(270-140*u,160,0,p.other);for(const xx of [130,270]){rect(xx-31,99,62,5,p.muted);for(let j=0;j<6;j++)rect(xx-30+j*10,104,10,60*close,p.bg);}}
      if(i===3){bot(100);bot(270-70*u,160,0,p.other);let end=270-70*u;line(122,145,end-25,145,p.accent,4);for(let j=0;j<10;j++)line(128+j*(end-156)/10,141,128+j*(end-156)/10,147,p.fg,1);}
      if(i===4){bot(100);let bx=200+70*u,fold=Math.sin(Math.PI*q);bot(bx,160,0,p.other,{sy:1-.65*fold});rect(bx-29,160-22*fold,58,22*fold,p.muted);circle(bx,157-10*fold,3,p.fg);}
    }
    else if(s==='shutdown') {
      bot(200,160,0,p.robot,{sleep:q>.7,sy:i===2?1-.45*u:1});
      if(i===0){let h=62*u;path([[169,160-h],[181,152-h],[220,152-h],[232,160-h],[238,164],[163,164]],p.bg);if(q<.7){line(200,160-h,200,146-h);circle(200,145-h,3,p.accent);}}
      if(i===1){rect(182,137,37,18*(1-u),p.muted);if(q>.5)tag(200,130,34,15,0,'CLOSED');if(q<.95)line(223,147,219,147+8*(1-q),p.fg,3);}
      if(i===2){let f=u;path([[178,150],[178,150-18*f],[220,150-18*f],[220,151],[178,151]],p.muted);line(180,151,177,164,p.fg,3);line(218,151,222,164,p.fg,3);}
      if(i===3){let h=64*u;path([[169,164],[169,164-h],[229,164-h],[231,164],[169,164]],p.muted);for(let j=0;j<8*u;j++)path([[172,160-j*8],[182,155-j*8],[192,160-j*8],[202,155-j*8],[212,160-j*8],[224,155-j*8]],null,p.line);tag(235,120,25,32,.2,'MNT');}
      if(i===4){let f=1-phase(t,.45,.73);wheel(233,133,12,f*q*14);line(177,139,162+10*(1-phase(t,.2,.45)),133,p.muted,3);if(q>.87){rect(225,130,16,6,p.muted);}}
    }
    else if(s==='win') {
      const r=ease(phase(t,.16,.7));bot(200,160,i===3?.15*Math.sin(Math.PI*phase(t,.5,.76)):0);
      if(i===0){let w=66+24*r,yy=40+55*r;rect(200-w/2-7,yy-7,w+14,79,p.muted);rect(200-w/2,yy,w,65,p.bg);bot(200);tag(200,yy+85,76,19,0,'EMPLOYEE');}
      if(i===1){let h=100*(1-r)+30;sheet(245,65,62,h,0,r>.85?'WINNER':'TOTAL');if(r<.8)for(let j=0;j<6;j++)line(251,91+j*9*(1-r),299,91+j*9*(1-r),p.line,1);}
      if(i===2){for(let j=0;j<3;j++){let yy=185-j*8*r;box(200,yy,78-j*8,8,0);}path([[159,108],[166,83*r+25],[181,107],[199,63+23*(1-r)],[216,107],[233,83*r+25],[241,108]],p.accent);bot(200);}
      if(i===3){for(let j=0;j<4;j++){let xx=70+j*87;c.save();c.translate(xx,73);c.rotate((xx<200?1:-1)*.6*Math.sin(Math.PI*q));tag(0,0,40,22,0,'SALE');line(0,-15,0,-40,p.muted,1);c.restore();}}
      if(i===4){if(q<.55){line(176,140,225,140,p.accent,3);line(197,135,205,145,p.fg,1);line(205,135,197,145,p.fg,1);}let w=250*phase(t,.4,.72);path([[200-w/2,73],[200+w/2,73],[200+w/2-8,101],[200-w/2+8,101]],p.accent);if(q>.7)word('WINNER',200,92,p.bg,18);}
    }
  }
  globalThis.RRPaper = {name:'Folded-light theatre', draw, treatments, coverage:treatments};
})();
