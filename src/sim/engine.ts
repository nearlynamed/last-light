import { add, advance, clamp, cross, dist, dot, DURATION, gravity, len, lerp, mul, norm, predict, predictState, radialPoint, RADIUS, seeded, sightline, STEP, sub } from './math';
import type { V3 } from './math';
import type { Debrief, Flight, Forecast, Message, ScanMode, Sensor, Silo, Snapshot, Track, VisualEvent, Weapon, WindowLane } from './types';
import { createEncounters } from './encounters';
import type { Encounter } from './encounters';

interface Body { id:string;p:V3;v:V3;size:number;reflect:number;spawn:number;active:boolean;result:'pending'|'impact'|'destroyed'|'deflected'|'escaped'; }
interface InternalFlight extends Flight { targetId:string|null; }
const copy=(p:V3):V3=>[...p];
export const DEFLECTION_LEAD=40;
export function sensorPosition(s:Sensor,time:number):V3 {
  if(s.kind==='ground')return radialPoint(s.lat,s.phase+time*.007,RADIUS+.035);
  const a=s.phase+time/s.period*Math.PI*2;
  const x=Math.cos(a)*s.radius,z=Math.sin(a)*s.radius*Math.cos(s.inclination);
  return [x*Math.cos(s.node)-z*Math.sin(s.node),Math.sin(a)*s.radius*Math.sin(s.inclination),x*Math.sin(s.node)+z*Math.cos(s.node)];
}
export function trackPosition(t:Track,time:number):V3{return predict(t.p,t.v,Math.max(0,time-t.observed));}
export function uncertainty(t:Track,time:number):number{const age=Math.max(0,time-t.observed);return Math.min(2,t.error+age*t.velocityError+age*age*.000035);}
const forecastCache=new WeakMap<Track,{time:number;value:Forecast}>();
export function forecast(t:Track,time:number):Forecast {
  const cached=forecastCache.get(t);if(cached?.time===time)return cached.value;
  const [p,velocity]=predictState(t.p,t.v,Math.max(0,time-t.observed));let q=p,v=velocity,closest=len(p),closestPoint=copy(p),at=0,arrival:number|null=null;
  for(let i=2;i<=200;i+=2){[q,v]=advance(q,v,2);const r=len(q);if(r<closest){closest=r;closestPoint=copy(q);at=i;}if(r<RADIUS+.035){arrival=i;break;}}
  const u=Math.min(2,uncertainty(t,time)+t.velocityError*at*.6);
  const risk=arrival!==null&&t.observations>=3?'high':closest-u<RADIUS+.18?'possible':'clear';
  const value:Forecast={closest,closestIn:at,closestPoint,outbound:dot(p,velocity)>0&&at===0,arrival,uncertainty:u,risk,deflectWindow:arrival===null?null:Math.max(0,arrival-DEFLECTION_LEAD)};
  forecastCache.set(t,{time,value});return value;
}
export function trackStatus(t:Track,time:number):string {const f=forecast(t,time);return t.observations<3?'TENTATIVE':time-t.observed>18?'COASTING':f.risk==='high'?'IMPACT CORRIDOR':f.risk==='possible'?'UNRESOLVED':f.outbound?'OUTBOUND':f.closest<RADIUS+.6?'CLOSE PASS':'FLYBY';}
export function sensorBeam(s:Sensor,time:number,tracks:Track[]):{direction:V3;angle:number}{
  const p=sensorPosition(s,time),target=tracks.find(t=>t.id===s.target);
  if(s.mode!=='search'&&target){const dir=norm(sub(trackPosition(target,time),p));if(s.mode==='focus')return {direction:dir,angle:.18};const side=norm(cross(dir,[0,1,0]));return {direction:norm(add(dir,mul(side,Math.sin(time*1.1+s.phase)*.3))),angle:.46};}
  const n=norm(p),basis=norm(cross(n,Math.abs(n[1])>.9?[1,0,0]:[0,1,0])),b=cross(n,basis),a=time/s.cycle*Math.PI*2+s.phase;
  const elevation=s.kind==='ground'?.62:.05;
  return {direction:norm(add(mul(n,elevation),add(mul(basis,Math.cos(a)),mul(b,Math.sin(a))))),angle:s.kind==='ground'?.82:1.02};
}
export function windows(t:Track,sensors:Sensor[],time:number,tracks:Track[]):WindowLane[]{return sensors.map(s=>{
  const visible:boolean[]=[];let expected:number|null=null;
  for(let i=0;i<=40;i+=2){const p=sensorPosition(s,time+i),q=trackPosition(t,time+i),ok=dist(p,q)<s.range&&sightline(p,q);visible.push(ok);const beam=sensorBeam(s,time+i,tracks);if(expected===null&&ok&&dot(beam.direction,norm(sub(q,p)))>Math.cos(beam.angle))expected=i;}
  return {sensor:s.id,visible,expected};
});}
export function siloPosition(s:Silo,time:number):V3{return radialPoint(s.lat,s.phase+time*.007,RADIUS+.06);}
export function firingSolution(t:Track,s:Silo,kind:Weapon,time:number):{ready:boolean;reason:string;eta:number;aim:V3;quality:string}{
  const start=siloPosition(s,time),[p,v]=predictState(t.p,t.v,Math.max(0,time-t.observed)),speed=kind==='precision'?.29:.23;let eta=dist(start,p)/speed+3;
  for(let i=0;i<4;i++)eta=dist(start,predict(p,v,eta))/speed+3;
  const aim=predict(p,v,eta),f=forecast(t,time),spread=uncertainty(t,time)+eta*t.velocityError;
  let reason='Solution available';
  if(s[kind]<=0)reason='Magazine empty';else if(s.cooldown>time)reason='Launcher cycling';else if(t.observations<2)reason='Need a second observation';else if(time-t.observed>55)reason='Track too stale';else if(!sightline(start,aim))reason='Planet blocks launch corridor';else if(eta>55)reason='Outside interceptor reach';else if(kind==='deflector'&&f.arrival!==null&&f.arrival-eta<DEFLECTION_LEAD)reason='Insufficient deflection lead time';else if(f.arrival!==null&&eta>f.arrival-2)reason='Intercept window closed';
  return {ready:reason==='Solution available',reason,eta,aim,quality:spread<.25?'FAVORABLE':spread<.6?'MARGINAL':'UNCERTAIN'};
}
export class GameEngine {
  time=-30;running=false;started=false;ended=false;integrity=100;
  private rng:()=>number;private bodies:Body[]=[];private tracks:Track[]=[];private associations=new Map<string,string>();private measurements=new Map<string,{time:number;p:V3}[]>();private flights:InternalFlight[]=[];private messages:Message[]=[];private counter=0;private trackCount=0;private shotCount=0;private accumulator=0;
  sensors:Sensor[];silos:Silo[];
  private events:VisualEvent[]=[];private assessed=new Set<string>();private phase=0;
  constructor(seed=417,encounters:Encounter[]=createEncounters()){
    this.rng=seeded(seed);
    this.sensors=[
      {id:'G01',name:'AURORA',kind:'ground',lat:.28,phase:.5,radius:2,period:0,inclination:0,node:0,range:8,cycle:12},
      {id:'G02',name:'MERIDIAN',kind:'ground',lat:-.48,phase:2.0,radius:2,period:0,inclination:0,node:0,range:8,cycle:15},
      {id:'G03',name:'BOREAL',kind:'ground',lat:.65,phase:3.7,radius:2,period:0,inclination:0,node:0,range:7.5,cycle:11},
      {id:'G04',name:'CITADEL',kind:'ground',lat:-.30,phase:5.1,radius:2,period:0,inclination:0,node:0,range:8,cycle:14},
      {id:'O01',name:'KESTREL',kind:'orbital',lat:0,phase:.65,radius:3.1,period:145,inclination:.6,node:0,range:9,cycle:16},
      {id:'O02',name:'LANTERN',kind:'orbital',lat:0,phase:2.6,radius:3.55,period:185,inclination:1.3,node:1.3,range:9,cycle:19},
      {id:'O03',name:'VIGIL',kind:'orbital',lat:0,phase:4.3,radius:4.55,period:245,inclination:.32,node:.8,range:11,cycle:24},
    ].map((s,i)=>({...s,kind:s.kind as Sensor['kind'],mode:'search',target:null,threshold:.45,nextSample:-16+i*.15,lastReturn:-100,returns:0}));
    this.silos=[{id:'L01',name:'AURORA',lat:.28,phase:.5,cooldown:0,precision:5,deflector:2},{id:'L02',name:'CITADEL',lat:-.30,phase:5.1,cooldown:0,precision:5,deflector:2}];
    this.bodies=encounters.map(b=>({...b,p:copy(b.p),v:copy(b.v),active:false,result:'pending'}));
    while(this.time<-.001)this.tick(STEP);
    this.time=0;this.messages=[];this.log('info','Watch 07 initialized. Seven sensors reporting.');this.log('info','Debris stream approaching. Resolve the dangerous corridors; conserve interceptors on flybys.');
  }
  start(){this.started=true;this.running=true;}
  pause(){this.running=false;}
  resume(){if(this.started&&!this.ended)this.running=true;}
  advance(seconds:number){if(!this.running||this.ended)return;this.accumulator+=seconds;while(this.accumulator+1e-9>=STEP&&!this.ended){this.tick(STEP);this.accumulator-=STEP;}}
  private log(level:Message['level'],text:string){this.messages.unshift({id:++this.counter,time:Math.max(0,this.time),level,text});this.messages=this.messages.slice(0,100);}
  setSensor(id:string,mode:ScanMode,target:string|null){const s=this.sensors.find(x=>x.id===id);if(!s)return;if(mode!=='search'&&!this.tracks.some(t=>t.id===target)){this.log('warn','Select a contact before assigning a sector or focused track.');return;}s.mode=mode;s.target=mode==='search'?null:target;s.nextSample=Math.min(s.nextSample,this.time+1.2);this.log('info',`${s.name}: ${mode==='search'?'broad search resumed':`${mode} assigned to ${target}`}.`);}
  setThreshold(id:string,value:number){const s=this.sensors.find(x=>x.id===id);if(s)s.threshold=clamp(value,.15,.85);}
  launch(trackId:string,siloId:string,kind:Weapon):boolean{
    if(!this.running||this.ended)return false;
    const t=this.tracks.find(x=>x.id===trackId),s=this.silos.find(x=>x.id===siloId);if(!t||!s)return false;
    const sol=firingSolution(t,s,kind,this.time);if(!sol.ready){this.log('warn',sol.reason+'.');return false;}
    s[kind]--;s.cooldown=this.time+9;t.engaged=true;this.shotCount++;
    this.flights.push({id:`M${String(this.shotCount).padStart(2,'0')}`,kind,track:t.id,silo:s.id,start:siloPosition(s,this.time),position:siloPosition(s,this.time),aim:sol.aim,launched:this.time,arrival:this.time+sol.eta,acquired:false,finished:false,targetId:this.associations.get(t.id)||null});
    this.log('info',`${s.name} launch: ${kind.toUpperCase()} → ${t.id}. Estimated flight ${Math.ceil(sol.eta)} s.`);return true;
  }
  private tick(dt:number){
    this.time+=dt;
    this.events=this.events.filter(e=>this.time-e.time<6);
    const phase=this.time>=170?2:this.time>=90?1:0;
    if(phase>this.phase){this.phase=phase;this.log('warn',phase===1?'Stream density increasing. Stagger sector searches; preserve broad coverage.':'Peak debris stream. Cross-check close passes before spending the remaining magazines.');}
    for(const b of this.bodies){if(!b.active&&b.result==='pending'&&this.time>=b.spawn)b.active=true;if(!b.active)continue;[b.p,b.v]=advance(b.p,b.v,dt);if(len(b.p)<RADIUS){b.active=false;b.result='impact';this.events.push({id:++this.counter,kind:'impact',position:mul(norm(b.p),RADIUS+.02),time:this.time});this.integrity=Math.max(0,this.integrity-(b.size>2?42:22));this.log('warn',`Surface impact confirmed. Planetary integrity ${this.integrity}%.`);}else if(len(b.p)>10&&dot(b.p,b.v)>0){b.active=false;if(b.result!=='deflected')b.result='escaped';}}
    for(const s of this.sensors){if(this.time+1e-8<s.nextSample)continue;s.nextSample=this.time+(s.mode==='focus'?1.1:s.mode==='sector'?1.5:1.7);this.scan(s);}
    for(const f of this.flights){if(f.finished)continue;const t=this.tracks.find(x=>x.id===f.track),body=this.bodies.find(b=>b.id===f.targetId&&b.active),remaining=f.arrival-this.time;
      if(t&&this.sensors.some(s=>s.mode==='focus'&&s.target===t.id&&this.time-s.lastReturn<3)&&remaining>4){const proposed=trackPosition(t,this.time+remaining);if(dist(proposed,f.aim)<.65)f.aim=lerp(f.aim,proposed,dt*.5);}
      if(body&&remaining<5&&dist(predict(body.p,body.v,Math.max(0,remaining)),f.aim)<(f.kind==='precision'?.58:.85)){
        if(!f.acquired){f.acquired=true;this.log('info',`${f.id}: terminal seeker acquisition.`);}f.aim=predict(body.p,body.v,Math.max(0,remaining));}
      const progress=clamp((this.time-f.launched)/(f.arrival-f.launched),0,1);f.position=add(lerp(f.start,f.aim,progress),mul(norm(f.start),Math.sin(progress*Math.PI)*.28));
      if(remaining<=0){f.finished=true;if(f.acquired)this.events.push({id:++this.counter,kind:'intercept',position:copy(f.aim),time:this.time});this.log('warn',`${f.id}: telemetry ended. ${f.acquired?'Intercept flash reported.':'No terminal acquisition reported.'} Reacquire ${f.track} to assess.`);if(body&&dist(body.p,f.aim)<.24&&f.acquired){if(f.kind==='deflector'){const radial=norm(body.p),tangential=sub(body.v,mul(radial,dot(body.v,radial))),tangent=len(tangential)>.0001?norm(tangential):norm(cross(radial,Math.abs(radial[1])>.8?[1,0,0]:[0,1,0]));body.v=add(body.v,add(mul(tangent,.060),mul(norm(body.p),.025)));body.result='deflected';}else if(body.size>2){body.active=false;body.result='destroyed';for(let j=0;j<2;j++)this.bodies.push({id:`${body.id}-${this.shotCount}-${j}`,p:add(body.p,[j*.07,0,.08]),v:add(body.v,[j===0?.011:-.009,.008*(j?1:-1),.004]),size:.7,reflect:1.2,spawn:this.time,active:true,result:'pending'});}else{body.active=false;body.result='destroyed';}}}
    }
    if(this.time>=DURATION||this.integrity<=0){this.ended=true;this.running=false;this.log(this.integrity>0?'good':'warn',this.integrity>0?'Watch complete. Defense assessment available.':'Planetary defense lost. Watch terminated.');}
  }
  private scan(s:Sensor){
    const position=sensorPosition(s,this.time),beam=sensorBeam(s,this.time,this.tracks);
    for(const b of this.bodies){if(!b.active||!sightline(position,b.p))continue;const d=dist(position,b.p);if(d>s.range||dot(beam.direction,norm(sub(b.p,position)))<Math.cos(beam.angle))continue;
      const orientation=.52+.48*Math.abs(Math.sin(this.time*.24+b.reflect*3)),signal=b.size*b.reflect*orientation/Math.max(.15,(d/3)**3.5);
      const probability=clamp(.72+(signal-s.threshold)*.5,.08,.97);if(signal<s.threshold*.32||this.rng()>probability)continue;
      const error=(.025+d*.009)*(s.mode==='focus'?.34:s.mode==='sector'?.65:1),bias=s.id==='G03'&&this.time>110?Math.min(.18,(this.time-110)*.002):0;
      const measured:V3=[b.p[0]+(this.rng()-.5)*error*2+bias,b.p[1]+(this.rng()-.5)*error*2,b.p[2]+(this.rng()-.5)*error*2];
      let t=this.tracks.find(t=>this.associations.get(t.id)===b.id);
      if(!t){t={id:`T${String(++this.trackCount).padStart(3,'0')}`,p:measured,v:mul(norm(measured),-.018),observed:this.time,measured,error:error*2,velocityError:.035,observations:0,sources:[],reports:[],history:[],signal,conflict:false,engaged:false};this.tracks.push(t);this.associations.set(t.id,b.id);if(this.time>0)this.log('info',`${s.name}: new contact ${t.id}. Classification unresolved.`);}
      const estimated=trackPosition(t,this.time),residual=sub(measured,estimated),conflicting=t.observations>3&&len(residual)>.25+uncertainty(t,this.time)*2;
      const gain=t.observations===0?1:s.mode==='focus'?.76:.60;
      t.p=add(estimated,mul(residual,gain));
      const samples=[...(this.measurements.get(t.id)||[]).filter(m=>this.time-m.time<24),{time:this.time,p:measured}];this.measurements.set(t.id,samples);
      const meanTime=samples.reduce((n,m)=>n+m.time,0)/samples.length,meanPosition=mul(samples.reduce((p,m)=>add(p,m.p),[0,0,0] as V3),1/samples.length),variance=samples.reduce((n,m)=>n+(m.time-meanTime)**2,0);
      if(variance>12){const slope=mul(samples.reduce((v,m)=>add(v,mul(sub(m.p,meanPosition),m.time-meanTime)),[0,0,0] as V3),1/variance);t.v=lerp(predictState(t.p,t.v,Math.max(0,this.time-t.observed))[1],add(slope,mul(gravity(t.p),this.time-meanTime)),.72);}if(len(t.v)>.14)t.v=mul(norm(t.v),.14);
      t.observed=this.time;t.measured=measured;t.observations++;t.signal=signal;t.conflict=conflicting;
      t.error=conflicting?Math.max(error,len(residual)*.5):Math.max(error*.65,.023);t.velocityError=Math.max(.0025,.022/Math.sqrt(t.observations));
      if(!t.sources.includes(s.id))t.sources.push(s.id);
      t.reports=[{sensor:s.id,time:this.time,p:measured,error,strength:signal},...t.reports.filter(r=>r.sensor!==s.id)].slice(0,7);t.history.push(measured);t.history=t.history.slice(-12);
      s.lastReturn=this.time;s.returns++;
      forecastCache.delete(t);
      if(t.observations>=6&&!this.assessed.has(t.id)){const f=forecast(t,this.time);if(f.outbound&&f.risk==='clear'){this.assessed.add(t.id);this.log('good',`${t.id}: fresh returns indicate outbound passage. Current corridor clears Aster.`);}}
      if(conflicting)this.log('warn',`${t.id}: ${s.name} disagrees with the current solution. Independent check advised.`);
    }
    if(s.mode==='search'&&s.threshold<.3&&this.rng()<(.3-s.threshold)*.17){const p=add(position,mul(beam.direction,3+this.rng()*3));if(sightline(position,p)){const t:Track={id:`T${String(++this.trackCount).padStart(3,'0')}`,p,v:[0,0,0],observed:this.time,measured:p,error:.25,velocityError:.035,observations:1,sources:[s.id],reports:[{sensor:s.id,time:this.time,p,error:.25,strength:.2}],history:[p],signal:.2,conflict:false,engaged:false};this.tracks.push(t);this.log('info',`${s.name}: tentative echo ${t.id}. Additional observation required.`);}}
  }
  snapshot():Snapshot{
    const tracks=this.tracks.filter(t=>this.time-t.observed<90).map(t=>({...t,p:copy(t.p),v:copy(t.v),measured:copy(t.measured),sources:[...t.sources],reports:t.reports.map(r=>({...r,p:copy(r.p)})),history:t.history.map(copy)}));
    const debrief:Debrief|null=this.ended?{total:this.bodies.length,neutralized:this.bodies.filter(b=>b.result==='destroyed').length,deflected:this.bodies.filter(b=>b.result==='deflected').length,impacts:this.bodies.filter(b=>b.result==='impact').length,escaped:this.bodies.filter(b=>b.result==='escaped'||(b.active&&dot(b.p,b.v)>0&&len(b.p)>2.5)).length,shots:this.shotCount}:null;
    return {time:this.time,running:this.running,started:this.started,ended:this.ended,integrity:this.integrity,tracks,sensors:this.sensors.map(s=>{const beam=sensorBeam(s,this.time,tracks);return {...s,position:sensorPosition(s,this.time),direction:beam.direction,beamAngle:beam.angle};}),flights:this.flights.filter(f=>this.time<f.arrival+8).map(({targetId:_,...f})=>({...f,start:copy(f.start),aim:copy(f.aim),position:copy(f.position)})),messages:[...this.messages],events:this.events.map(e=>({...e,position:copy(e.position)})),silos:this.silos.map(s=>({...s})),debrief};
  }
}
