this.webpackChunk([1],[,,function(t,r,n){"use strict";n.r(r),n.d(r,"__wbg_workerPanic_a0650f15d053aff2",function(){return o}),n.d(r,"__wbg_logMessage_c8d5fc1739e155db",function(){return _}),n.d(r,"init",function(){return f}),n.d(r,"parse_gb",function(){return v}),n.d(r,"parse_fasta",function(){return A}),n.d(r,"parse_bin",function(){return P}),n.d(r,"__wbg_setTimeout_2100c95bd185443d",function(){return I}),n.d(r,"__widl_f_log_1_",function(){return N}),n.d(r,"__wbg_new_a76edbd366064b30",function(){return U}),n.d(r,"__wbg_call_0492299fb1f5901e",function(){return z}),n.d(r,"__wbg_new_e2f49f9095466bf6",function(){return C}),n.d(r,"__wbg_test_056ecf0ba06938a0",function(){return D}),n.d(r,"__wbg_replace_f726ee1581900eb8",function(){return B}),n.d(r,"__wbg_new_ce158cf1048d4c17",function(){return F}),n.d(r,"__wbg_resolve_de6a9d3662905882",function(){return G}),n.d(r,"__wbg_then_3faaae6de0104bf6",function(){return H}),n.d(r,"__wbg_then_76e86e45033cabdf",function(){return K}),n.d(r,"__wbindgen_string_new",function(){return L}),n.d(r,"__wbindgen_string_get",function(){return Q}),n.d(r,"__wbindgen_cb_drop",function(){return V}),n.d(r,"__wbindgen_json_parse",function(){return W}),n.d(r,"__wbindgen_json_serialize",function(){return X}),n.d(r,"__wbindgen_rethrow",function(){return Y}),n.d(r,"__wbindgen_throw",function(){return Z}),n.d(r,"__wbindgen_closure_wrapper603",function(){return $}),n.d(r,"Assembly",function(){return Assembly}),n.d(r,"AssemblyResult",function(){return AssemblyResult}),n.d(r,"__wbg_pcrresults_new",function(){return tt}),n.d(r,"PcrResults",function(){return PcrResults}),n.d(r,"Pcrer",function(){return Pcrer}),n.d(r,"__wbg_seq_new",function(){return rt}),n.d(r,"Seq",function(){return Seq}),n.d(r,"__wbindgen_object_clone_ref",function(){return nt}),n.d(r,"__wbindgen_object_drop_ref",function(){return et});var e=n(3);let u=new TextDecoder("utf-8"),c=null;function i(){return null!==c&&c.buffer===e.v.buffer||(c=new Uint8Array(e.v.buffer)),c}function s(t,r){return u.decode(i().subarray(t,t+r))}function o(t,r){let n=s(t,r);n=n.slice(),e.g(t,1*r),workerPanic(n)}function _(t,r,n,u){let c=s(t,r);c=c.slice(),e.g(t,1*r);let i=s(n,u);i=i.slice(),e.g(n,1*u),logMessage(c,i)}function f(){return e.u()}let l=0;function a(t){const r=e.i(1*t.length);return i().set(t,r/1),l=t.length,r}let p=null;function g(){return null!==p&&p.buffer===e.v.buffer||(p=new Uint32Array(e.v.buffer)),p}const h=new Array(32);function d(t){return h[t]}h.fill(void 0),h.push(void 0,null,!0,!1);let b=h.length;function w(t){t<36||(h[t]=b,b=t)}function y(t){const r=d(t);return w(t),r}function m(t,r){const n=g().subarray(t/4,t/4+r),e=[];for(let t=0;t<n.length;t++)e.push(y(n[t]));return e}let q=null;function S(){return null===q&&(q=e.h()),q}function v(t){const r=a(t),n=l,u=S();try{e.y(u,r,n);const t=g(),c=t[u/4],i=t[u/4+1],s=m(c,i).slice();return e.g(c,4*i),s}finally{e.g(r,1*n)}}function A(t){const r=a(t),n=l,u=S();try{e.x(u,r,n);const t=g(),c=t[u/4],i=t[u/4+1],s=m(c,i).slice();return e.g(c,4*i),s}finally{e.g(r,1*n)}}function P(t){const r=a(t),n=l;try{return Seq.__wrap(e.w(r,n))}finally{e.g(r,1*n)}}let R,j=new TextEncoder("utf-8");function x(t,r){return i().subarray(t/1,t/1+r)}R="function"==typeof j.encodeInto?function(t){let r=t.length,n=e.i(r),u=0;for(;;){const c=i().subarray(n+u,n+r),{read:s,written:o}=j.encodeInto(t,c);if(u+=o,s===t.length)break;t=t.substring(s),n=e.j(n,r,r+=3*t.length)}return l=u,n}:function(t){const r=j.encode(t),n=e.i(r.length);return i().set(r,n),l=r.length,n};let O=null;function k(t,r){return(null!==O&&O.buffer===e.v.buffer||(O=new Int32Array(e.v.buffer)),O).subarray(t/4,t/4+r)}let E=32;function T(t){if(1==E)throw new Error("out of js stack");return h[--E]=t,E}function I(t,r){setTimeout(d(t),r>>>0)}function J(t){b===h.length&&h.push(h.length+1);const r=b;return b=h[r],h[r]=t,r}function M(t){const r=e.i(4*t.length);return g().set(t,r/4),l=t.length,r}function N(t){console.log(d(t))}function U(t,r){let n=s(t,r);return J(new Error(n))}function z(t,r,n,e){try{return J(d(t).call(d(r),d(n)))}catch(t){!function(t,r){const n=g();n[t/4]=1,n[t/4+1]=J(r)}(e,t)}}function C(t,r,n,e){let u=s(t,r),c=s(n,e);return J(new RegExp(u,c))}function D(t,r,n){let e=s(r,n);return d(t).test(e)}function B(t,r,n,e){let u=s(n,e);return J(d(t).replace(d(r),u))}function F(t,r){let n=function(t,r){let n=this.a;this.a=0;try{return this.f(n,this.b,J(t),J(r))}finally{this.a=n}};n.f=e.c.get(211),n.a=t,n.b=r;try{return J(new Promise(n.bind(n)))}finally{n.a=n.b=0}}function G(t){return J(Promise.resolve(d(t)))}function H(t,r){return J(d(t).then(d(r)))}function K(t,r,n){return J(d(t).then(d(r),d(n)))}function L(t,r){return J(s(t,r))}function Q(t,r){let n=d(t);if("string"!=typeof n)return 0;const e=R(n);return g()[r/4]=l,e}function V(t){const r=y(t).original;return 1==r.cnt--?(r.a=0,1):0}function W(t,r){return J(JSON.parse(s(t,r)))}function X(t,r){const n=R(JSON.stringify(d(t)));return g()[r/4]=n,l}function Y(t){throw y(t)}function Z(t,r){throw new Error(s(t,r))}function $(t,r,n){const u=e.c.get(143),c=e.c.get(144),i=function(t){this.cnt++;let n=this.a;this.a=0;try{return u(n,r,J(t))}finally{0==--this.cnt?c(n,r):this.a=n}};i.a=t,i.cnt=1;let s=i.bind(i);return s.original=i,J(s)}class Assembly{static __wrap(t){const r=Object.create(Assembly.prototype);return r.ptr=t,r}free(){const t=this.ptr;this.ptr=0,function(t){e.a(t)}(t)}constructor(){this.ptr=e.m()}clone(){return Assembly.__wrap(e.l(this.ptr))}push(t){return e.n(this.ptr,t.ptr)}assemble(t){try{return AssemblyResult.__wrap(e.k(this.ptr,T(t)))}finally{h[E++]=void 0}}}class AssemblyResult{static __wrap(t){const r=Object.create(AssemblyResult.prototype);return r.ptr=t,r}free(){const t=this.ptr;this.ptr=0,function(t){e.b(t)}(t)}get_circular(){return y(e.q(this.ptr))}get_linear(){return y(e.r(this.ptr))}render_diagram_linear(t){const r=S();e.t(r,this.ptr,t);const n=g(),u=n[r/4],c=n[r/4+1],i=s(u,c).slice();return e.g(u,1*c),i}render_diagram_circular(t){const r=S();e.s(r,this.ptr,t);const n=g(),u=n[r/4],c=n[r/4+1],i=s(u,c).slice();return e.g(u,1*c),i}extract_product_linear(t){return Seq.__wrap(e.p(this.ptr,t))}extract_product_circular(t){return Seq.__wrap(e.o(this.ptr,t))}}function tt(t){return J(PcrResults.__wrap(t))}class PcrResults{static __wrap(t){const r=Object.create(PcrResults.prototype);return r.ptr=t,r}free(){const t=this.ptr;this.ptr=0,function(t){e.e(t)}(t)}get_matches(){return y(e.H(this.ptr))}get_products(){return y(e.I(this.ptr))}extract_product(t){return Seq.__wrap(e.G(this.ptr,t))}annotate_products(t){const r=M(t),n=l;return Seq.__wrap(e.F(this.ptr,r,n))}annotate_matches(t){const r=M(t),n=l;return Seq.__wrap(e.E(this.ptr,r,n))}run(t){try{return Pcrer.__wrap(e.J(this.ptr,T(t)))}finally{h[E++]=void 0}}}class Pcrer{static __wrap(t){const r=Object.create(Pcrer.prototype);return r.ptr=t,r}free(){const t=this.ptr;this.ptr=0,function(t){e.d(t)}(t)}constructor(t,r,n){const u=function(t){const r=e.i(4*t.length),n=g();for(let e=0;e<t.length;e++)n[r/4+e]=J(t[e]);return l=t.length,r}(r),c=l;try{this.ptr=e.D(t.ptr,u,c,T(n))}finally{h[E++]=void 0}}get_status(){return y(e.C(this.ptr))}get_result(){return y(e.A(this.ptr))}cancel(){return e.z(this.ptr)}get_settings(){return y(e.B(this.ptr))}}function rt(t){return J(Seq.__wrap(t))}class Seq{static __wrap(t){const r=Object.create(Seq.prototype);return r.ptr=t,r}free(){const t=this.ptr;this.ptr=0,function(t){e.f(t)}(t)}set_name(t){const r=R(t),n=l;return Seq.__wrap(e.Y(this.ptr,r,n))}get_metadata(){return y(e.R(this.ptr))}is_empty(){return 0!==e.T(this.ptr)}set_circular(t){return Seq.__wrap(e.X(this.ptr,t))}get_diagram_data(){const t=S();e.M(t,this.ptr);const r=g(),n=r[t/4],u=r[t/4+1],c=m(n,u).slice();return e.g(n,4*u),c}revcomp(){return Seq.__wrap(e.U(this.ptr))}to_bin(){const t=S();e.ab(t,this.ptr);const r=g(),n=r[t/4],u=r[t/4+1],c=x(n,u).slice();return e.g(n,1*u),c}to_gb(){const t=S();e.bb(t,this.ptr);const r=g(),n=r[t/4],u=r[t/4+1],c=x(n,u).slice();return e.g(n,1*u),c}get_feature_count(){return e.O(this.ptr)>>>0}get_feature(t){return y(e.N(this.ptr,t))}get_features(){return y(e.Q(this.ptr))}get_feature_qualifiers(t){return y(e.P(this.ptr,t))}search_features(t,r,n){const u=R(t),c=l,i=S();try{e.V(i,this.ptr,u,c,r,n);const t=g(),_=t[i/4],f=t[i/4+1],l=(s=_,o=f,g().subarray(s/4,s/4+o)).slice();return e.g(_,4*f),l}finally{e.g(u,1*c)}var s,o}search_seq(t,r){const n=R(t),u=l,c=S();try{e.W(c,this.ptr,n,u,r);const t=g(),i=t[c/4],s=t[c/4+1];if(0===i)return;const o=k(i,s).slice();return e.g(i,4*s),o}finally{e.g(n,1*u)}}get_seq_slice(t,r){const n=S();e.S(n,this.ptr,t,r);const u=g(),c=u[n/4],i=u[n/4+1],o=s(c,i).slice();return e.g(c,1*i),o}extract_range(t,r,n){const u=null==n?[0,0]:R(n);const c=l;return Seq.__wrap(e.L(this.ptr,t,r,u,c))}set_origin(t){return Seq.__wrap(e.Z(this.ptr,t))}clone(){return Seq.__wrap(e.K(this.ptr))}}function nt(t){return J(d(t))}function et(t){w(t)}},function(t,r,n){"use strict";var e=n.w[t.i];t.exports=e;n(2);e.cb()}]);