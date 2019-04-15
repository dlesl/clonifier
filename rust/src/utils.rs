use wasm_bindgen::prelude::*;
use js_sys::{Promise, Function};
use wasm_bindgen_futures::{JsFuture};
use futures::future::Future;
use futures::compat::{Compat, Compat01As03};

#[wasm_bindgen]
extern "C" {
    fn setTimeout(cb: &Function, time: u32);
}

pub fn wait(ms: u32) -> impl Future<Output = ()> {
    let promise = Promise::new(&mut |resolve, _| {
        setTimeout(&resolve, ms);
    });
    let js_future: JsFuture = promise.into();
    let compat = Compat01As03::new(js_future);
    async {
        let _ = await!(compat);
        ()
    }
}

pub fn future_to_promise(f: impl Future<Output = Result<JsValue, JsValue>> + 'static) -> Promise {
    let pinned = Box::pin(f);
    let f = Compat::new(pinned);
    wasm_bindgen_futures::future_to_promise(f)
}