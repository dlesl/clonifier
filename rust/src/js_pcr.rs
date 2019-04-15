use crate::utils::{future_to_promise, wait};
use crate::JsSeq;
use gb_io::seq::*;
use js_sys::{Error, Promise};
use pcr::{Matches, Primer, Product};
use std::cell::RefCell;
use std::cmp;
use std::rc::Rc;
use wasm_bindgen::prelude::*;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename = "Primer")]
struct JsPrimerRef {
    name: String,
    seq: String,
    desc: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, TypescriptDefinition)]
#[serde(rename_all = "camelCase")]
struct PcrSettings {
    min_fp: i64,
    min_len: i64,
    max_len: i64,
}

impl Primer for JsPrimerRef {
    fn name(&self) -> &str {
        &self.name
    }
    fn seq(&self) -> &[u8] {
        self.seq.as_bytes()
    }
}

#[wasm_bindgen(js_name = Pcrer)]
pub struct JsPcrer {
    seq: Rc<Seq>,
    primers: Rc<Vec<JsPrimerRef>>,
    settings: PcrSettings,
    result: Promise,
    status: Rc<RefCell<PcrStatus>>,
}

#[derive(Serialize, Clone, Debug, TypescriptDefinition)]
#[serde(rename_all = "camelCase")]
#[serde(rename = "Match")]
struct JsMatch<'a> {
    primer: &'a JsPrimerRef,
    start: i64,
    len: i64,
    fwd: bool,
}

#[derive(Serialize, Clone, Debug, TypescriptDefinition)]
#[serde(rename_all = "camelCase")]
#[serde(rename = "Match")]
struct JsProduct<'a> {
    primer_fwd: &'a JsPrimerRef,
    primer_rev: &'a JsPrimerRef,
    start: i64,
    end: i64,
    len: i64,
}

#[derive(Serialize, Debug, TypescriptDefinition)]
#[serde(rename_all = "camelCase")]
struct PcrStatus {
    done: bool,
    cancelled: bool,
    percent: f32,
}

#[wasm_bindgen(js_class = Pcrer)]
impl JsPcrer {
    #[wasm_bindgen(constructor)]
    pub fn new(seq: &JsSeq, primers: Box<[JsValue]>, settings: &JsValue) -> JsPcrer {
        let settings: PcrSettings = settings.into_serde().unwrap();
        let primers: Vec<JsPrimerRef> = primers
            .into_vec()
            .into_iter()
            .map(|value| value.into_serde().unwrap())
            .collect();
        let primers = Rc::new(primers);
        JsPcrer::new_from_rust(seq.0.clone(), primers, settings, None)
    }
    fn new_from_rust(
        seq: Rc<Seq>,
        primers: Rc<Vec<JsPrimerRef>>,
        settings: PcrSettings,
        matches: Option<Rc<Matches<JsPrimerRef>>>,
    ) -> JsPcrer {
        let status = Rc::new(RefCell::new(PcrStatus {
            done: false,
            cancelled: false,
            percent: 0.0,
        }));
        JsPcrer {
            result: run_async(
                seq.clone(),
                primers.clone(),
                settings.clone(),
                matches,
                status.clone(),
            ),
            seq,
            primers,
            settings,
            status,
        }
    }
    pub fn get_status(&self) -> JsValue {
        let status: &RefCell<PcrStatus> = &self.status;
        JsValue::from_serde(&status).unwrap()
    }
    pub fn get_result(&self) -> Promise {
        self.result.clone()
    }
    pub fn cancel(&self) {
        (*self.status.borrow_mut()).cancelled = true;
    }
    pub fn get_settings(&self) -> JsValue {
        JsValue::from_serde(&self.settings).unwrap()
    }
}

