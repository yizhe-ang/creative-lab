import{n as l,s as q,v,w as x,x as k}from"./scheduler.08b988c7.js";const u=[];function z(e,o){return{subscribe:A(e,o).subscribe}}function A(e,o=l){let r;const n=new Set;function a(t){if(q(e,t)&&(e=t,r)){const i=!u.length;for(const s of n)s[1](),u.push(s,e);if(i){for(let s=0;s<u.length;s+=2)u[s][0](u[s+1]);u.length=0}}}function b(t){a(t(e))}function f(t,i=l){const s=[t,i];return n.add(s),n.size===1&&(r=o(a,b)||l),t(e),()=>{n.delete(s),n.size===0&&r&&(r(),r=null)}}return{set:a,update:b,subscribe:f}}function E(e,o,r){const n=!Array.isArray(e),a=n?[e]:e;if(!a.every(Boolean))throw new Error("derived() expects stores as input, got a falsy value");const b=o.length<2;return z(r,(f,t)=>{let i=!1;const s=[];let d=0,p=l;const g=()=>{if(d)return;p();const c=o(n?s[0]:s,f,t);b?f(c):p=k(c)?c:l},w=a.map((c,_)=>v(c,m=>{s[_]=m,d&=~(1<<_),i&&g()},()=>{d|=1<<_}));return i=!0,g(),function(){x(w),p(),i=!1}})}var h;const T=((h=globalThis.__sveltekit_2a8yic)==null?void 0:h.base)??"";var y;const S=((y=globalThis.__sveltekit_2a8yic)==null?void 0:y.assets)??T;export{S as a,T as b,E as d,z as r,A as w};