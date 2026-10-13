export type V3 = [number, number, number];
export const add = (a: V3, b: V3): V3 => [a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
export const mul = (a: V3, s: number): V3 => [a[0]*s,a[1]*s,a[2]*s];
export const dot = (a: V3, b: V3) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const len = (a: V3) => Math.hypot(...a);
export const norm = (a: V3): V3 => mul(a,1/(len(a)||1));
export const cross = (a: V3, b: V3): V3 => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi,n));
export const dist = (a: V3,b: V3) => len(sub(a,b));
export const lerp = (a: V3,b: V3,t: number): V3 => add(mul(a,1-t),mul(b,t));
export const RADIUS=2, MU=.008, STEP=1/30, DURATION=300;
export function gravity(p: V3): V3 { return mul(p,-MU/Math.max(1,len(p)**3)); }
export function advance(p: V3,v: V3,dt: number): [V3,V3] { const a=gravity(p),q=add(p,add(mul(v,dt),mul(a,dt*dt*.5)));return [q,add(v,mul(add(a,gravity(q)),dt*.5))]; }
export function predictState(p: V3,v: V3,seconds: number): [V3,V3] { let q: V3=[...p],w: V3=[...v]; for(let t=0;t<seconds;t+=2){[q,w]=advance(q,w,Math.min(2,seconds-t));}return [q,w]; }
export function predict(p: V3,v: V3,seconds: number): V3 { return predictState(p,v,seconds)[0]; }
export function sightline(a: V3,b: V3): boolean { const ab=sub(b,a),t=clamp(-dot(a,ab)/Math.max(.00001,dot(ab,ab)),0,1);return len(add(a,mul(ab,t)))>RADIUS+.003; }
export function radialPoint(lat:number,lon:number,r:number): V3 { return [Math.cos(lat)*Math.cos(lon)*r,Math.sin(lat)*r,Math.cos(lat)*Math.sin(lon)*r]; }
export function seeded(seed:number){let x=seed|0;return ()=>{x+=0x6D2B79F5;let t=x;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
