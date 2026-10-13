import type { V3 } from './math';
export type ScanMode='search'|'sector'|'focus';
export type Weapon='deflector'|'precision';
export interface Sensor { id:string;name:string;kind:'ground'|'orbital';lat:number;phase:number;radius:number;period:number;inclination:number;node:number;mode:ScanMode;target:string|null;threshold:number;range:number;cycle:number;nextSample:number;lastReturn:number;returns:number; }
export interface Observation { sensor:string;time:number;p:V3;error:number;strength:number; }
export interface Track { id:string;p:V3;v:V3;observed:number;measured:V3;error:number;velocityError:number;observations:number;sources:string[];reports:Observation[];history:V3[];signal:number;conflict:boolean;engaged:boolean; }
export interface SensorView extends Sensor { position:V3;direction:V3;beamAngle:number; }
export interface Flight { id:string;kind:Weapon;track:string;silo:string;start:V3;aim:V3;position:V3;launched:number;arrival:number;acquired:boolean;finished:boolean; }
export interface Message { id:number;time:number;level:'info'|'warn'|'good';text:string; }
export interface Silo { id:string;name:string;lat:number;phase:number;cooldown:number;precision:number;deflector:number; }
export interface Forecast { closest:number;arrival:number|null;uncertainty:number;risk:'high'|'possible'|'clear';deflectWindow:number|null; }
export interface WindowLane { sensor:string;visible:boolean[];expected:number|null; }
export interface Debrief { total:number;neutralized:number;deflected:number;impacts:number;escaped:number;shots:number; }
export interface Snapshot { time:number;running:boolean;started:boolean;ended:boolean;integrity:number;tracks:Track[];sensors:SensorView[];flights:Flight[];messages:Message[];silos:Silo[];debrief:Debrief|null; }
