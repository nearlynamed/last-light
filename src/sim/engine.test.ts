import { describe,it,expect } from 'vitest';
import { firingSolution, forecast, GameEngine, sensorPosition, uncertainty, windows } from './engine';
import { advance, dist, dot, DURATION, len, MU, norm, RADIUS, sightline } from './math';
import { createEncounters, flybyState } from './encounters';

const weaponFixture=()=>new GameEngine(417,[{id:'large-test-object',p:[5.6,1.2,4.8],v:[-.035,-.007,-.030],size:3.1,reflect:1.1,spawn:-16}]);

describe('sensor-driven command simulation',()=>{
  it('provides four ground stations and three independent orbital radars',()=>{const g=new GameEngine(),s=g.snapshot();expect(s.sensors.filter(x=>x.kind==='ground')).toHaveLength(4);expect(s.sensors.filter(x=>x.kind==='orbital')).toHaveLength(3);expect(s.tracks.length).toBeGreaterThan(0);expect(new Set(s.sensors.map(x=>x.cycle)).size).toBeGreaterThan(3);});
  it('blocks observations through the planet but permits clear sightlines',()=>{expect(sightline([2.04,0,0],[-4,0,0])).toBe(false);expect(sightline([2.04,0,0],[5,1,0])).toBe(true);expect(sightline([4,3,0],[-4,3,0])).toBe(true);});
  it('moves orbital radars through distinct planes',()=>{const g=new GameEngine();for(const s of g.sensors.filter(x=>x.kind==='orbital'))expect(dist(sensorPosition(s,0),sensorPosition(s,20))).toBeGreaterThan(1);});
  it('preserves observations and expands uncertainty when there are no new returns',()=>{const g=new GameEngine(),before=g.snapshot().tracks[0];g.sensors.forEach(s=>s.range=0);g.start();g.advance(12);const after=g.snapshot().tracks.find(t=>t.id===before.id)!;expect(after.observed).toBe(before.observed);expect(after.measured).toEqual(before.measured);expect(uncertainty(after,g.time)).toBeGreaterThan(uncertainty(before,0));});
  it('is deterministic across rendering cadences',()=>{const a=new GameEngine(44),b=new GameEngine(44);a.start();b.start();for(let i=0;i<600;i++)a.advance(1/30);for(let i=0;i<1200;i++)b.advance(1/60);expect(a.snapshot()).toEqual(b.snapshot());});
  it('does not advance while paused and resumes from the same clock',()=>{const g=new GameEngine();g.advance(10);expect(g.time).toBe(0);g.start();g.advance(2);g.pause();const time=g.time;g.advance(30);expect(g.time).toBe(time);g.resume();g.advance(1);expect(g.time).toBeCloseTo(time+1,6);});
  it('tasks one radar without changing the rest of the network',()=>{const g=new GameEngine(),track=g.snapshot().tracks[0];const before=structuredClone(g.sensors.slice(1));g.setSensor('G01','focus',track.id);expect(g.sensors[0].target).toBe(track.id);expect(g.sensors.slice(1)).toEqual(before);});
  it('exposes estimates, never body identity or private weapon associations',()=>{const g=new GameEngine(),s=g.snapshot();expect(s).not.toHaveProperty('bodies');for(const t of s.tracks){expect(t).not.toHaveProperty('reflect');expect(t).not.toHaveProperty('size');expect(t).not.toHaveProperty('result');}expect(s.debrief).toBeNull();});
  it('consumes ammunition only for accepted orders and prevents cooldown salvos',()=>{const g=new GameEngine();g.start();let launched=false;for(const t of g.snapshot().tracks){for(const s of g.silos){if(firingSolution(t,s,'precision',g.time).ready){const ammo=s.precision;expect(g.launch(t.id,s.id,'precision')).toBe(true);expect(s.precision).toBe(ammo-1);expect(g.launch(t.id,s.id,'precision')).toBe(false);expect(s.precision).toBe(ammo-1);expect(g.snapshot().flights[0]).not.toHaveProperty('targetId');launched=true;break;}}if(launched)break;}expect(launched).toBe(true);});
  it('computes observation windows from supplied estimates',()=>{const g=new GameEngine(),s=g.snapshot(),t=s.tracks[0];const lanes=windows(t,s.sensors,0,s.tracks);expect(lanes).toHaveLength(7);expect(lanes.every(x=>x.visible.length===21)).toBe(true);const shifted={...t,p:[40,0,0] as [number,number,number]};expect(windows(shifted,s.sensors,0,[shifted]).every(x=>x.visible.every(v=>!v))).toBe(true);});
  it('ends a complete watch and reveals the debrief only then',()=>{const g=new GameEngine();g.start();g.advance(DURATION+10);const s=g.snapshot();expect(s.ended).toBe(true);expect(s.running).toBe(false);expect(s.debrief).not.toBeNull();expect(s.debrief!.impacts).toBeGreaterThan(0);expect(s.time).toBeLessThanOrEqual(DURATION+.04);});
  it('allows an early, supported deflection and requires subsequent assessment',()=>{const g=weaponFixture();g.start();const id=g.snapshot().tracks[0].id;g.setSensor('G01','focus',id);g.advance(5);expect(g.launch(id,'L01','deflector')).toBe(true);g.advance(35);expect(g.snapshot().messages.some(m=>m.text.includes('terminal seeker acquisition'))).toBe(true);expect(g.snapshot().messages.some(m=>m.text.includes('Reacquire'))).toBe(true);expect(g.snapshot().debrief).toBeNull();g.advance(DURATION);expect(g.snapshot().debrief!.deflected).toBeGreaterThan(0);});
  it('makes precision impact on a large body produce new fragment contacts',()=>{const g=weaponFixture();g.start();const id=g.snapshot().tracks[0].id;g.setSensor('G01','focus',id);g.advance(5);expect(g.launch(id,'L01','precision')).toBe(true);g.advance(35);expect(g.snapshot().tracks.length).toBeGreaterThan(1);g.advance(DURATION);expect(g.snapshot().debrief!.neutralized).toBeGreaterThan(0);});
  it('produces finite track solutions throughout the scenario',()=>{const g=new GameEngine();g.start();for(let i=0;i<300&&!g.ended;i++){g.advance(1);for(const t of g.snapshot().tracks){const f=forecast(t,g.time);expect(Number.isFinite(f.closest)).toBe(true);expect(t.p.every(Number.isFinite)&&t.v.every(Number.isFinite)).toBe(true);}}});
});


