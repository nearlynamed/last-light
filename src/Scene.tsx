import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Billboard, Html, Line, OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { engine, useGame } from './store';
import { forecast, sensorBeam, sensorPosition, siloPosition, trackPosition, uncertainty } from './sim/engine';
import { add, advance, clamp, cross, dot, len, mul, norm, predictState, RADIUS, sub } from './sim/math';
import type { V3 } from './sim/math';
import type { Flight, SensorView, Silo, Track, VisualEvent } from './sim/types';

const circle=(r:number,n=128):V3[]=>Array.from({length:n+1},(_,i)=>[Math.cos(i/n*Math.PI*2)*r,0,Math.sin(i/n*Math.PI*2)*r]);
const ringColor='#254447',cyan='#79d9ce',amber='#ffbb77';

function Planet(){
  const group=useRef<THREE.Group>(null);
  const land=useMemo(()=>{const values:number[]=[];for(let i=0;i<18000;i++){const y=1-(i/17999)*2,a=i*Math.PI*(3-Math.sqrt(5)),r=Math.sqrt(1-y*y),x=Math.cos(a)*r,z=Math.sin(a)*r;const n=Math.sin(x*7+Math.cos(y*9))+Math.sin(z*8+y*4)*.7+Math.cos(y*11+x*2)*.4;if(n>.45&&y<.85)values.push(x*2.008,y*2.008,z*2.008);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(values,3));return g;},[]);
  const graticule=useMemo(()=>{const rings:V3[][]=[];for(let lat=-60;lat<=60;lat+=30){const a=lat*Math.PI/180;rings.push(circle(2.011*Math.cos(a)).map(p=>[p[0],2.011*Math.sin(a),p[2]]));}for(let lng=0;lng<180;lng+=30){const a=lng*Math.PI/180;rings.push(Array.from({length:129},(_,i)=>{const t=i/128*Math.PI*2;return [Math.cos(t)*Math.cos(a)*2.012,Math.sin(t)*2.012,Math.cos(t)*Math.sin(a)*2.012] as V3;}));}return rings;},[]);
  const atmosphere=useMemo(()=>new THREE.ShaderMaterial({transparent:true,side:THREE.BackSide,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{color:{value:new THREE.Color('#46a8a3')}},vertexShader:'varying vec3 vNormal; varying vec3 vPosition; void main(){vNormal=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vPosition=mv.xyz;gl_Position=projectionMatrix*mv;}',fragmentShader:'uniform vec3 color;varying vec3 vNormal;varying vec3 vPosition;void main(){float f=pow(1.-abs(dot(normalize(vNormal),normalize(-vPosition))),3.5);gl_FragColor=vec4(color,f*.48);}'}),[]);
  useEffect(()=>()=>{land.dispose();atmosphere.dispose();},[land,atmosphere]);
  useFrame(()=>{if(group.current)group.current.rotation.y=-engine.time*.007;});
  return <><group ref={group}><mesh><sphereGeometry args={[2,80,60]}/><meshStandardMaterial color="#1c4650" roughness={1} metalness={.15}/></mesh><points geometry={land}><pointsMaterial color="#7caaa1" size={.019} sizeAttenuation transparent opacity={.8}/></points>{graticule.map((points,i)=><Line key={i} points={points} color="#477d7d" transparent opacity={.26} lineWidth={.65}/>)}<mesh><sphereGeometry args={[2.015,32,20]}/><meshBasicMaterial wireframe color="#497476" transparent opacity={.035}/></mesh></group><mesh material={atmosphere}><sphereGeometry args={[2.11,64,48]}/></mesh></>;
}
function ReferenceGrid(){
  const ticks=useMemo(()=>{const p:number[]=[];for(let i=0;i<120;i++){const a=i/120*Math.PI*2,r=5.2,r2=r+(i%10===0?.15:.055);p.push(Math.cos(a)*r,0,Math.sin(a)*r,Math.cos(a)*r2,0,Math.sin(a)*r2);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));return g;},[]);
  useEffect(()=>()=>ticks.dispose(),[ticks]);
  return <group><Line points={circle(5.2)} color={ringColor} lineWidth={.6}/><Line points={circle(6.5)} color={ringColor} transparent opacity={.3} lineWidth={.5}/><lineSegments geometry={ticks}><lineBasicMaterial color="#456b69" transparent opacity={.5}/></lineSegments><Line points={[[-7,0,0],[7,0,0]]} color={ringColor} transparent opacity={.25}/><Line points={[[0,0,-7],[0,0,7]]} color={ringColor} transparent opacity={.25}/></group>;
}
function Beam({sensor,selected}:{sensor:SensorView;selected:boolean}){
  const geometry=useMemo(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6*4*3),3));return g;},[]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  useFrame(()=>{const p=sensorPosition(sensor,engine.time),beam=sensorBeam(sensor,engine.time,useGame.getState().snapshot.tracks),d=beam.direction,b1=norm(cross(d,Math.abs(d[1])>.9?[1,0,0]:[0,1,0])),b2=cross(d,b1);const arr=geometry.attributes.position.array as Float32Array;const ends:V3[]=[];
    for(let i=0;i<6;i++){const a=i/6*Math.PI*2,dir=norm(add(d,mul(add(mul(b1,Math.cos(a)),mul(b2,Math.sin(a))),Math.tan(beam.angle))));let length=sensor.range;const b=dot(p,dir),disc=b*b-dot(p,p)+RADIUS*RADIUS;if(disc>0&&b<0)length=Math.min(length,Math.max(.02,-b-Math.sqrt(disc)));ends.push(add(p,mul(dir,length)));}
    let k=0;for(let i=0;i<6;i++){for(const q of [p,ends[i],ends[i],ends[(i+1)%6]])for(const v of q)arr[k++]=v;}geometry.attributes.position.needsUpdate=true;geometry.computeBoundingSphere();
  });
  return <lineSegments geometry={geometry}><lineBasicMaterial color={sensor.kind==='orbital'?'#7cc4e1':cyan} transparent opacity={selected?.075:sensor.mode==='focus'?.09:.012} depthWrite={false}/></lineSegments>;
}
function Radar({sensor,selected,coverage}:{sensor:SensorView;selected:boolean;coverage:boolean}){
  const group=useRef<THREE.Group>(null),pulse=useRef<THREE.Mesh>(null);
  const orbit=useMemo(()=>sensor.kind==='orbital'?Array.from({length:161},(_,i)=>sensorPosition(sensor,i/160*sensor.period)):null,[sensor.id]);
  useFrame(()=>{if(group.current){const p=sensorPosition(sensor,engine.time);group.current.position.set(...p);group.current.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...norm(p)));}if(pulse.current)pulse.current.scale.setScalar(1+(engine.time-sensor.lastReturn<1?Math.sin(engine.time*8)*.15+.4:0));});
  return <>{orbit&&<Line points={orbit} color={selected?'#63a5bc':'#30525f'} transparent opacity={selected?.58:.30} lineWidth={selected?1:.65}/>}<group ref={group} position={sensor.position}>
    <mesh ref={pulse} onClick={e=>{e.stopPropagation();useGame.setState({sensor:sensor.id,page:'network'});}}>{sensor.kind==='ground'?<coneGeometry args={[.052,.13,4]}/>:<octahedronGeometry args={[.067]}/>}<meshBasicMaterial color={selected?'#e1faf3':sensor.kind==='orbital'?'#97cde6':cyan}/></mesh>
    <Html center position={[0,.15,0]} zIndexRange={[20,0]}><button className={`map-tag radar-tag ${selected?'chosen':''}`} onClick={()=>useGame.setState({sensor:sensor.id,page:'network'})} aria-label={`Select radar ${sensor.name}`}>{sensor.id}<span>{sensor.name}</span></button></Html>
  </group>{coverage&&<Beam sensor={sensor} selected={selected}/>}</>;
}
function projectedArc(track:Track,time:number):V3[]{
  let [p,v]=predictState(track.p,track.v,Math.max(0,time-track.observed));const points:V3[]=[p];
  for(let sec=2;sec<=180;sec+=2){[p,v]=advance(p,v,2);points.push(p);if(len(p)<RADIUS+.025)break;}
  return points;
}
function Corridor({track,time,color,path}:{track:Track;time:number;color:string;path:V3[]}){
  const geometry=useMemo(()=>{
    const positions:number[]=[],indices:number[]=[];
    for(let i=0;i<path.length;i++){
      const q=path[i],axis=norm(sub(path[Math.min(i+1,path.length-1)],path[Math.max(0,i-1)]));
      const b1=norm(cross(axis,Math.abs(axis[1])>.9?[1,0,0]:[0,1,0])),b2=cross(axis,b1);
      const radius=Math.min(1.1,uncertainty(track,time)+track.velocityError*i*2*.6);
      for(let j=0;j<10;j++){const a=j/10*Math.PI*2;positions.push(...add(q,mul(add(mul(b1,Math.cos(a)),mul(b2,Math.sin(a))),radius)));}
    }
    for(let i=0;i<path.length-1;i++)for(let j=0;j<10;j++){const a=i*10+j,b=i*10+(j+1)%10;indices.push(a,a+10,b,b,a+10,b+10);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);return g;
  },[track,time,path]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry}><meshBasicMaterial color={color} transparent opacity={.048} side={THREE.DoubleSide} depthWrite={false}/></mesh>;
}
function ReturnPulse({track,color}:{track:Track;color:string}){
  const ref=useRef<THREE.Mesh>(null);
  useFrame(()=>{if(!ref.current)return;const age=engine.time-track.observed;ref.current.visible=age>=0&&age<1.4;ref.current.scale.setScalar(.07+Math.max(0,age)*.22);(ref.current.material as THREE.MeshBasicMaterial).opacity=Math.max(0,.65-age*.46);});
  return <Billboard position={track.measured}><mesh ref={ref}><ringGeometry args={[.91,1,32]}/><meshBasicMaterial color={color} transparent depthWrite={false}/></mesh></Billboard>;
}
function Contact({track,time,selected,projections}:{track:Track;time:number;selected:boolean;projections:boolean}){
  const group=useRef<THREE.Group>(null),volume=useRef<THREE.Mesh>(null),f=forecast(track,time);
  const color=f.risk==='high'?'#ff927e':f.risk==='possible'?amber:'#7ddbcf';
  const path=useMemo(()=>projectedArc(track,time),[track,time]);
  const nearPoint=f.closestPoint,age=Math.max(0,time-track.observed),opacity=age>18?.26:1;
  useFrame(()=>{if(group.current)group.current.position.set(...trackPosition(track,engine.time));if(volume.current)volume.current.scale.setScalar(uncertainty(track,engine.time));});
  return <>
    {projections&&<><Line points={path} color={color} transparent opacity={(selected?.8:.4)*opacity} lineWidth={selected?1.6:1} dashed dashSize={selected?.16:.08} gapSize={.065}/>{selected&&<Corridor track={track} time={time} color={color} path={path}/>}</>}
    {track.history.length>1&&<Line points={track.history} color={color} transparent opacity={selected?.65:.3} lineWidth={selected?2.2:1.2}/>}
    {selected&&projections&&!f.outbound&&track.observations>=3&&<>
      <Line points={[mul(norm(nearPoint),RADIUS+.025),nearPoint]} color={color} dashed dashSize={.035} gapSize={.04} transparent opacity={.6}/>
      <Billboard position={nearPoint}><mesh><ringGeometry args={[.09,.105,40]}/><meshBasicMaterial color={color} transparent opacity={.9}/></mesh>
        <Html center position={[0,-.23,0]} zIndexRange={[15,0]}><div className="pass-tag" style={{color}}>{f.arrival!==null?'ATMOSPHERIC CROSSING':`PASS +${Math.round(Math.max(0,f.closest-RADIUS)*1000)} KM`}<small>EST. T−{Math.ceil(f.arrival??f.closestIn)}s / ±{Math.round(f.uncertainty*1000)} KM</small></div></Html>
      </Billboard>
    </>}
    <ReturnPulse track={track} color={color}/>
    <mesh position={track.measured}><sphereGeometry args={[.027,8,8]}/><meshBasicMaterial color={color}/></mesh>
    <group ref={group} position={trackPosition(track,time)}>
      <mesh onClick={e=>{e.stopPropagation();useGame.getState().select(track.id);}}><octahedronGeometry args={[selected?.10:.073]}/><meshBasicMaterial color={color} wireframe/></mesh>
      <mesh><sphereGeometry args={[selected?.13:.09,12,8]}/><meshBasicMaterial color={color} transparent opacity={.08} blending={THREE.AdditiveBlending} depthWrite={false}/></mesh>
      {selected&&<mesh ref={volume}><sphereGeometry args={[1,20,12]}/><meshBasicMaterial color={color} wireframe transparent opacity={.08} depthWrite={false}/></mesh>}
      <Html center position={[.18,.2,0]} zIndexRange={[30,0]}><button aria-label={`Select contact ${track.id}`} className={`map-tag contact-tag ${selected?'chosen':''}`} style={{color}} onClick={()=>useGame.getState().select(track.id)}>{track.id}<span>{Math.floor(age)}s · {track.observations<3?'TENTATIVE':f.risk==='high'?'CROSSING':f.risk==='possible'?'UNRESOLVED':f.outbound?'OUTBOUND':'FLYBY'}</span></button></Html>
    </group>
  </>;
}
function EventBurst({event}:{event:VisualEvent}){
  const group=useRef<THREE.Group>(null),ring=useRef<THREE.Mesh>(null),glow=useRef<THREE.Mesh>(null);
  const color=event.kind==='impact'?'#ff764e':'#e0ffc1';
  const rays=useMemo(()=>{const p:number[]=[];for(let i=0;i<22;i++){const y=1-i/10.5,a=i*2.39996,r=Math.sqrt(Math.max(0,1-y*y));const d:V3=[Math.cos(a)*r,y,Math.sin(a)*r];p.push(...mul(d,.65),...d);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));return g;},[]);
  useEffect(()=>()=>rays.dispose(),[rays]);
  useFrame(()=>{const age=Math.max(0,engine.time-event.time),fade=Math.max(0,1-age/6);if(group.current){group.current.scale.setScalar(.08+age*.3);const lines=group.current.children[0] as THREE.LineSegments;(lines.material as THREE.LineBasicMaterial).opacity=fade*.85;}if(ring.current){ring.current.scale.setScalar(.12+age*.4);(ring.current.material as THREE.MeshBasicMaterial).opacity=fade*.7;}if(glow.current){glow.current.scale.setScalar(.12+age*.11);(glow.current.material as THREE.MeshBasicMaterial).opacity=fade*.35;}});
  return <group position={event.position}><group ref={group}><lineSegments geometry={rays}><lineBasicMaterial color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending}/></lineSegments></group><Billboard><mesh ref={ring}><ringGeometry args={[.97,1,64]}/><meshBasicMaterial color={color} transparent depthWrite={false}/></mesh><mesh ref={glow}><circleGeometry args={[1,32]}/><meshBasicMaterial color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending}/></mesh></Billboard></group>;
}
function Launcher({silo}:{silo:Silo}){const ref=useRef<THREE.Mesh>(null);useFrame(()=>ref.current?.position.set(...siloPosition(silo,engine.time)));return <mesh ref={ref}><torusGeometry args={[.085,.014,5,16]}/><meshBasicMaterial color="#d1d4a3"/></mesh>;}
function Missile({flight}:{flight:Flight}){
  const head=useRef<THREE.Mesh>(null);
  const curve=useMemo(()=>Array.from({length:32},(_,i)=>{const t=i/31*clamp((engine.time-flight.launched)/(flight.arrival-flight.launched),0,1);return add(add(mul(flight.start,1-t),mul(flight.aim,t)),mul(norm(flight.start),Math.sin(t*Math.PI)*.28));}),[flight]);
  useFrame(()=>{if(head.current){const t=clamp((engine.time-flight.launched)/(flight.arrival-flight.launched),0,1);head.current.position.set(...add(add(mul(flight.start,1-t),mul(flight.aim,t)),mul(norm(flight.start),Math.sin(t*Math.PI)*.28)));}});
  return <><Line points={curve} color="#adf4d2" lineWidth={5} transparent opacity={flight.finished?.025:.10}/><Line points={curve} color="#e3ffd2" lineWidth={1.7} transparent opacity={flight.finished?.12:.9}/>{!flight.finished&&<mesh ref={head} position={flight.position}><sphereGeometry args={[.048,12,8]}/><meshBasicMaterial color="#f3ffd2"/></mesh>}</>;
}
function CameraRig(){const view=useGame(s=>s.view);const {camera}=useThree();const target=useRef(new THREE.Vector3(7,4.8,-9));const moving=useRef(false);const frames=useRef({n:0,t:0});useEffect(()=>{target.current.set(...(view==='polar'?[.1,16,.1]:view==='side'?[0,1.2,17]:[6,4.6,-8.6]) as V3);moving.current=true;},[view]);useFrame((_,delta)=>{if(moving.current){camera.position.lerp(target.current,1-Math.exp(-delta*5));if(camera.position.distanceTo(target.current)<.025)moving.current=false;}frames.current.n++;frames.current.t+=delta;if(frames.current.t>1.5){useGame.setState({fps:Math.round(frames.current.n/frames.current.t)});frames.current={n:0,t:0};}});return <OrbitControls makeDefault enableDamping dampingFactor={.075} minDistance={5.5} maxDistance={24} maxPolarAngle={Math.PI-.05} onStart={()=>{moving.current=false;}}/>;}
function World(){const {snapshot,selected,sensor,coverage,projections}=useGame();return <><color attach="background" args={['#080f14']}/><ambientLight intensity={1.2}/><directionalLight position={[5,6,7]} intensity={2.3} color="#c2eeea"/><directionalLight position={[-4,-2,-3]} intensity={.3} color="#4484a1"/><Stars radius={70} depth={30} count={650} factor={1.2} saturation={0} fade speed={0}/><Planet/><ReferenceGrid/>{snapshot.sensors.map(s=><Radar key={s.id} sensor={s} selected={sensor===s.id} coverage={coverage}/>)}{snapshot.silos.map(s=><Launcher key={s.id} silo={s}/>)}{snapshot.tracks.map(t=><Contact key={t.id} track={t} time={snapshot.time} selected={selected===t.id} projections={projections}/>)}{snapshot.flights.map(f=><Missile key={f.id} flight={f}/>)}{snapshot.events.map(e=><EventBurst key={e.id} event={e}/>)}<CameraRig/></>;}
export default function Scene(){const [lost,setLost]=useState(false);const dpr=useMemo(()=>Math.min(window.devicePixelRatio,1.75),[]);return <div className="scene" aria-label="Interactive 3D orbital defense map"><Canvas dpr={dpr} camera={{position:[6,4.6,-8.6],fov:44,near:.1,far:180}} gl={{antialias:true,alpha:false,powerPreference:'high-performance'}} onCreated={({gl})=>{gl.domElement.addEventListener('webglcontextlost',()=>setLost(true));gl.domElement.addEventListener('webglcontextrestored',()=>setLost(false));}}><World/></Canvas>{lost&&<div className="map-fallback">Graphics context interrupted. Reload to restore the map.</div>}</div>;}

