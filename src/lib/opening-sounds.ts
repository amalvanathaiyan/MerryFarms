/**
 * The opening's sounds: three sets, played in turn, one per opening (the user, 2026-11-14: "rotate all sets").
 *   0 Marimba: warm wooden notes, a woodblock and a "boing";
 *   1 Bells:   glassy bells with an echo, and a twinkle;
 *   2 Village: tabla-like taps, plucked strings in the Mohanam scale, a hen clucking.
 * Everything is made in the browser with the Web Audio API (no sound files). Auditioned on the "Opening sounds" page.
 *
 * This is a plain-ES5 piece of the <head> script (src/lib/opening.ts). It defines ffySounds(ctx), which returns
 * play(set, part, base, from): plays that part's sounds, each at base + its moment (seconds, AudioContext time),
 * skipping any before `from`. Parts: "platform" (FarmForYou's heart), "mark" (the Merry Egg), "logo" (a farm's logo).
 * The moments match the animations in globals.css: the heart pops at 0.25s, its leaves unfurl from 0.65s, it smiles
 * at 1.5s; the egg falls from 0, lands at 0.4s, its comb pops at 1.15s, it smiles at 1.7s; a logo pops at 0.4s and
 * its name rises at 0.6s.
 */
export const SOUND_SETS = 3