describe('crossing paths encounter stream',()=>{
  it('lets an early deflector turn a curved impactor into a surviving passage',()=>{
    const g=new GameEngine(417,[createEncounters()[0]]);g.start();let fired=false;
    for(let sec=0;sec<65&&!fired;sec++){
      g.advance(1);const track=g.snapshot().tracks[0];if(!track)continue;
      if(g.sensors[0].target!==track.id)g.sensors.forEach(sensor=>g.setSensor(sensor.id,'focus',track.id));
      if(track.observations>=12&&forecast(track,g.time).arrival!==null){const silo=g.silos.find(s=>{const solution=firingSolution(track,s,'deflector',g.time);return solution.ready&&solution.quality==='FAVORABLE';});if(silo)fired=g.launch(track.id,silo.id,'deflector');}
    }
    expect(fired).toBe(true);g.advance(DURATION);
    expect(g.snapshot().debrief!.deflected).toBe(1);expect(g.snapshot().debrief!.impacts).toBe(0);
  });
  it('contains twelve flybys and four curved impactors, with several close grazes',()=>{
    const stream=createEncounters();let misses=0,impacts=0,grazes=0;
    for(const object of stream){
      let p=object.p,v=object.v,closest=len(p),hit=false;
      for(let sec=0;sec<600;sec+=.2){[p,v]=advance(p,v,.2);closest=Math.min(closest,len(p));if(len(p)<RADIUS){hit=true;break;}if(len(p)>10&&dot(p,v)>0)break;}
      if(hit)impacts++;else{misses++;if(closest<RADIUS+.35)grazes++;}
      // Even impactors carry substantial angular motion, not a radial drop.
      expect(Math.abs(dot(norm(object.p),norm(object.v)))).toBeLessThan(.98);
    }
    expect(misses).toBe(12);expect(impacts).toBe(4);expect(grazes).toBeGreaterThanOrEqual(3);
  });
  it('bends a near miss around the planet without inventing a cosmetic curve',()=>{
    const state=flybyState([1,0,0],[0,1,0],6,2.18,.022);
    let p=state.p,v=state.v,closest=6;
    const initialEnergy=dot(v,v)/2-MU/len(p);
    for(let sec=0;sec<300;sec+=.1){[p,v]=advance(p,v,.1);closest=Math.min(closest,len(p));}
    expect(closest).toBeCloseTo(2.18,2);
    expect(dot(norm(state.v),norm(v))).toBeLessThan(.6);
    expect(dot(v,v)/2-MU/len(p)).toBeCloseTo(initialEnergy,6);
  });
  it('reports flyby altitude and time using only the supplied track estimate',()=>{
    const base=new GameEngine().snapshot().tracks[0];
    const state=flybyState([1,0,0],[0,1,0],5,2.65,.025);
    const track={...base,...state,observed:0,observations:20,error:.02,velocityError:.001};
    const f=forecast(track,0);
    expect(f.arrival).toBeNull();expect(f.risk).toBe('clear');expect(f.closest).toBeCloseTo(2.65,2);expect(f.closestIn).toBeGreaterThan(30);
    expect(f.closestPoint.every(Number.isFinite)).toBe(true);
  });
  it('keeps the encounter stream private and visual events absent before they occur',()=>{
    const g=new GameEngine(),s=g.snapshot();expect(s.events).toEqual([]);
    expect(s).not.toHaveProperty('encounters');expect(s).not.toHaveProperty('bodies');
    g.start();g.advance(40);expect(g.snapshot().events).toEqual([]);
  });
});
