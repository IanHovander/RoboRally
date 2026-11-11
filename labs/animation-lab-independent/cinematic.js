/* Optical mischief: independent Lumen motion studies, deterministic canvas renderer. */
(()=>{
const clamp=x=>Math.max(0,Math.min(1,x)),phase=(t,a=.18,b=.7)=>clamp((t-a)/(b-a)),ease=x=>x*x*(3-2*x),mix=(a,b,t)=>a+(b-a)*t;
const treatments={
move:['A luminous receipt winches the chassis while its reflection lags one beat','Detached light skates stop first; a glass concertina gathers the body','Successive glass price tiles flip reflected poses into the real robot','A glowing register card hinges into a ramp that unfolds its passenger','Three caster halos align; the fourth turns only when the eye notices'],
turn:['The eye orbit asks first; the reflective shell reluctantly follows','A label beam anchors a pivot and peels the facing through a quarter circle','A helix lifts the polished shell; it screws back into its unchanged ring','A floating aisle arrow turns then refracts into the robot eye','One light skate anchors while a compass arc pulls the shell around'],
push:['A handle emerges as a luminous loop; the pusher gently escorts the target','Glass body slices concertina forward then apologize with a tiny bow','A liquid light bridge peels between cheek-to-cheek robots','A dignified lean moves the target before its skates begin a frantic run','The target reads a displacement receipt in its own reflection before gliding'],
chain:['Nested transparent silhouettes telescope then regain their spacing','A sharp eye squint travels backward along the moving queue','One shared wave of light feet carries three composed glass bodies','A refraction ripple passes through shells above synchronized base rings','A single luminous ticket ribbon pulls all bodies and tears at arrival'],
blocked:['A wall scans a receipt and sends it backward as a folded rejection','The shell continues toward the wall while its base remains conspicuously fixed','A lit doorway is drawn on glass then slides off as a useless decal','A thin finger of wall light taps the eye back into its original shell','The compression climbs the shell and escapes through a telescope antenna'],
edge:['The last glass tile peels up like a sample and folds the robot into darkness','A scan bar resolves the shell into falling slices of luminous barcode','An almost invisible curtain reveals the missing floor as it swings away','An audit clipboard pauses in midair; one check releases gravity','The body vanishes while one caster halo finishes an oblivious orbit'],
pit:['A translucent bag rises from the pit and seals before sinking','A spiral of reflected body slices drains with one stubborn level eye','Elevator panes rise, blink a down arrow, and descend into the void','The rescue tape measures carefully, approves the distance, and retracts','The shell folds into a bright parcel edge that drops with a late peanut'],
reboot:['A glowing carton net assembles a polished body above the return ring','A hatch ejects a reversed silhouette that sheds a returns sticker','A luminous receipt silhouette acquires volume in a rising scan','Two rollers wring a narrow ribbon into the familiar polished body','A scanning outline summons separate parts into their proper sockets'],
fire:['A scanner fan narrows to one precise luminous ray','A light ruler reaches the endpoint and snaps into a thin beam','A ceiling cone collapses into the muzzle before a clean flash','A spool unreels a straight optical thread and cuts it at the target','A swollen glass muzzle sneezes a single ray then wipes itself'],
hit:['A translucent x-ray opens a cabinet of hardware inside the shell','One dark dent orbits the curved body before becoming a damage chit','The shell jolts while its eye keeps smiling until a delayed iris snap','A thermal receipt grows from the exact strike point and folds into the shell','A hinged side facet claps twice in growing disbelief'],
belt:['Backward skating fails to cancel the conveyor reflection beneath it','The robot becomes a translucent suitcase and unfolds at the belt endpoint','The belt catches a luminous cable and releases a tidy light bow','A glass divider escorts the body and hinges around the belt curve','Rows of tiny light feet emerge beneath the moving glass slats'],
panel:['A glass drawer full of refracted boxes extends and inhales them again','A tiny bell lights before a single padded finger commits the shove','A light shelf sweeper aligns the robot with an imagined row of stock','A thin wall expands into many glass concertina facets then collapses','A transparent cushion presses the robot and exhales into a flat line'],
gear:['A luminous jar grip tightens, pops, and releases at a quarter turn','A display plate rotates with a late price placard catching its front','Comb teeth draw luminous cables through the gear and tug the facing','A glass wind-up key stores the turn then releases it into the body','A record-like light ring scratches one precise quarter-turn'],
energy:['A glass vending tongue catches one gold cell and slides into the shell','A glowing cable spirals into the eye with a late plug tap','A dim label peels away as a gold charge line rolls beneath it','A tiny reflected arm cranks exactly once and droops with exhaustion','Nested transparent cells close around one final absorbed spark'],
checkpoint:['A timecard is punched and its hole focuses into the earned numeral','A light rope tangles for a beat then snaps into a clean checkpoint ring','A giant stamp stops above the head and marks only its reflection','A luminous receipt folds into a crown then becomes a compact badge','Glass security gates almost blink red, then bow in approval'],
damage:['A rejected envelope slides under the glass and returns to the deck','A replacement card crawls from a drawer and seats itself in the register','Haywire strings tug a reflection before straightening into a command arrow','An impossibly long coupon folds into the single actual damage card','Opposing glass rollers chew a card and eject the real replacement'],
shield:['Warranty pages fan into a glass umbrella that drains the ray into its spine','A beam is stamped into an envelope and shredded at the impact point','A clear packing bubble swells, absorbs a ray, and pops inward','A thin service shutter drops just before impact and opens afterward','A roller collects the beam as a sticky stripe then peels it away'],
upgrade:['A glass tool tries mounting sockets before choosing one','A circular wave flips only affected signs and dies into their rings','Two refracting curtains exchange the bodies while their facings stay fixed','A luminous ruler hooks the target ring and pulls exactly one tile','The target compresses into a glass drawer and opens at the resolved tile'],
shutdown:['A translucent cover lowers, catches the antenna, then relaxes to stillness','A chest drawer closes almost fully until one tiny finger finishes it','The body folds into a quiet glass chair on its unchanged ring','A luminous knitted sleeve rolls upward and leaves a maintenance tag','Appendages stop in sequence; a last little fan notices and closes'],
win:['A portrait frame expands awkwardly around the winner’s antenna','A long receipt optically collapses into one large winner total','Glass carton nets make a display plinth beneath the stationary champion','Aisle lights bow first; the winner’s reflection bows before it catches up','Tiny scissors cut a light ribbon that unfolds behind the champion']
};
function draw(ctx,s,i,time,p){
 const t=Math.min(.85,clamp(time)),u=ease(phase(t)),q=phase(t),pulse=(a=.18,b=.7)=>Math.sin(Math.PI*phase(t,a,b)),fade=1-phase(t,.7,.83);
 const c=ctx; c.save();c.fillStyle=p.bg;c.fillRect(0,0,400,240);c.lineCap='round';c.lineJoin='round';
 const line=(x,y,X,Y,color=p.fg,w=1.4)=>{c.beginPath();c.moveTo(x,y);c.lineTo(X,Y);c.strokeStyle=color;c.lineWidth=w;c.stroke()};
 const poly=(pts,color=p.bg,stroke=p.fg,alpha=1)=>{c.save();c.globalAlpha*=alpha;c.beginPath();pts.forEach(([x,y],j)=>j?c.lineTo(x,y):c.moveTo(x,y));c.closePath();if(color){c.fillStyle=color;c.fill()}if(stroke){c.strokeStyle=stroke;c.lineWidth=1.3;c.stroke()}c.restore()};
 const rect=(x,y,w,h,color=p.bg,stroke=p.fg)=>poly([[x,y],[x+w,y],[x+w,y+h],[x,y+h]],color,stroke);
 const ellipse=(x,y,rx,ry,color=null,stroke=p.fg,w=1.3)=>{c.beginPath();c.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,Math.PI*2);if(color){c.fillStyle=color;c.fill()}if(stroke){c.strokeStyle=stroke;c.lineWidth=w;c.stroke()}};
 const glow=(x,y,r,color=p.fg)=>{c.save();c.shadowBlur=12;c.shadowColor=color;ellipse(x,y,r,r,color,null);c.restore()};
 const label=(txt,x,y,color=p.fg,size=13)=>{c.font=`500 ${size}px sans-serif`;c.textAlign='center';c.fillStyle=color;c.fillText(txt,x,y)};
 const arrow=(x,y,len=28,a=0,color=p.fg)=>{c.save();c.translate(x,y);c.rotate(a);line(0,0,len,0,color,2);poly([[len,0],[len-6,-4],[len-6,4]],color,null);c.restore()};
 const ring=(x,y=177,a=0,color=p.robot)=>{c.save();c.shadowColor=color;c.shadowBlur=6;ellipse(x,y,28,8,null,color,1);const X=x+Math.cos(a)*32,Y=y+Math.sin(a)*10;poly([[X,Y],[X-7*Math.cos(a)+3*Math.sin(a),Y-3*Math.sin(a)-3*Math.cos(a)],[X-7*Math.cos(a)-3*Math.sin(a),Y-3*Math.sin(a)+3*Math.cos(a)]],color,null);c.restore()};
 const shell=(x,y=172,{a=0,sx=1,sy=1,color=p.robot,eye=0,alpha=1,lean=0,reflect=true,base=true}={})=>{
  c.save();c.globalAlpha*=alpha;if(base)ring(x,177,a,color);
  if(reflect){c.save();c.globalAlpha*=.13;c.translate(x,196);c.scale(sx,-.45*sy);ellipse(0,0,23,29,color,null);c.restore()}
  c.translate(x,y);c.rotate(lean);c.scale(sx,sy);
  const g=c.createLinearGradient(-24,-48,26,0);g.addColorStop(0,p.fg);g.addColorStop(.18,color);g.addColorStop(.7,p.bg);g.addColorStop(1,color);c.fillStyle=g;c.beginPath();c.roundRect(-23,-53,46,48,18);c.fill();c.strokeStyle=color;c.lineWidth=1;c.stroke();
  c.save();c.shadowColor=p.fg;c.shadowBlur=9;const ex=Math.sin(a)*12;ellipse(ex,-33,eye===2?9:6,eye===1?1.4:3,p.fg,null);c.restore();line(-13,-46,-4,-49,p.fg,.7);c.restore();
 };
 const beam=(x,X,y=143,w=2)=>{c.save();c.shadowColor=p.danger;c.shadowBlur=11;line(x,y,X,y,p.danger,w);line(x,y,X,y,p.fg,.6);c.restore()};
 const receipt=(x,y,len=42,w=20,a=0)=>{c.save();c.translate(x,y);c.rotate(a);rect(-w/2,0,w,len,p.bg,p.fg);for(let j=7;j<len-4;j+=7)line(-w*.3,j,w*.3,j,p.muted,1);c.restore()};
 const card=(x,y,txt='1',w=32,h=42,a=0)=>{c.save();c.translate(x,y);c.rotate(a);rect(-w/2,-h/2,w,h,p.bg,p.accent);label(txt,0,5,p.accent,13);c.restore()};
 const coil=(x,y,X,Y,n=8,color=p.fg)=>{c.beginPath();c.moveTo(x,y);for(let j=1;j<n*2;j++){const v=j/(n*2);c.lineTo(mix(x,X,v),mix(y,Y,v)+(j%2?5:-5))}c.lineTo(X,Y);c.strokeStyle=color;c.lineWidth=1.4;c.stroke()};
 const cube=(x,y,k=16,color=p.accent)=>{poly([[x,y-k],[x+k,y-k*.5],[x,y],[x-k,y-k*.5]],p.bg,color);poly([[x-k,y-k*.5],[x,y],[x,y+k],[x-k,y+k*.5]],p.bg,color);poly([[x,y],[x+k,y-k*.5],[x+k,y+k*.5],[x,y+k]],p.bg,color)};
 const shutter=(x,y,w,h,n=7)=>{rect(x,y,w,h,p.bg);for(let j=1;j<n;j++)line(x,y+h*j/n,x+w,y+h*j/n,p.muted)};
 const gear=(x,y,r,a=0)=>{ellipse(x,y,r,r*.35,null,p.accent);for(let j=0;j<12;j++){const b=a+j*Math.PI/6;line(x+Math.cos(b)*r,y+Math.sin(b)*r*.35,x+Math.cos(b)*(r+5),y+Math.sin(b)*(r+5)*.35,p.accent,3)}};
 // A thin perspective slab: all studies retain a visible place on the board.
 poly([[40,170],[335,170],[372,196],[65,196]],p.bg,p.line);line(65,196,65,201,p.line);line(65,201,372,201,p.line);line(372,201,372,196,p.line);
 for(let j=0;j<5;j++)line(40+j*59,170,65+j*61.4,196,p.line,.6);
 if(s==='edge'){rect(265,166,135,40,p.bg,null);line(265,170,286,196,p.fg,1.5)}
 if(s==='pit'){ellipse(200,180,46,15,p.bg,p.muted);ellipse(200,181,38,10,p.bg,null)}
 const x=mix(125,225,u),spin=Math.PI/2*u;
 switch(s){
 case 'move':{
  if(i===0){line(125,178,225,178,p.accent,3);for(let j=0;j<6;j++)line(130+j*16,177,130+j*16,181,p.fg,.7);shell(x);receipt(x,145,18*pulse(),14,-Math.PI/2);if(t>.68&&t<.8){line(221,173,228,182,p.fg);line(221,182,228,173,p.fg)}}
  if(i===1){const fx=mix(125,225,ease(phase(t,.1,.4))),bx=mix(125,225,ease(phase(t,.37,.73)));ellipse(fx-13,176,8,3,p.fg,null);ellipse(fx+13,176,8,3,p.fg,null);coil(bx,164,fx,169,7,p.robot);shell(bx,172,{sx:1-.3*pulse(.3,.72),base:false});ring(fx)}
  if(i===2){for(let j=0;j<4;j++){const v=phase(t,.1+j*.13,.25+j*.13);c.save();c.translate(125+j*33.3,170);c.scale(Math.max(.03,Math.abs(Math.cos(v*Math.PI))),1);rect(-18,-60,36,65,p.bg,p.line);if(v>.1&&v<.9)shell(0,0,{sx:.65,sy:.8,base:false,reflect:false});c.restore()}if(t<.12)shell(125);if(t>.65)shell(225)}
  if(i===3){const r=phase(t,.04,.23);card(103,135,'→',42,55,-r*.2);poly([[106,162],[130,162],[168,178],[140,178]],p.bg,p.fg);shell(x,172-15*(1-u));if(t<.3)glow(115,118,3*pulse(.02,.3),p.accent)}
  if(i===4){shell(x,168);for(let j=0;j<4;j++){const a=j===3?(1-ease(phase(t,.3,.46)))*Math.PI/2:0;c.save();c.translate(x-24+j*16,176);c.rotate(a);ellipse(0,0,6,2,null,j===3?p.accent:p.fg,2);c.restore()}if(t>.2&&t<.38)arrow(x+28,130,17,-Math.PI/2,p.accent)}
  break;
 }
 case 'turn':{
  const h=ease(phase(t,.08,.28)),b=ease(phase(t,.34,.72));
  if(i===0){shell(200,172,{a:Math.PI/2*b});ellipse(200+12*Math.sin(h*Math.PI/2),139,7,3,p.fg,null);if(t>.26&&t<.43){line(217,140,227,148,p.fg);glow(226,149,2,p.accent)}}
  if(i===1){card(250,175,'',18,12);line(248,171,200+26*Math.cos(spin),168+8*Math.sin(spin),p.accent,3);shell(200,172,{a:spin});ellipse(200,179,3,1.5,p.fg,null)}
  if(i===2){const lift=24*pulse();for(let j=0;j<3;j++)ellipse(200,172-j*7-lift*.3,16,4,null,p.robot);shell(200,172-lift,{a:spin});}
  if(i===3){const z=phase(t,.57,.78);c.save();c.globalAlpha=1-z;arrow(174,58+80*z,52,h*Math.PI/2);c.restore();line(200,25,200,53,p.line);shell(200,172,{a:b*Math.PI/2});if(z>0&&z<1)line(200,62+80*z,200,138,p.fg,.8)}
  if(i===4){const a=spin+.18*Math.sin(q*Math.PI*2)*(1-q);ellipse(200,178,4,2,p.fg,null);c.beginPath();c.ellipse(200,178,39,12,0,0,Math.max(.01,spin));c.strokeStyle=p.fg;c.stroke();shell(200,172,{a});ellipse(200+35*Math.cos(spin),178+11*Math.sin(spin),7,2,p.robot,null)}
  break;
 }
 case 'push':{
  const a=110+68*u,b=180+68*u;const z=pulse();
  if(i===0){shell(a);shell(b,172,{color:p.other});c.save();c.globalAlpha=z;c.beginPath();c.roundRect(b-47,136,29,20,7);c.strokeStyle=p.fg;c.stroke();line(a+17,145,b-32,145,p.fg,2);c.restore()}
  if(i===1){shell(a,172,{lean:.12*z});shell(b,172,{color:p.other,sx:1-.4*z,sy:1+.2*z,lean:-.13*pulse(.57,.8)});for(let j=0;j<5;j++){const xx=b-23+j*11.5;line(xx,126+(j%2?5:0),xx,164-(j%2?5:0),p.other,.8)}}
  if(i===2){shell(a,172,{lean:.2*z});shell(b,172,{color:p.other,lean:-.2*z});c.save();c.globalAlpha=z;poly([[a+19,138],[b-18,132],[b-18,160],[a+19,151]],null,p.fg);line(a+20,144,b-18,144,p.robot,4);c.restore()}
  if(i===3){shell(a,172,{lean:.17*z});shell(b,172,{color:p.other,eye:t>.35&&t<.68?2:0});for(let j=0;j<3;j++){const xx=b-20+j*20;line(xx,168,xx+8*Math.sin(t*60+j),178,p.fg,2)}}
  if(i===4){shell(a);shell(b,172,{color:p.other});if(t>.16&&t<.7){receipt(b-26,129,40*pulse(.16,.7),17,-.2);label('1',b-28,146,p.accent,12);line(b-13,145,b-26,151,p.fg)}}
  break;
 }
 case 'chain':{
  for(let j=0;j<3;j++){const xx=100+j*73+48*u,col=j===0?p.robot:p.other,z=Math.sin(Math.PI*phase(t,.15+j*.08,.55+j*.08));
   if(i===0){shell(xx,172,{color:col,sx:1-.4*pulse(),alpha:1-.2*pulse()});if(t>.17&&t<.68){ellipse(xx,151,29,18,null,col);line(xx-26,141,xx+24,141,p.fg)}}
   if(i===1){shell(xx,172,{color:col,eye:Math.abs(t-(.62-j*.1))<.06?1:0});if(t>.18+j*.08&&t<.36+j*.08)line(xx+22,144,xx+48,136,p.fg,2)}
   if(i===2){shell(xx,172,{color:col});for(let k=0;k<3;k++)line(xx-18+k*18,164,xx-18+k*18+Math.sin(t*55+j+k)*8,178,p.fg,2)}
   if(i===3){shell(xx,172,{color:col,sx:1-.25*z,sy:1+.16*z});if(z>.2)ellipse(xx,143,25,12,null,p.fg,.7)}
   if(i===4){shell(xx,172,{color:col});if(t>.1&&t<.77){card(xx,112,String(j+1),24,28);if(j<2)line(xx+12,112,xx+61,112,p.fg,2)}}
  }break;
 }
 case 'blocked':{
  const z=pulse();poly([[252,89],[266,98],[266,177],[252,170]],p.bg,p.fg);shell(205,172,{sx:i===1?1+.3*z:1,lean:i===1?.2*z:0});
  if(i===0&&t>.12&&t<.77){const v=t<.4?phase(t,.12,.4):1-phase(t,.4,.77);receipt(218+31*v,144,28,15,Math.PI/2);if(t>.38&&t<.6)label('×',243,120,p.danger,18)}
  if(i===1){ring(205);ellipse(205,176,20,4,null,p.fg);if(t>.2&&t<.65)line(226,150,252,150,p.robot,7*z)}
  if(i===2){const d=phase(t,.12,.4),fall=phase(t,.48,.77);c.save();c.translate(250,145+45*fall);c.rotate(-fall*.8);c.globalAlpha=1-fall;line(-1,0,-1,-45*d,p.fg);line(-1,-45*d,28*d,-45*d,p.fg);line(28*d,-45*d,28*d,0,p.fg);ellipse(20,-20,2,2,p.fg,null);c.restore()}
  if(i===3){const v=pulse(.2,.7);line(253,133,228-9*v,133,p.fg,5);ellipse(228-9*v,133,5,5,p.bg,p.fg);if(t>.32&&t<.62)ellipse(207,139,8,1,p.fg,null)}
  if(i===4){const h=58*z;line(205,119,205,119-h,p.robot,4);for(let j=0;j<3;j++)ellipse(205,112-h*j/3,5,2,null,p.fg);glow(205,115-h,3,p.fg)}
  break;
 }
 case 'edge':{
  const approach=ease(phase(t,.05,.28)),fall=ease(phase(t,.45,.76)),xx=215+63*approach;
  if(i===0){const f=phase(t,.25,.74);c.save();c.translate(267,173);c.rotate(f*1.5);poly([[-30,0],[0,0],[14,22],[-17,22]],p.bg,p.fg);if(f<.97)shell(-7,0,{base:false,reflect:false,lean:f*.6});c.restore();if(t<.25)shell(xx)}
  if(i===1){if(t<.3)shell(xx);else{for(let j=0;j<8;j++){const d=ease(phase(t,.3+j*.025,.63+j*.025));if(d<1){c.save();c.beginPath();c.rect(245,116+j*7+95*d,65,6);c.clip();shell(278,172+95*d,{alpha:1-d,base:false,reflect:false});c.restore()}}line(249,116+58*phase(t,.3,.58),306,116+58*phase(t,.3,.58),p.fg,1)}if(t>.55&&t<.76)card(280,187,'ID',21,16,.2)}
  if(i===2){if(t<.76)shell(xx,172+95*fall,{alpha:1-fall,base:false,reflect:false});const f=phase(t,.2,.73);for(let j=0;j<7;j++){const X=269+j*4;line(X,86+90*f,X+15*Math.sin(f*Math.PI),176+90*f,p.fg,.7)}if(t>.73)rect(267,86,80,145,p.bg,null)}
  if(i===3){if(t<.58)shell(xx,172+100*ease(phase(t,.47,.58)),{base:false,reflect:false});if(t>.22&&t<.72){const f=ease(phase(t,.6,.72));card(313,125+130*f,'',28,38,.1);if(t>.41){line(306,125+130*f,312,131+130*f,p.accent,2);line(312,131+130*f,324,114+130*f,p.accent,2)}line(278,147,300,140+80*f,p.fg)}}
  if(i===4){const drop=ease(phase(t,.24,.47));if(t<.47)shell(xx,172+100*drop,{base:false,reflect:false,alpha:1-drop});if(t>.21&&t<.79){const v=phase(t,.21,.6),d=ease(phase(t,.63,.79));ellipse(280+18*Math.sin(v*Math.PI*2),150-12*Math.cos(v*Math.PI*2)+95*d,7,4,null,p.fg,2);if(t>.56&&t<.65)line(280,156,280,166,p.accent)}}
  break;
 }
 case 'pit':{
  const down=ease(phase(t,.5,.8)),z=pulse(.14,.65);const present=t<.8;
  if(i===0){if(present)shell(200,172+100*down,{alpha:1-down,base:false,reflect:false});const rise=phase(t,.14,.38);if(t<.8){c.save();c.globalAlpha=1-down;poly([[164,181+100*down],[164,181-70*rise+100*down],[236,181-70*rise+100*down],[236,181+100*down]],null,p.fg);line(164,181-70*rise+100*down,200,144-25*rise+100*down,p.fg);line(236,181-70*rise+100*down,200,144-25*rise+100*down,p.fg);ellipse(200,113+100*down,15,9,null,p.fg);c.restore()}}
  if(i===1){const v=phase(t,.16,.77),r=27*(1-v);if(v<1){const xx=200+r*Math.sin(v*Math.PI*4),yy=172+v*30; shell(xx,yy,{sx:1-v*.8,sy:1-v*.92,alpha:1-v,base:false,reflect:false});ellipse(xx,yy-33*(1-v),6*(1-v),2,p.fg,null)}if(t>.65&&t<.8)line(200,180,200,169+13*phase(t,.65,.8),p.robot,3)}
  if(i===2){if(present)shell(200,172+90*down,{alpha:1-down,base:false,reflect:false});const height=80*phase(t,.08,.3)*(1-down);poly([[158,181],[158,181-height],[242,181-height],[242,181]],null,p.fg);line(200,181-height,200,181,p.fg);if(height>20)arrow(200,124+90*down,15,Math.PI/2,p.accent)}
  if(i===3){const d=ease(phase(t,.61,.8));if(t<.8)shell(200,172+100*d,{alpha:1-d,base:false,reflect:false});const reach=t<.44?phase(t,.19,.4):1-phase(t,.44,.6);line(215,145,215+55*reach,145-19*reach,p.accent,3);for(let j=1;j<6;j++)if(reach>j/6)line(215+j*9,145-j*3,215+j*9+2,140-j*3,p.fg,1);if(t>.39&&t<.52){line(268,117,273,122,p.fg,2);line(273,122,281,110,p.fg,2)}}
  if(i===4){const fold=ease(phase(t,.16,.5)),d=ease(phase(t,.52,.74));if(t<.74)shell(200,172+95*d,{sx:1-fold*.92,sy:1-fold*.5,alpha:1-d,base:false,reflect:false});if(t>.35&&t<.82){const late=ease(phase(t,.69,.82));ellipse(218,127+100*late,4,2,p.fg,null)}}
  break;
 }
 case 'reboot':{
  const appear=ease(phase(t,.26,.74));ring(200,177,0,p.robot);
  if(i===0){const fold=phase(t,.07,.36);poly([[158,175],[177,175-42*fold],[200,175],[223,175-42*fold],[242,175]],null,p.fg);if(t>.24)shell(200,172,{sx:Math.max(.04,appear),sy:Math.max(.04,appear),alpha:appear,a:(1-appear)*Math.PI});if(t>.4&&t<.7)ellipse(200,130,28,4,null,p.fg)}
  if(i===1){const gate=1-phase(t,.64,.8);shutter(245,101,42,78*gate);const v=ease(phase(t,.2,.64));if(t>.2)shell(270-70*v,172,{alpha:phase(t,.2,.3),a:Math.PI*(1-v)});if(t>.3&&t<.76){const f=phase(t,.54,.76);card(225+35*f,139+45*f,'↶',21,26,f*1.5)}}
  if(i===2){const scan=phase(t,.1,.67);c.save();c.beginPath();c.rect(168,179-67*scan,64,67*scan);c.clip();shell(200,172,{alpha:1,reflect:false});c.restore();line(169,179-67*scan,231,179-67*scan,p.fg,2);if(t>.66)shell(200,172,{alpha:phase(t,.66,.77)});if(t<.66)receipt(200,179-67*scan,67*scan,43)}
  if(i===3){const g=1-phase(t,.6,.8);ellipse(178,92,12,8,p.bg,p.fg);ellipse(222,92,12,8,p.bg,p.fg);if(t<.7){poly([[194,88],[206,88],[200+20*appear,172],[200-20*appear,172]],null,p.robot);line(189,93,211,93,p.fg,3)}shell(200,172,{sx:.06+.94*appear,sy:.35+.65*appear,alpha:appear});if(t>.5&&t<.78)glow(224,150+45*phase(t,.5,.78),2*g,p.robot)}
  if(i===4){c.save();c.setLineDash([3,5]);c.strokeStyle=p.robot;c.strokeRect(175,119,50,52);c.restore();for(let j=0;j<5;j++){const a=j*Math.PI*2/5,xx=200+Math.cos(a)*80*(1-appear),yy=145+Math.sin(a)*60*(1-appear);if(t<.7)cube(xx,yy,7,p.robot)}if(t>.5)shell(200,172,{alpha:phase(t,.5,.76)});if(t>.12&&t<.67)line(164,108+70*phase(t,.12,.67),236,108+70*phase(t,.12,.67),p.fg)}
  break;
 }
 case 'fire':{
  shell(100);shell(300,172,{color:p.other});const shot=t>.38&&t<.56,stretch=phase(t,.2,.4),retract=1-phase(t,.56,.72);
  if(i===0){if(t>.12&&t<.4){poly([[121,139],[280,122+18*stretch],[280,163-19*stretch]],null,p.danger,.7);rect(118,132,17,19,p.bg,p.fg)}if(shot)beam(125,278)}
  if(i===1){if(t>.12&&t<.72){const end=125+153*stretch*retract;line(125,143,end,143,p.accent,5);for(let j=0;j<8;j++)if(end>130+j*19)line(130+j*19,140,130+j*19,146,p.fg,1)}if(shot)beam(125,278)}
  if(i===2){const collapse=phase(t,.18,.38);if(t<.4){ellipse(112,48,19,4,p.fg,null);poly([[95,50],[128,50],[125,143],[94+31*collapse,143]],null,p.fg,.75);line(99,140,112,122,p.fg,2)}if(shot)beam(125,278,143,3)}
  if(i===3){ellipse(127,143,9,13,p.bg,p.fg);line(127,130,127+Math.sin(t*28)*8,154,p.robot);if(t>.2&&t<.65){line(130,143,130+148*stretch*retract,143,p.fg,1);if(shot)beam(130,278)}if(t>.49&&t<.65){line(277,137,284,148,p.fg);line(277,148,284,137,p.fg)}}
  if(i===4){const swell=pulse(.13,.4);ellipse(124,143,8+8*swell,5+5*swell,p.bg,p.robot);if(shot)beam(126,278,143,3);if(t>.57&&t<.77){const v=pulse(.57,.77);poly([[117,156],[135,156],[137,139+7*v],[121,139+7*v]],p.bg,p.fg)}}
  break;
 }
 case 'hit':{
  const impact=pulse(.19,.4);shell(200,172,{sx:1-.1*impact,sy:1+.08*impact,eye:i===2&&t<.56?0:undefined});if(t>.16&&t<.27)beam(48,178);
  if(i===0&&t>.22&&t<.7){const a=pulse(.22,.7);c.save();c.globalAlpha=a;rect(180,125,40,39,p.bg,p.robot);for(let j=0;j<3;j++)line(181,134+j*12,219,134+j*12,p.fg,.7);for(let j=0;j<5;j++){const X=186+j%3*12,Y=130+Math.floor(j/3)*12+(j===1?14*phase(t,.36,.57):0);ellipse(X,Y,3,3,null,p.accent);line(X-2,Y,X+2,Y,p.fg,.6)}c.restore()}
  if(i===1){const v=phase(t,.25,.65);if(v>0&&v<1){ellipse(200+20*Math.cos(v*Math.PI*2+Math.PI),145+20*Math.sin(v*Math.PI*2),7,5,p.bg,p.fg);ellipse(200+17*Math.cos(v*Math.PI*2+Math.PI),145+17*Math.sin(v*Math.PI*2),2,2,p.fg,null)}if(t>.65&&t<.81)card(178,145-22*phase(t,.65,.81),'!',16,20)}
  if(i===2){if(t>.23&&t<.56){c.beginPath();c.arc(200,139,11,t*28,t*28+Math.PI*1.5);c.strokeStyle=p.accent;c.lineWidth=1.7;c.stroke()}if(t>.56&&t<.8){ellipse(200,139,10,1.2,p.fg,null);line(190,133,198,136,p.fg,2);line(202,136,210,133,p.fg,2)}}
  if(i===3&&t>.22&&t<.8){const z=pulse(.22,.8);receipt(178,145,47*z,18,-.25);line(177,142,181,149,p.danger,2);if(t>.4&&t<.64)line(186,158,169,166,p.fg,2)}
  if(i===4){const v=t<.48?pulse(.23,.48):pulse(.5,.75)*.7;c.save();c.translate(179,133);c.rotate(-v*1.4);poly([[-17,0],[0,0],[0,29],[-17,26]],p.bg,p.robot);line(-15,3,-3,4,p.fg);c.restore()}
  break;
 }
 case 'belt':{
  for(let j=0;j<10;j++){const xx=77+(j*26+t*98)%260;arrow(xx,188,12,0,p.robot)}const xx=mix(125,245,u),z=pulse();
  if(i===0){shell(xx);for(let j=0;j<3;j++){const k=t*55+j*2;line(xx-18+j*18,166,xx-18+j*18-Math.sin(k)*10,177,p.fg,2)}line(245,162,245,178,p.accent);if(t>.58&&t<.77)arrow(xx+9,137,16,-Math.PI/2,p.accent)}
  if(i===1){if(t<.2||t>.68)shell(xx,172,{a:t>.68?Math.PI/2:0});else{const yy=134;rect(xx-25,yy,50,36,p.bg,p.robot);line(xx-7,yy,xx-7,yy-10,p.fg);line(xx-7,yy-10,xx+7,yy-10,p.fg);line(xx+7,yy-10,xx+7,yy,p.fg);ellipse(xx-16,174,4,2,p.robot,null);ellipse(xx+16,174,4,2,p.robot,null)}ring(xx,177,spin)}
  if(i===2){shell(xx,172,{lean:-.12*z});const drag=1-phase(t,.62,.8);coil(xx+17,153,xx+36,177,5,p.fg);if(t>.62){const k=phase(t,.62,.8);ellipse(xx+18,163,9*k,4*k,null,p.fg);ellipse(xx+31,163,9*k,4*k,null,p.fg)}if(drag>.2)line(xx+36,177,xx+47,184,p.accent,2)}
  if(i===3){shell(xx,172,{a:spin});c.save();c.translate(xx-35,175);c.rotate(-spin*.35);poly([[-4,0],[-4,-26],[5,-30],[5,0]],p.bg,p.fg);c.restore();arrow(281,179,15,spin,p.accent)}
  if(i===4){for(let j=0;j<6;j++){const X=100+j*27+u*30,up=Math.max(0,Math.sin(t*42+j));line(X,179,X+5,189-7*up,p.fg,1.5);line(X+5,189-7*up,X+14,189-7*up,p.robot,2)}shell(xx)}
  break;
 }
 case 'panel':{
  const xx=158+80*u,push=pulse(.12,.77);poly([[93,103],[109,111],[109,177],[93,168]],p.bg,p.fg);shell(xx);
  if(i===0){const f=phase(t,.13,.45)*(1-phase(t,.55,.8));poly([[109,126],[109+67*f,126],[109+67*f,172],[109,172]],p.bg,p.fg);for(let j=0;j<3;j++)cube(123+j*17*f,143+(j%2)*10,8,p.fg)}
  if(i===1){if(t>.08&&t<.33){ellipse(103,90,9,7,p.bg,p.accent);glow(103,96,2,p.fg);line(113,83,119,79,p.fg);line(115,91,122,91,p.fg)}const f=pulse(.25,.75);line(110,145,110+74*f,145,p.fg,5);ellipse(110+74*f,145,8,8,p.bg,p.fg)}
  if(i===2){const f=pulse(.13,.8);poly([[108,121],[115+92*f,121],[121+92*f,169],[108,169]],null,p.fg);for(let j=0;j<4;j++)line(113+j*20*f,168,113+j*20*f,175,p.fg,2)}
  if(i===3){const w=78*push;for(let j=0;j<7;j++){const a=108+j*w/7,b=108+(j+1)*w/7;poly([[a,117+j%2*5],[b,117+(j+1)%2*5],[b,174-(j+1)%2*5],[a,174-j%2*5]],p.bg,p.fg)}}
  if(i===4){const w=82*push;c.save();c.globalAlpha=.7;c.beginPath();c.moveTo(108,117);c.bezierCurveTo(108+w,113,108+w,174,108,174);c.closePath();c.fillStyle=p.bg;c.fill();c.strokeStyle=p.fg;c.stroke();c.restore();if(push>.1)line(108+w*.55,126,108+w*.7,163,p.robot,.7)}
  break;
 }
 case 'gear':{
  const a=spin;gear(200,180,35,a);let bodyAngle=a;
  if(i===0){const f=ease(phase(t,.36,.66));bodyAngle=f*Math.PI/2;shell(200,172-10*pulse(.36,.66),{a:bodyAngle});ellipse(200,164,28,8,null,p.fg,2);if(t>.3&&t<.45){line(166,150,173,155,p.fg);line(228,152,234,147,p.fg)}}
  if(i===1){ellipse(200,176,42,12,p.bg,p.fg);shell(200,169,{a});const lag=ease(phase(t,.35,.77));card(200+38*Math.cos(lag*Math.PI/2),170+10*Math.sin(lag*Math.PI/2),'',17,22,lag*.3)}
  if(i===2){shell(200,172,{a});for(let j=0;j<4;j++){const xx=186+j*9;line(xx,164,200+Math.cos(a)*(xx-200),179+Math.sin(a)*(xx-200)*.3,p.fg,1.2);line(171+j*19,177,171+j*19,184,p.accent,2)}}
  if(i===3){bodyAngle=ease(phase(t,.34,.72))*Math.PI/2;shell(200,172,{a:bodyAngle});const z=pulse();line(200,177,200,185+19*z,p.fg,3);ellipse(188,187+18*z,12,5,null,p.fg,2);ellipse(212,187+18*z,12,5,null,p.fg,2);if(t>.22&&t<.62)coil(178,165,221,165,7,p.accent)}
  if(i===4){for(let j=0;j<4;j++)ellipse(200,179,18+j*6,5+j*2,null,p.muted,.7);line(200,179,200+37*Math.cos(a),179+12*Math.sin(a),p.fg);shell(200,172,{a});const z=pulse();line(216,124,234,102+35*z,p.robot,2);line(234,102+35*z,228,176,p.fg,.8)}
  ring(200,177,bodyAngle);break;
 }
 case 'energy':{
  shell(200,172,{eye:t>.62?2:0});const z=pulse();
  if(i===0){const tongue=pulse(.12,.65);poly([[212,146],[212+37*tongue,146],[212+37*tongue,156],[212,156]],p.bg,p.fg);if(t>.08&&t<.62){const drop=ease(phase(t,.08,.3)),eat=phase(t,.37,.62);cube(244-38*eat,82+62*drop,8*(1-eat),p.accent)}if(t>.62&&t<.78)line(200,119,200,108-10*phase(t,.62,.78),p.accent,2)}
  if(i===1){const left=1-phase(t,.15,.7);for(let j=0;j<24;j++){const v=j/24;if(v<left){const X=212+v*95,Y=144+Math.sin(v*25-t*12)*8;glow(X,Y,1.2,p.accent)}}if(left>0)rect(212+left*95,139+Math.sin(left*25-t*12)*8,7,10,p.bg,p.fg);if(t>.62&&t<.72)glow(207,139,4*pulse(.62,.72),p.accent)}
  if(i===2){const peel=phase(t,.18,.62);if(peel<1){c.save();c.translate(200+35*peel,142-45*peel);c.rotate(peel*1.2);card(0,0,'−',32,22);c.restore()}if(t>.28&&t<.74){const f=phase(t,.28,.74);line(177,155,177+46*f,155,p.accent,5);ellipse(177+46*f,155,4,7,null,p.fg)}}
  if(i===3){const a=phase(t,.17,.65)*Math.PI*2,arm=1-phase(t,.7,.82);line(222,146,241,146,p.fg,2);line(241,146,241+12*Math.cos(a),146+12*Math.sin(a),p.fg,3);ellipse(241+12*Math.cos(a),146+12*Math.sin(a),3,3,p.accent,null);line(259,163,241+12*Math.cos(a),146+12*Math.sin(a),p.fg,2*arm+.1);if(t>.65&&t<.8)line(259,163,264,175,p.fg,2)}
  if(i===4){for(let j=0;j<3;j++){const v=phase(t,.1+j*.13,.28+j*.13);const size=(18-j*5)*(1-v);if(size>.1)cube(251+j*15*v,139-j*8*v,size,p.accent)}const v=phase(t,.5,.7);if(v>0&&v<1)glow(251-51*v,139,4*(1-v),p.accent)}
  if(t>.68)label('+1',200,100,p.accent,16);break;
 }
 case 'checkpoint':{
  shell(200);const z=pulse();ellipse(200,179,36,10,null,p.accent,1.2);
  if(i===0){const f=pulse(.1,.73);card(231,137,'',23,44);line(248,111,248,134-15*f,p.fg,4);rect(237,130-15*f,22,10,p.bg,p.fg);if(t>.4)label('1',231,144,p.accent,15);if(t>.63&&t<.8)line(231,140,206,120,p.accent,1)}
  if(i===1){const a=phase(t,.1,.7)*Math.PI*2;for(let j=0;j<2;j++){const sign=j?-1:1;line(200+sign*46,171,200+sign*46,136,p.fg,2)}c.beginPath();c.moveTo(154,136);c.bezierCurveTo(210+24*Math.sin(a),110,190-24*Math.sin(a),170,246,136);c.strokeStyle=p.accent;c.lineWidth=2;c.stroke();if(t>.7)label('1',200,102,p.accent,18)}
  if(i===2){const f=pulse(.12,.72);rect(169,36+58*f,62,14,p.bg,p.fg);rect(190,16+58*f,20,20,p.bg,p.fg);if(t>.4){c.save();c.translate(200,190);c.scale(1,.4);label('1',0,0,p.accent,22);c.restore()}}
  if(i===3){const fold=phase(t,.2,.62);if(t<.68)receipt(200,106-38*fold,44*(1-fold),38);if(t>.28){poly([[178,117],[178,102],[189,109],[200,94],[211,109],[222,102],[222,117]],null,p.accent);label('1',200,115,p.accent,13)}if(t>.68){rect(207,150,13,14,p.bg,p.accent);label('1',213,161,p.accent,11)}}
  if(i===4){const bow=ease(phase(t,.38,.72));for(const sign of [-1,1]){c.save();c.translate(200+sign*46,177);c.rotate(sign*bow*.45);rect(-6,-70,12,70,p.bg,p.fg);glow(0,-58,2,t>.24&&t<.36?p.danger:p.accent);c.restore()}if(t>.12&&t<.38)line(154,136+20*phase(t,.12,.38),246,136+20*phase(t,.12,.38),p.fg,.8);if(t>.6)label('1',200,96,p.accent,18)}
  break;
 }
 case 'damage':{
  shell(200);const z=pulse();
  if(i===0){const v=phase(t,.13,.73);let X,Y;if(v<.33){X=mix(285,211,v/.33);Y=140}else if(v<.66){X=mix(211,265,(v-.33)/.33);Y=mix(140,193,(v-.33)/.33)}else{X=mix(265,218,(v-.66)/.34);Y=mix(193,172,(v-.66)/.34)}if(t>.13&&t<.77){rect(X-13,Y-8,26,16,p.bg,p.accent);line(X-13,Y-8,X,Y+2,p.fg);line(X+13,Y-8,X,Y+2,p.fg)}rect(221,169,31,10,p.bg,p.accent);if(t>.73)label('1',236,164,p.accent,13);if(t>.35&&t<.73)line(264,193,218,193,p.fg,1)}
  if(i===1){rect(264,110,53,60,p.bg,p.line);const v=phase(t,.15,.62);rect(264-33*v,131,53,25,p.bg,p.fg);card(256-42*v,128,'→',27,38,-.12*(1-v));if(t<.58)card(214-58*phase(t,.33,.58),128+37*phase(t,.33,.58),'SP',26,37,phase(t,.33,.58));if(t>.62)card(214,128,'→',27,38)}
  if(i===2){card(200,66,'HW',42,30);const straighten=phase(t,.5,.74);for(let j=0;j<3;j++){const xx=183+j*17;coil(xx,82,xx+Math.sin(t*21+j)*9*(1-straighten),141,5-j,p.fg)}if(t>.52)arrow(183,112,34*straighten,0,p.accent);if(t>.15&&t<.52){line(178,145,165+9*Math.sin(t*23),129,p.robot,2);line(222,145,235+9*Math.sin(t*23),130,p.robot,2)}}
  if(i===3){const expand=pulse(.1,.72);for(let j=0;j<8;j++){const xx=203+j*12*expand,yy=139+j%2*12;poly([[xx,yy],[xx+12*expand,139+(j+1)%2*12],[xx+12*expand,163+(j+1)%2*12],[xx,163+j%2*12]],p.bg,p.fg)}if(t>.65)card(229,144,'1',25,34)}
  if(i===4){rect(255,104,62,65,p.bg,p.fg);ellipse(273,135,10,10,null,p.fg,2);ellipse(298,135,10,10,null,p.fg,2);line(273,135,273+8*Math.cos(t*30),135+8*Math.sin(t*30),p.accent);line(298,135,298+8*Math.cos(-t*30),135+8*Math.sin(-t*30),p.accent);if(t<.4)card(286,76+50*phase(t,.1,.4),'SP',26,36);if(t>.42)card(286-54*ease(phase(t,.42,.75)),155,'→',26,36)}
  break;
 }
 case 'shield':{
  shell(220);const ray=t>.28&&t<.5,z=pulse(.15,.76);if(ray)beam(48,180);
  if(i===0){const open=phase(t,.12,.27)*(1-phase(t,.58,.76));line(192,124,192,170,p.fg,2);for(let j=0;j<7;j++){const a=Math.PI+j*Math.PI/6;line(192,125,192+Math.cos(a)*33*open,125+Math.sin(a)*33*open,p.fg,1)}if(ray){glow(179,139,3,p.danger);line(179,139,192,166,p.accent,2)}}
  if(i===1){const fold=phase(t,.4,.68);if(t>.2&&t<.75){rect(171,120,17,49,p.bg,p.fg);if(t>.4){const xx=178,yy=141;rect(xx-15+12*fold,yy-11,30*(1-fold)+6,22,p.bg,p.accent);line(xx-15+12*fold,yy-11,xx,yy+1,p.fg);line(xx+15-12*fold,yy-11,xx,yy+1,p.fg)}if(t>.61)for(let j=0;j<5;j++)line(178+j*2,151,178+j*2,151+24*phase(t,.61,.75),p.accent,.7)}}
  if(i===2){const r=t<.43?26*phase(t,.16,.34):26*(1-phase(t,.43,.66));ellipse(183,143,r,r,p.bg,p.fg);ellipse(177,136,r*.55,r*.55,null,p.robot,.6);if(ray)glow(183,143,6*phase(t,.28,.43),p.danger);if(t>.43&&t<.66)ellipse(183,143,4*(1-phase(t,.43,.66)),4*(1-phase(t,.43,.66)),p.accent,null)}
  if(i===3){const h=73*phase(t,.12,.25)*(1-phase(t,.54,.75));shutter(182,103,76,h,9);if(h>40)label('—',220,141,p.fg,17);if(ray)glow(181,143,4,p.danger)}
  if(i===4){const v=phase(t,.18,.63);const yy=120+46*v;line(195,yy,211,yy+15,p.fg,2);ellipse(185,yy,11,5,p.bg,p.fg);if(t>.3&&t<.66)line(174,yy,196,yy,p.danger,3);if(t>.61&&t<.79){const f=phase(t,.61,.79);c.save();c.globalAlpha=1-f;poly([[175,166],[196,166],[194+18*f,183+15*f],[175+18*f,182+15*f]],null,p.fg);c.restore()}}
  break;
 }
 case 'upgrade':{
  if(i===0){shell(200);const v=phase(t,.16,.7),xx=280-57*v,yy=112+34*v+12*Math.sin(v*Math.PI*3);rect(273,90,43,64,p.bg,p.line);if(t>.12){line(xx,yy,xx,yy+19,p.fg,4);ellipse(xx,yy,7,7,null,p.accent,2);if(v>.95)glow(222,147,3,p.accent)}}
  if(i===1){shell(150);shell(250,172,{color:p.other});const r=110*phase(t,.13,.65);c.save();c.globalAlpha=1-phase(t,.55,.76);ellipse(150,170,r,r*.36,null,p.robot,2);c.restore();for(const xx of [150,250]){const hit=xx===150?.22:.42;const shut=t>hit&&t<.7;card(xx,94,shut?'—':'○',38,25,shut?.08:0);if(shut)ellipse(xx,139,6,1,p.fg,null)}}
  if(i===2){const hidden=t>.28&&t<.62,swapped=t>=.5;shell(swapped?270:130,172,{alpha:hidden?0:1,color:p.robot});shell(swapped?130:270,172,{alpha:hidden?0:1,color:p.other});for(const xx of [130,270]){const cover=pulse(.12,.8);if(cover>.03){const w=59*Math.min(1,cover*1.8);for(let j=0;j<7;j++){const X=xx-w/2+j*w/6;line(X,103,X+Math.sin(j+t*18)*3,175,p.fg,1)}line(xx-w/2,102,xx+w/2,102,p.fg,2)}}ring(130);ring(270,177,0,p.other)}
  if(i===3){const tx=280-62*u;shell(120);shell(tx,172,{color:p.other});if(t>.12&&t<.78){line(143,155,tx-25,155,p.accent,3);for(let j=0;j<9;j++){const X=153+j*12;if(X<tx-24)line(X,153,X,158,p.fg,1)}line(tx-25,154,tx-19,165,p.fg,2);line(tx-19,165,tx-27,168,p.fg,2)}}
  if(i===4){shell(110);const tx=220+62*u,fold=pulse(.08,.8);shell(tx,172,{color:p.other,sy:1-.8*fold,sx:1+.1*fold});if(fold>.05){poly([[tx-31,166],[tx+27,166],[tx+35,181],[tx-23,181]],p.bg,p.fg);line(tx-31,166,tx-31,166-22*fold,p.fg);line(tx+27,166,tx+27,166-22*fold,p.fg);line(tx-31,166-22*fold,tx+27,166-22*fold,p.fg)}}
  break;
 }
 case 'shutdown':{
  const sleep=ease(phase(t,.18,.73));
  if(i===0){shell(200,172,{eye:1});const y=80+38*sleep;poly([[169,y],[230,y],[236,174],[164,174]],p.bg,p.robot,.8);line(169,y,200,y-9*(1-sleep),p.fg);line(200,y-9*(1-sleep),230,y,p.fg);if(t>.25&&t<.58)line(200,y,200,y-15*pulse(.25,.58),p.robot,2)}
  if(i===1){shell(200,172,{eye:1});const open=1-sleep;rect(178,144,44,22,p.bg,p.fg);poly([[178,166],[178,166+18*open],[222,166+18*open],[222,166]],p.bg,p.robot);if(t>.53&&t<.8){const v=pulse(.53,.8);line(230,159,222-6*v,159,p.fg,3)}line(194,139,206,139,p.fg,2)}
  if(i===2){if(sleep<.97)shell(200,172,{sy:1-.65*sleep,sx:1+.1*sleep,eye:1,alpha:1-sleep*.5});const h=35*sleep;line(179,177,179,177-h,p.robot,3);line(179,177-h,222,177-h,p.robot,3);line(222,177-h,222,177,p.robot,3);line(179,177-h,179,177-h-25*sleep,p.fg,3);ring(200)}
  if(i===3){shell(200,172,{eye:1});const rise=66*sleep;poly([[169,176],[169,176-rise],[231,176-rise],[231,176]],p.bg,p.robot,.75);for(let j=0;j<9;j++)if(j*7<rise)coil(170,174-j*7,230,174-j*7,8,p.fg);if(sleep>.6)card(234,127,'…',18,28,.12)}
  if(i===4){shell(200,172,{eye:t>.38?1:0});const arm=1-phase(t,.2,.38),ant=1-phase(t,.35,.52),fan=1-phase(t,.62,.79);line(222,149,235,149-12*arm*Math.sin(t*24),p.robot,2);line(200,119,200+5*ant*Math.sin(t*26),104,p.fg,2);for(let j=0;j<3;j++){const a=t*24+j*Math.PI*2/3;line(240,117,240+11*fan*Math.cos(a),117+11*fan*Math.sin(a),p.fg,3)}ellipse(240,117,2,2,p.accent,null)}
  break;
 }
 case 'win':{
  shell(200,172,{lean:i===3?.13*pulse(.53,.81):0});
  if(i===0){const drop=ease(phase(t,.08,.38)),expand=ease(phase(t,.39,.65)),w=70+34*expand,top=25+64*drop;rect(200-w/2,top,w,94,p.bg,p.accent);shell(200);line(200,119,200,103,p.robot,2);if(t>.62){rect(170,184,60,17,p.bg,p.fg);label('WIN',200,197,p.fg,12)}}
  if(i===1){const extend=phase(t,.08,.4),collapse=phase(t,.44,.7);receipt(248,26,148*extend*(1-collapse)+28*collapse,45);if(collapse>.4)label('WIN',248,47,p.accent,17);if(t>.23&&t<.55){ellipse(221,139,5,3,p.fg,null);line(223,147,233,146,p.fg,2)}}
  if(i===2){const fold=ease(phase(t,.12,.69));for(let j=0;j<3;j++){const yy=190-j*9;poly([[163,yy],[181,yy-11*fold],[236,yy-11*fold],[218,yy]],p.bg,p.fg);line(163,yy,163,yy+8,p.fg);line(218,yy,218,yy+8,p.fg)}shell(200,172);if(t>.45){const h=30*phase(t,.45,.76);poly([[165,119],[165,119-h],[182,119-h*.4],[200,119-h],[218,119-h*.4],[235,119-h],[235,119]],null,p.accent)}}
  if(i===3){for(let j=0;j<4;j++){const xx=70+j*87,sign=xx<200?1:-1;c.save();c.translate(xx,71);c.rotate(sign*.5*pulse(.15,.5));rect(-18,-9,36,18,p.bg,p.fg);line(0,-9,0,-34,p.line);c.restore()}c.save();c.globalAlpha=.2;line(178,193,222,193-10*pulse(.4,.66),p.robot,6);c.restore()}
  if(i===4){const cut=phase(t,.34,.48),spread=ease(phase(t,.47,.75));if(t<.51){line(174,146,225,146,p.accent,2);line(198,139,207,151,p.fg,1.4);line(198,151,207,139,p.fg,1.4)}const w=260*spread;if(w>0){poly([[200-w/2,60],[200+w/2,60],[200+w/2-12,97],[200-w/2+12,97]],p.bg,p.accent);if(spread>.7)label('WINNER',200,85,p.fg,19)}if(cut>0&&cut<1)glow(203,146,3,p.fg)}
  break;
 }
 }
 c.restore();
}
globalThis.RRCinematic={name:'Optical mischief',draw,treatments,coverage:treatments};
})();