fn run_async(
    seq: Rc<Seq>,
    primers: Rc<Vec<JsPrimerRef>>,
    settings: PcrSettings,
    matches: Option<Rc<Matches<JsPrimerRef>>>,
    status: Rc<RefCell<PcrStatus>>,
) -> Promise {
    let future = async move {
        let matches = match matches {
            Some(matches) => matches,
            None => {
                let max_primers = 40_000_000 / seq.len() as usize; // TODO: magic number
                let max_primers = cmp::max(1, max_primers);
                let chunks = primers.chunks(max_primers);
                let mut fwd = Vec::new();
                let mut rev = Vec::new();
                let mut progress = 0;
                for c in chunks {
                    if (*status.borrow()).cancelled {
                        return Ok(PcrResults {
                            seq,
                            primers,
                            matches: None,
                            products: Vec::new(),
                            settings,
                        }.into());
                    }
                    let len = c.len();
                    let new = pcr::find_matches(
                        &seq,
                        c.iter().cloned(),
                        settings.min_fp,
                        pcr::Method::Bndm,
                    );
                    fwd.extend(new.fwd.into_iter());
                    rev.extend(new.rev.into_iter());
                    progress += len;
                    (*status.borrow_mut()).percent = progress as f32 / primers.len() as f32 * 100.0;
                    await!(wait(0));
                }
                Rc::new(Matches { fwd, rev })
            }
        };
        let products: Vec<_> = matches
            .find_products(&*seq, settings.min_len, settings.max_len)
            .take(1000)
            .collect();
        (*status.borrow_mut()).done = true;
        Ok(PcrResults {
            seq,
            primers,
            matches: Some(matches),
            products,
            settings,
        }
        .into())
    };
    future_to_promise(future)
}

#[wasm_bindgen]
pub struct PcrResults {
    seq: Rc<Seq>,
    primers: Rc<Vec<JsPrimerRef>>,
    matches: Option<Rc<Matches<JsPrimerRef>>>,
    products: Vec<Product<JsPrimerRef>>,
    settings: PcrSettings,
}

#[wasm_bindgen]
impl PcrResults {
    pub fn get_matches(&self) -> JsValue {
        let res = if let Some(matches) = &self.matches {
            matches
                .fwd
                .iter()
                .map(|m| (true, m))
                .chain(matches.rev.iter().map(|m| (false, m)))
                .map(|(is_fwd, m)| JsMatch {
                    primer: &m.primer,
                    start: m.start,
                    len: m.len(),
                    fwd: is_fwd,
                })
                .collect::<Vec<_>>()
        } else {
            Vec::new()
        };
        JsValue::from_serde(&res).unwrap()
    }

    pub fn get_products(&self) -> JsValue {
        let res = self
            .products
            .iter()
            .map(|p| JsProduct {
                primer_fwd: &p.0.primer,
                primer_rev: &p.1.primer,
                start: p.0.start,
                end: p.1.start,
                len: p.len(&self.seq).unwrap_or_default(),
            })
            .collect::<Vec<_>>();
        JsValue::from_serde(&res).unwrap()
    }

    pub fn extract_product(&self, idx: u32) -> Result<JsSeq, JsValue> {
        if idx as usize >= self.products.len() {
            return Err(Error::new("No such product").into());
        }
        let p = &self.products[idx as usize];
        let mut seq = p.extract(&self.seq);
        seq.name = Some(format!(
            "{}_{}_{}",
            self.seq.name.clone().unwrap_or_default(),
            p.0.primer.name(),
            p.1.primer.name()
        ));
        Ok(JsSeq(Rc::new(seq)))
    }

    pub fn annotate_products(&self, idxes: Vec<u32>) -> Result<JsSeq, JsValue> {
        let mut seq = (*self.seq).clone();
        for i in idxes {
            let i = i as usize;
            if i >= self.products.len() {
                return Err(Error::new("No such product").into());
            }
            seq = self.products[i].annotate(seq, true);
        }
        Ok(JsSeq(Rc::new(seq)))
    }

    pub fn annotate_matches(&self, idxes: Vec<u32>) -> Result<JsSeq, JsValue> {
        let mut seq = (*self.seq).clone();
        if let Some(matches) = &self.matches {
            for i in idxes {
                let i = i as usize;
                if i >= matches.fwd.len() + matches.rev.len() {
                    return Err(Error::new("No such match").into());
                }
                let m = if i < matches.fwd.len() {
                    &matches.fwd[i]
                } else {
                    &matches.rev[i - matches.fwd.len()]
                };
                seq = m.annotate(seq);
            }
        }
        Ok(JsSeq(Rc::new(seq)))

    }

    pub fn run(&self, settings: &JsValue) -> JsPcrer {
        let settings: PcrSettings = settings.into_serde().unwrap();
        let matches = if settings.min_fp == self.settings.min_fp {
            self.matches.clone()
        } else {
            None
        };
        JsPcrer::new_from_rust(self.seq.clone(), self.primers.clone(), settings, matches)
    }
}
