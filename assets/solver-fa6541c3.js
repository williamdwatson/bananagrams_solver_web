(function(){"use strict";let r;const W=typeof TextDecoder<"u"?new TextDecoder("utf-8",{ignoreBOM:!0,fatal:!0}):{decode:()=>{throw Error("TextDecoder not available")}};typeof TextDecoder<"u"&&W.decode();let c=null;function O(){return(c===null||c.byteLength===0)&&(c=new Uint8Array(r.memory.buffer)),c}function g(t,e){return t=t>>>0,W.decode(O().subarray(t,t+e))}const s=new Array(128).fill(void 0);s.push(void 0,null,!0,!1);let l=s.length;function o(t){l===s.length&&s.push(s.length+1);const e=l;return l=s[e],s[e]=t,e}function d(t){return s[t]}function U(t){t<132||(s[t]=l,l=t)}function i(t){const e=d(t);return U(t),e}let _=0;function f(t,e){const n=e(t.length*1,1)>>>0;return O().set(t,n/1),_=t.length,n}function j(t,e,n,a,u,b,w,m,y,p){const h=f(t,r.__wbindgen_malloc),x=_,A=f(e,r.__wbindgen_malloc),M=_,k=f(b,r.__wbindgen_malloc),D=_,S=r.play_from_existing(h,x,A,M,n,a,u,k,D,w,m,y,p);return i(S)}function R(t,e,n,a,u,b,w,m,y){const p=f(t,r.__wbindgen_malloc),h=_,x=f(u,r.__wbindgen_malloc),A=_,M=r.play_from_scratch(p,h,e,n,a,x,A,b,w,m,y);return i(M)}async function E(t,e){if(typeof Response=="function"&&t instanceof Response){if(typeof WebAssembly.instantiateStreaming=="function")try{return await WebAssembly.instantiateStreaming(t,e)}catch(a){if(t.headers.get("Content-Type")!="application/wasm")console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n",a);else throw a}const n=await t.arrayBuffer();return await WebAssembly.instantiate(n,e)}else{const n=await WebAssembly.instantiate(t,e);return n instanceof WebAssembly.Instance?{instance:n,module:t}:n}}function v(){const t={};return t.wbg={},t.wbg.__wbindgen_string_new=function(e,n){const a=g(e,n);return o(a)},t.wbg.__wbindgen_object_drop_ref=function(e){i(e)},t.wbg.__wbindgen_number_new=function(e){return o(e)},t.wbg.__wbindgen_bigint_from_u64=function(e){const n=BigInt.asUintN(64,e);return o(n)},t.wbg.__wbindgen_error_new=function(e,n){const a=new Error(g(e,n));return o(a)},t.wbg.__wbindgen_object_clone_ref=function(e){const n=d(e);return o(n)},t.wbg.__wbg_set_f975102236d3c502=function(e,n,a){d(e)[i(n)]=i(a)},t.wbg.__wbg_new_16b304a2cfa7ff4a=function(){const e=new Array;return o(e)},t.wbg.__wbg_new_72fb9a18b5ae2624=function(){const e=new Object;return o(e)},t.wbg.__wbg_set_d4638f722068f043=function(e,n,a){d(e)[n>>>0]=i(a)},t.wbg.__wbindgen_throw=function(e,n){throw new Error(g(e,n))},t}function L(t,e){return r=t.exports,T.__wbindgen_wasm_module=e,c=null,r}async function T(t){if(r!==void 0)return r;typeof t>"u"&&(t=new URL("/bananagrams_solver_web/assets/bg_solver_bg-cacc7644.wasm",self.location));const e=v();(typeof t=="string"||typeof Request=="function"&&t instanceof Request||typeof URL=="function"&&t instanceof URL)&&(t=fetch(t));const{instance:n,module:a}=await E(await t,e);return L(n,a)}self.addEventListener("message",t=>{if(t.data==="init")T().then(()=>{self.postMessage("initialized")});else if(!t.data.last_game)self.postMessage(R(t.data.letters_array,t.data.use_long_dictionary,t.data.filter_letters_on_board,t.data.maximum_words_to_check,new Uint8Array,0,0,0,0));else{const e=j(t.data.letters_array,t.data.last_game.letters,t.data.use_long_dictionary,t.data.filter_letters_on_board,t.data.maximum_words_to_check,t.data.last_game.board,t.data.last_game.min_col,t.data.last_game.max_col,t.data.last_game.min_row,t.data.last_game.max_row);e==null?self.postMessage(R(t.data.letters_array,t.data.use_long_dictionary,t.data.filter_letters_on_board,t.data.maximum_words_to_check,t.data.last_game.board,t.data.last_game.min_col,t.data.last_game.max_col,t.data.last_game.min_row,t.data.last_game.max_row)):self.postMessage(e)}},!1)})();
