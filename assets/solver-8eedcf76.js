var j=Object.defineProperty;var H=(V,L,w)=>L in V?j(V,L,{enumerable:!0,configurable:!0,writable:!0,value:w}):V[L]=w;var F=(V,L,w)=>(H(V,typeof L!="symbol"?L+"":L,w),w);(function(){"use strict";const w="ABCDEFGHIJKLMNOPQRSTUVWXYZ";function S(e){let t=e.length;return e.forEach(a=>{let l=(a>>16^a)*73244475,m=(l>>16^l)*73244475,c=m>>16^m;t^=c+2654435769+(t<<6)+(t>>2)}),t}function C(e,t){if(e.length!==t.length)return!1;for(let a=0;a<e.length;a++)if(e[a]!==t[a])return!1;return!0}class O{constructor(){F(this,"arr");this.arr=new Uint8Array(144*144),this.arr.fill(30)}get_val(t,a){return this.arr[t*144+a]}set_val(t,a,l){this.arr[t*144+a]=l}}function v(e,t){if(e==null||t==null)return new Set;{const a=[];for(let l=0;l<Math.min(e.length,t.length);l++)if(C(e[l][0],t[l][0])&&e[l][1][0]===t[l][1][0]&&e[l][1][1]===t[l][1][1]&&e[l][1][2]===t[l][1][2]){const m=e[l][0].length,c=e[l][1][0],h=e[l][1][1];if(e[l][1][2]==="horizontal")for(let r=0;r<m;r++)a.push([c,h+r]);else for(let r=0;r<m;r++)a.push([c+r,h])}return new Set(a.map(S))}}function Y(e,t,a,l,m,c){const h=[];for(let r=l;r<m+1;r++){const i=[];for(let n=t;n<a+1;n++)if(e.get_val(r,n)==30)i.push(" ");else{const s=String.fromCharCode(e.get_val(r,n)+65);c.has(S([r,n]))?i.push(s+"*"):i.push(s)}h.push(i)}return h}function I(e,t){const a=new Uint8Array(t.length);for(let l=0;l<t.length;l++)a[l]=t[l];for(let l=0;l<e.length;l++){if(a[e[l]]===0)return!1;a[e[l]]-=1}return!0}function x(e,t,a){const l=new Int8Array(e);let m=!1;for(const c of t){const h=l[c];if(h===0&&!a.has(c))return!1;if(h===0&&m)return!1;h===0&&(m=!0),l[c]-=1}return!0}function B(e,t,a,l,m,c,h,r,i){let n=[];for(let s=t;s<a+1;s++)if(e.get_val(c,s)!=30)n.push(e.get_val(c,s));else{if(n.length>1&&!i.has(S(n)))return!1;if(n=[],s>r)break}if(n.length>1&&!i.has(S(n)))return!1;for(let s=h;s<r+1;s++){n=[];for(let o=l;o<m+1;o++)if(e.get_val(o,s)!=30)n.push(e.get_val(o,s));else{if(n.length>1&&!i.has(S(n)))return!1;if(n=[],o>c)break}if(n.length>1&&!i.has(S(n)))return!1}return!0}function Z(e,t,a,l,m,c,h,r,i){let n=[];for(let s=l;s<m+1;s++)if(e.get_val(s,r)!=30)n.push(e.get_val(s,r));else{if(n.length>1&&!i.has(S(n)))return!1;if(n=[],s>h)break}if(n.length>1&&!i.has(S(n)))return!1;for(let s=c;s<h+1;s++){n=[];for(let o=t;o<a+1;o++)if(e.get_val(s,o)!=30)n.push(e.get_val(s,o));else{if(n.length>1&&!i.has(S(n)))return!1;if(n=[],o>r)break}if(n.length>1&&!i.has(S(n)))return!1}return!0}function D(e,t,a,l,m,c){const h=[];if(m==="horizontal"){if(a+e.length>=144)return null;const r=Uint8Array.from(c);let i=a!=0&&l.get_val(t,a-1)!=30||144-a<=e.length&&l.get_val(t,a+e.length)!=30;if(!i){for(let n=a;n<a+e.length;n++)if(t<144-1&&l.get_val(t+1,n)!=30||t>0&&l.get_val(t-1,n)!=30){i=!0;break}}if(i){let n=!0;for(let s=0;s<e.length;s++)if(l.get_val(t,a+s)==30){if(l.set_val(t,a+s,e[s]),h.push([t,a+s]),n=!1,r[e[s]]===0)return[!1,h,r,"Overused"];r[e[s]]-=1}else if(l.get_val(t,a+s)!==e[s])return[!1,h,r,"Remaining"];return r.every(s=>s===0)&&!n?[!0,h,r,"Finished"]:[!n,h,r,"Remaining"]}else return[!1,h,r,"Remaining"]}else{if(t+e.length>=144)return null;const r=Uint8Array.from(c);let i=t!=0&&l.get_val(t-1,a)!=30||144-t<=e.length&&l.get_val(t+e.length,a)!=30;if(!i){for(let n=t;n<t+e.length;n++)if(a<144-1&&l.get_val(n,a+1)!=30||a>0&&l.get_val(n,a-1)!=30){i=!0;break}}if(i){let n=!0;for(let s=0;s<e.length;s++)if(l.get_val(t+s,a)==30){if(l.set_val(t+s,a,e[s]),h.push([t+s,a]),n=!1,r[e[s]]===0)return[!1,h,r,"Overused"];r[e[s]]-=1}else if(l.get_val(t+s,a)!==e[s])return[!1,h,r,"Remaining"];return r.every(s=>s==0)&&!n?[!0,h,r,"Finished"]:[!n,h,r,"Remaining"]}else return[!1,h,r,"Remaining"]}}function U(e,t){for(const a of t)e.set_val(a[0],a[1],30)}function P(e,t,a,l,m,c,h,r,i,n,s){if(i+1<s.length){const o=s[i+1][0],u=s[i+1][1][0],g=s[i+1][1][1],f=D(o,u,g,e,s[i+1][1][2],r);if(f==null)return f;if(f[0])if(s[i+1][1][2]==="horizontal"){const _=Math.min(t,g),E=Math.max(a,g+o.length),M=Math.min(l,u),A=Math.max(m,u);if(B(e,_,E,M,A,u,g,g+o.length-1,h)){if(n.push([o,[f[1][0][0],f[1][0][1],"horizontal"]]),f[3]==="Finished")return[!0,_,E,M,A];if(f[3]==="Remaining"){const T=P(e,_,E,M,A,c,h,f[2],i+1,n,s);if(T==null)return null;if(T[0])return T;n.pop(),U(e,f[1])}}else U(e,f[1])}else{const _=Math.min(t,g),E=Math.max(a,g),M=Math.min(l,u),A=Math.max(m,u+o.length);if(Z(e,_,E,M,A,u,u+o.length-1,g,h)){if(n.push([o,[f[1][0][0],f[1][0][1],"vertical"]]),f[3]==="Finished")return[!0,_,E,M,A];if(f[3]==="Remaining"){const T=P(e,_,E,M,A,c,h,f[2],i+1,n,s);if(T==null)return null;if(T[0])return T;n.pop(),U(e,f[1])}}else U(e,f[1])}else U(e,f[1]);return[!1,t,a,l,m]}else if(i%2==1){for(const o of c)for(let u=l-1;u<m+2;u++)for(let g=t-o.length;g<a+2;g++){const f=D(o,u,g,e,"horizontal",r);if(f==null)return null;if(f[0]){const _=Math.min(t,g),E=Math.max(a,g+o.length),M=Math.min(l,u),A=Math.max(m,u);if(B(e,_,E,M,A,u,g,g+o.length-1,h)){if(n.push([o,[f[1][0][0],f[1][0][1],"horizontal"]]),f[3]==="Finished")return[!0,_,E,M,A];if(f[3]==="Remaining"){const T=P(e,_,E,M,A,c,h,f[2],i+1,n,s);if(T==null)return null;if(T[0])return T;n.pop(),U(e,f[1])}}else U(e,f[1])}else U(e,f[1])}for(const o of c)for(let u=t-1;u<a+2;u++)for(let g=l-o.length;g<m+2;g++){const f=D(o,g,u,e,"vertical",r);if(f==null)return null;if(f[0]){const _=Math.min(t,u),E=Math.max(a,u),M=Math.min(l,g),A=Math.max(m,g+o.length);if(Z(e,_,E,M,A,g,g+o.length-1,u,h)){if(n.push([o,[f[1][0][0],f[1][0][1],"vertical"]]),f[3]==="Finished")return[!0,_,E,M,A];if(f[3]==="Remaining"){const T=P(e,_,E,M,A,c,h,f[2],i+1,n,s);if(T==null)return null;if(T[0])return T;n.pop(),U(e,f[1])}}else U(e,f[1])}else U(e,f[1])}return[!1,t,a,l,m]}else{for(const o of c)for(let u=t-1;u<a+2;u++)for(let g=l-o.length;g<m+2;g++){const f=D(o,g,u,e,"vertical",r);if(f==null)return null;if(f[0]){const _=Math.min(t,u),E=Math.max(a,u),M=Math.min(l,g),A=Math.max(m,g+o.length);if(Z(e,_,E,M,A,g,g+o.length-1,u,h)){if(n.push([o,[f[1][0][0],f[1][0][1],"vertical"]]),f[3]==="Finished")return[!0,_,E,M,A];if(f[3]==="Remaining"){const T=P(e,_,E,M,A,c,h,f[2],i+1,n,s);if(T==null)return null;if(T[0])return T;n.pop(),U(e,f[1])}}else U(e,f[1])}else U(e,f[1])}for(const o of c)for(let u=l-1;u<m+2;u++)for(let g=t-o.length;g<a+2;g++){const f=D(o,u,g,e,"horizontal",r);if(f==null)return null;if(f[0]){const _=Math.min(t,g),E=Math.max(a,g+o.length),M=Math.min(l,u),A=Math.max(m,u);if(B(e,_,E,M,A,u,g,g+o.length-1,h)){if(n.push([o,[f[1][0][0],f[1][0][1],"horizontal"]]),f[3]==="Finished")return[!0,_,E,M,A];if(f[3]==="Remaining"){const T=P(e,_,E,M,A,c,h,f[2],i+1,n,s);if(T==null)return null;if(T[0])return T;n.pop(),U(e,f[1])}}else U(e,f[1])}else U(e,f[1])}return[!1,t,a,l,m]}}function G(e,t,a,l,m,c,h){for(let r=l-1;r<m+2;r++)for(let i=t-1;i<a+2;i++)if(r<144&&i<144&&e.get_val(r,i)==30&&(i>0&&e.get_val(r,i-1)!=30||i<144-1&&e.get_val(r,i+1)!=30||r>0&&e.get_val(r-1,i)!=30||r<144-1&&e.get_val(r+1,i)!=30)){e.set_val(r,i,c);const n=Math.min(t,i),s=Math.max(a,i),o=Math.min(l,r),u=Math.max(m,r);if(B(e,n,s,o,u,r,i,i,h))return[r,i,n,s,o,u];e.set_val(r,i,30)}return null}function k(e,t,a,l){const m=new O,c=e[0][1][0],h=e[0][1][1],r=e[0][0],i=Uint8Array.from(l),n=new Set;for(let _=0;_<r.length;_++)m.set_val(c,h+_,r[_]),i[r[_]]-=1,n.add(r[_]);const s=h,o=c,u=h+(r.length-1),g=c,f=[];if(f.push([r,[c,h,"horizontal"]]),i.every(_=>_==0))return[m,f,s,u,o,g];{const _=t.filter(M=>x(i,M,n)),E=P(m,s,u,o,g,_,a,i,0,f,e);return E==null?null:E[0]?[m,f,E[1],E[2],E[3],E[4]]:null}}function N(e,t){var c,h;const a=new Date,l=new Uint8Array(26);for(const r of w){const i=e.get(r);if(i!=null){if(i<0)return"Number of letter "+r+" is "+i+", but must be greater than or equal to 0!";l[r.charCodeAt(0)-65]=i}else return"Missing letter: "+r}if(t.last_game!=null){let r="Same",i=30;for(let n=0;n<26;n++)if(l[n]<t.last_game.letters[n]){r="SomeLess";break}else l[n]>t.last_game.letters[n]&&(i!=30||l[n]-t.last_game.letters[n]!=1)?r="GreaterByMoreThanOne":l[n]>t.last_game.letters[n]&&(r="GreaterByOne",i=n);if(r==="Same"){const n=new O;return n.arr=t.last_game.board,{board:Y(n,t.last_game.min_col,t.last_game.max_col,t.last_game.min_row,t.last_game.max_row,new Set),elapsed:new Date().getTime()-a.getTime(),state:{board:t.last_game.board,min_col:t.last_game.min_col,max_col:t.last_game.max_col,min_row:t.last_game.min_row,max_row:t.last_game.max_row,letters:t.last_game.letters}}}else if(r==="GreaterByOne"){const n=t.all_words_short.filter(g=>I(g,l)),s=new Set(n.map(S)),o=new O;o.arr=t.last_game.board;const u=G(o,t.last_game.min_col,t.last_game.max_col,t.last_game.min_row,t.last_game.max_row,i,s);if(u==null){const g=k(t.last_game.play_sequence,n,s,l);if(g!=null){const f=v(t.last_game.play_sequence,g[1]);return{board:Y(g[0],g[2],g[3],g[4],g[5],f),elapsed:new Date().getTime()-a.getTime(),state:{board:g[0].arr,min_col:g[2],max_col:g[3],min_row:g[4],max_row:g[5],letters:l,play_sequence:g[1]}}}}else{const g=[...t.last_game.play_sequence],f=new Uint8Array(1);f[0]=i,g.push([f,[u[0],u[1],"horizontal"]]);const _=v(t.last_game.play_sequence,g);return{board:Y(o,u[2],u[3],u[4],u[5],_),elapsed:new Date().getTime()-a.getTime(),state:{board:o.arr,min_col:u[2],max_col:u[3],min_row:u[4],max_row:u[5],letters:l,play_sequence:g}}}}else if(r==="GreaterByMoreThanOne"){const n=t.all_words_short.filter(u=>I(u,l)),s=new Set(n.map(S)),o=k(t.last_game.play_sequence,n,s,l);if(o!=null){const u=v(t.last_game.play_sequence,o[1]);return{board:Y(o[0],o[2],o[3],o[4],o[5],u),elapsed:new Date().getTime()-a.getTime(),state:{board:o[0].arr,min_col:o[2],max_col:o[3],min_row:o[4],max_row:o[5],letters:l,play_sequence:o[1]}}}}}let m=t.all_words_short.filter(r=>I(r,l));if(m.length==0)return"No valid words can be formed from the current letters - dump and try again!";for(const r of m){const i=new O,n=Math.round(144/2-r.length/2),s=Math.round(144/2),o=Uint8Array.from(l);for(let M=0;M<r.length;M++)i.set_val(s,n+M,r[M]),o[r[M]]-=1;const u=n,g=s,f=n+(r.length-1),_=s,E=[];if(E.push([r,[s,n,"horizontal"]]),o.every(M=>M==0)){const M=v((c=t.last_game)==null?void 0:c.play_sequence,E);return{board:Y(i,u,f,g,_,M),elapsed:new Date().getTime()-a.getTime(),state:{board:i.arr,min_col:u,max_col:f,min_row:g,max_row:_,letters:l,play_sequence:E}}}else{const M=new Set(l),A=m.filter(z=>x(o,z,M)),T=new Set(m.map(S)),R=P(i,u,f,g,_,A,T,o,0,E,[]);if(R==null||!R[0])return"No valid words can be formed from the current letters - dump and try again!";{const z=v((h=t.last_game)==null?void 0:h.play_sequence,E);return{board:Y(i,R[1],R[2],R[3],R[4],z),elapsed:new Date().getTime()-a.getTime(),state:{board:i.arr,min_col:R[1],max_col:R[2],min_row:R[3],max_row:R[4],letters:l,play_sequence:E}}}}}}self.addEventListener("message",e=>{const t=N(e.data.letters,e.data.gameState);self.postMessage(t)},!1)})();