export const OPENING_SOUNDS_JS = `
function ffySounds(c){
var master=c.createGain(),comp=c.createDynamicsCompressor(),wet=c.createGain(),room=c.createConvolver(),nb=null,pc={};
master.gain.value=0.8;master.connect(comp);comp.connect(c.destination);
var len=Math.floor(c.sampleRate*1.8),ib=c.createBuffer(2,len,c.sampleRate);
for(var ch=0;ch<2;ch++){var dd=ib.getChannelData(ch);for(var q=0;q<len;q++)dd[q]=(Math.random()*2-1)*Math.pow(1-q/len,2.6)}
room.buffer=ib;wet.gain.value=0.9;wet.connect(room);room.connect(master);
function out(n,rv){n.connect(master);if(rv){var g=c.createGain();g.gain.value=rv;n.connect(g);g.connect(wet)}}
function env(g,t,a,p,d){g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(p,t+a);g.gain.exponentialRampToValueAtTime(0.0001,t+a+d)}
function tone(type,f,t,dur,p,o){o=o||{};var a=o.a||0.004,os=c.createOscillator(),g=c.createGain(),last=g;os.type=type;os.frequency.setValueAtTime(f,t);if(o.to)os.frequency.exponentialRampToValueAtTime(o.to,t+(o.glide||dur));env(g,t,a,p,dur);if(o.filter){var fl=c.createBiquadFilter();fl.type="bandpass";fl.frequency.value=o.filter;fl.Q.value=o.q||3;g.connect(fl);last=fl}os.connect(g);out(last,o.reverb===undefined?0.25:o.reverb);os.start(t);os.stop(t+a+dur+0.05);return os}
function noise(t,dur,p,o){o=o||{};if(!nb){nb=c.createBuffer(1,c.sampleRate,c.sampleRate);var d=nb.getChannelData(0);for(var i=0;i<d.length;i++)d[i]=Math.random()*2-1}var s=c.createBufferSource(),fl=c.createBiquadFilter(),g=c.createGain();s.buffer=nb;fl.type="bandpass";fl.Q.value=o.q||1;fl.frequency.setValueAtTime(o.f||2000,t);if(o.to)fl.frequency.exponentialRampToValueAtTime(o.to,t+dur);env(g,t,o.a||0.003,p,dur);s.connect(fl);fl.connect(g);out(g,o.reverb===undefined?0.15:o.reverb);s.start(t);s.stop(t+dur+0.1)}
var NOTE={C:-9,D:-7,E:-5,F:-4,G:-2,A:0,B:2};
function hz(n){return 440*Math.pow(2,(NOTE[n.charAt(0)]+(Number(n.charAt(1))-4)*12)/12)}
function mallet(n,t,v){v=v||0.28;var f=hz(n);tone("sine",f,t,0.75,v,{reverb:0.3});tone("sine",f*4,t,0.09,v*0.35,{reverb:0.1});tone("sine",f*9.8,t,0.03,v*0.12,{reverb:0})}
function thump(t,v){tone("sine",150,t,0.28,v||0.5,{to:55,reverb:0.05})}
function wood(t,v){v=v||0.32;tone("sine",1250,t,0.07,v,{to:950,reverb:0.2});noise(t,0.02,v*0.6,{f:2600,q:2})}
function boing(t){var os=tone("sine",240,t,0.42,0.22,{to:620,glide:0.3,reverb:0.2}),l=c.createOscillator(),lg=c.createGain();l.frequency.value=16;lg.gain.value=22;l.connect(lg);lg.connect(os.frequency);l.start(t);l.stop(t+0.5)}
function whoosh(t,v){noise(t,0.38,v||0.08,{f:3200,to:500,q:1.4,a:0.12})}
function bell(n,t,v,ln){v=v||0.18;ln=ln||1.6;var f=hz(n),cr=c.createOscillator(),md=c.createOscillator(),mg=c.createGain(),g=c.createGain();cr.frequency.value=f;md.frequency.value=f*3.5;mg.gain.setValueAtTime(f*2.2,t);mg.gain.exponentialRampToValueAtTime(1,t+ln);md.connect(mg);mg.connect(cr.frequency);cr.connect(g);env(g,t,0.004,v,ln);out(g,0.55);cr.start(t);md.start(t);cr.stop(t+ln+0.1);md.stop(t+ln+0.1)}
function sparkle(t,v){var s=["C7","E7","G7","A7","C8"];for(var i=0;i<s.length;i++)bell(s[i],t+i*0.055,v||0.06,0.6)}
function pluck(n,t,v){if(!pc[n]){var f=hz(n),sr=c.sampleRate,ln=Math.floor(sr*1.3),N=Math.round(sr/f),rg=new Float32Array(N),b=c.createBuffer(1,ln,sr),d=b.getChannelData(0),i;for(i=0;i<N;i++)rg[i]=Math.random()*2-1;for(i=0;i<ln;i++){var k=i%N;d[i]=rg[k];rg[k]=0.996*0.5*(rg[k]+rg[(k+1)%N])}pc[n]=b}var s=c.createBufferSource(),g=c.createGain();s.buffer=pc[n];g.gain.value=v||0.32;s.connect(g);out(g,0.3);s.start(t)}
function ta(t,v){v=v||0.3;tone("sine",620,t,0.18,v,{to:560,glide:0.05,reverb:0.15});noise(t,0.015,v*0.7,{f:3000,q:1.5})}
function dhin(t,v){v=v||0.5;tone("sine",120,t,0.6,v,{to:78,glide:0.25,reverb:0.15});tone("sine",360,t,0.3,v*0.25,{to:330,reverb:0.15});noise(t,0.02,v*0.4,{f:1800})}
function cluck(t){var b=[[0,0.06,560],[0.13,0.06,590],[0.26,0.17,700]];for(var i=0;i<b.length;i++)tone("sawtooth",b[i][2],t+b[i][0],b[i][1],0.32,{to:b[i][2]*0.68,filter:1150,q:5,a:0.008,reverb:0.12})}
function each(ns,t,gap,fn,v){for(var i=0;i<ns.length;i++)fn(ns[i],t+i*gap,v)}
var SETS=[
{platform:[[0.25,function(t){mallet("C5",t);thump(t,0.25)}],[0.65,function(t){each(["G4","C5","E5","G5","C6"],t,0.095,mallet,0.2)}],[1.5,function(t){each(["C5","E5","G5"],t,0,mallet,0.17);mallet("C6",t+0.12,0.22);sparkle(t+0.2,0.03)}]],
mark:[[0.05,function(t){whoosh(t)}],[0.4,function(t){wood(t);thump(t,0.4)}],[1.15,boing],[1.7,function(t){mallet("G5",t,0.26);mallet("C6",t+0.13,0.3)}]],
logo:[[0.4,function(t){mallet("C5",t,0.26);wood(t,0.18)}],[0.8,function(t){mallet("G5",t,0.24);mallet("C6",t+0.13,0.28)}]]},
{platform:[[0.25,function(t){bell("E5",t,0.16)}],[0.65,function(t){each(["C5","D5","E5","G5","A5","C6"],t,0.07,function(n,tt){bell(n,tt,0.08,0.9)})}],[1.5,function(t){each(["C5","G5","E6"],t,0,function(n,tt){bell(n,tt,0.11,2)});sparkle(t+0.15,0.04)}]],
mark:[[0.05,function(t){whoosh(t,0.06)}],[0.4,function(t){bell("C4",t,0.18,1.2);thump(t,0.3)}],[1.15,function(t){bell("G5",t,0.14,0.8)}],[1.7,function(t){bell("C6",t,0.13,1.4);sparkle(t+0.1,0.05)}]],
logo:[[0.4,function(t){bell("C5",t,0.16,1.2)}],[0.8,function(t){bell("C6",t,0.13,1.4);sparkle(t+0.1,0.05)}]]},
{platform:[[0.25,function(t){ta(t)}],[0.65,function(t){each(["C4","E4","G4","A4","C5"],t,0.09,pluck,0.28)}],[1.5,function(t){each(["C4","G4","C5","E5"],t,0.028,pluck,0.24);dhin(t,0.35)}],[1.9,function(t){ta(t,0.16);ta(t+0.16,0.12)}]],
mark:[[0.4,function(t){dhin(t);wood(t+0.01,0.15)}],[1.15,cluck],[1.7,function(t){pluck("G4",t,0.3);pluck("C5",t+0.12,0.32);ta(t+0.12,0.15)}]],
logo:[[0.4,function(t){dhin(t,0.4)}],[0.8,function(t){pluck("G4",t,0.3);pluck("C5",t+0.12,0.32);ta(t+0.12,0.15)}]]}
];
return function(set,part,base,from){var m=SETS[set%SETS.length][part]||[];for(var i=0;i<m.length;i++){var at=base+m[i][0];if(at>=from-0.05)m[i][1](Math.max(at,from))}}
}`
