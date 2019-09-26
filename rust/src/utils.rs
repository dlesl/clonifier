use wasm_bindgen::prelude::*;
use js_sys::{Promise, Function};
use wasm_bindgen_futures::{JsFuture};
use futures::future::Future;

#[wasm_bindgen]
extern "C" {
    fn setTimeout(cb: &Function, time: u32);
}

pub fn wait(ms: u32) -> impl Future<Output = ()> {
    let promise = Promise::new(&mut |resolve, _| {
        setTimeout(&resolve, ms);
    });
    let js_future: JsFuture = promise.into();
    async {
        let _ = js_future.await;
        ()
    }
}

pub fn future_to_promise(f: impl Future<Output = Result<JsValue, JsValue>> + 'static) -> Promise {
    let pinned = Box::pin(f);
    wasm_bindgen_futures::future_to_promise(pinned)
}