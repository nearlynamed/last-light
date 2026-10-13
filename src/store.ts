import { create } from 'zustand';
import { GameEngine } from './sim/engine';
import type { Snapshot } from './sim/types';
export let engine=new GameEngine();
const initial=engine.snapshot();
interface UIState { snapshot:Snapshot;selected:string|null;sensor:string;page:'contacts'|'network'|'journal';view:'orbital'|'polar'|'side';coverage:boolean;projections:boolean;speed:number;muted:boolean;help:boolean;fps:number;publish:()=>void;select:(id:string)=>void;reset:()=>void; }
export const useGame=create<UIState>((set)=>({snapshot:initial,selected:initial.tracks[0]?.id||null,sensor:'G01',page:'contacts',view:'orbital',coverage:true,projections:true,speed:1,muted:true,help:false,fps:60,publish:()=>set(s=>{const snapshot=engine.snapshot();return {snapshot,selected:snapshot.tracks.some(t=>t.id===s.selected)?s.selected:snapshot.tracks[0]?.id||null};}),select:(id)=>set({selected:id}),reset:()=>{engine=new GameEngine();const snapshot=engine.snapshot();set({snapshot,selected:snapshot.tracks[0]?.id||null,sensor:'G01',speed:1});}}));
let audio:AudioContext|null=null;
export function tone(kind:'click'|'alert'|'launch'='click'){if(useGame.getState().muted)return;try{audio??=new AudioContext();if(audio.state==='suspended')void audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);o.type='sine';o.frequency.setValueAtTime(kind==='launch'?220:kind==='alert'?660:1000,audio.currentTime);o.frequency.exponentialRampToValueAtTime(kind==='launch'?600:kind==='alert'?440:700,audio.currentTime+.12);g.gain.setValueAtTime(.025,audio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+.16);o.start();o.stop(audio.currentTime+.17);}catch{/* Audio is optional. */}}
export function command(action:()=>void){action();useGame.getState().publish();tone();}
