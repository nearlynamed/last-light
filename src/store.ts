import { create } from 'zustand';
import { GameEngine } from './sim/engine';
import type { Snapshot } from './sim/types';
export let engine=new GameEngine();
const initial=engine.snapshot();
interface UIState { snapshot:Snapshot;selected:string|null;sensor:string;page:'contacts'|'network'|'journal';view:'orbital'|'polar'|'side';coverage:boolean;projections:boolean;speed:number;muted:boolean;help:boolean;fps:number;publish:()=>void;select:(id:string)=>void;reset:()=>void; }
export const useGame=create<UIState>((set)=>({snapshot:initial,selected:initial.tracks[0]?.id||null,sensor:'G01',page:'contacts',view:'orbital',coverage:true,projections:true,speed:1,muted:true,help:false,fps:60,publish:()=>set(s=>{const snapshot=engine.snapshot();return {snapshot,selected:snapshot.tracks.some(t=>t.id===s.selected)?s.selected:snapshot.tracks[0]?.id||null};}),select:(id)=>set({selected:id}),reset:()=>{engine=new GameEngine();const snapshot=engine.snapshot();set({snapshot,selected:snapshot.tracks[0]?.id||null,sensor:'G01',speed:1});}}));
let audio:AudioContext|null=null;
export function tone(kind:'click'|'alert'|'launch'|'contact'|'pass'|'impact'='click'){
  if(useGame.getState().muted)return;
  try{
    audio??=new AudioContext();if(audio.state==='suspended')void audio.resume();
    const pitches={click:[1000,700,.16],alert:[660,440,.22],launch:[130,680,.45],contact:[1250,1700,.10],pass:[580,870,.3],impact:[100,27,.8]}[kind];
    const now=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);
    o.type=kind==='impact'?'triangle':'sine';o.frequency.setValueAtTime(pitches[0],now);o.frequency.exponentialRampToValueAtTime(pitches[1],now+pitches[2]);
    g.gain.setValueAtTime(kind==='contact'?.013:kind==='impact'?.07:.025,now);g.gain.exponentialRampToValueAtTime(.0001,now+pitches[2]);o.start();o.stop(now+pitches[2]+.02);
  }catch{/* Audio is optional. */}
}
export function command(action:()=>void){action();useGame.getState().publish();tone();}
