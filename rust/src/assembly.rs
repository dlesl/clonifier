use crate::JsSeq;
use assembly::{
    extract_product_seq, find_homology, find_products, product_len, MatchIdx, Node, Path,
};
use gb_io::seq::*;
use itertools::Itertools;
use js_sys::Error;
use std::cell::Cell;

use std::rc::Rc;

use wasm_bindgen::prelude::*;

use crate::assembly_diagram;

#[derive(Deserialize)]
struct JsAssemblySettings {
    limit: usize,
}

#[wasm_bindgen]
pub struct Assembly {
    seqs: Vec<Rc<Seq>>,
}

#[wasm_bindgen]
impl Assembly {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Assembly {
        Assembly { seqs: vec![] }
    }
    pub fn clone(&self) -> Assembly {
        Assembly { seqs: self.seqs.clone() }
    }
    pub fn push(&mut self, s: &JsSeq) {
        self.seqs.push(s.0.clone());
    }
    pub fn assemble(&self, settings: &JsValue) -> Result<AssemblyResult, JsValue> {
        let settings: JsAssemblySettings = settings.into_serde().unwrap();
        let seqs: Vec<&Seq> = self.seqs.iter().map(|s| s.as_ref()).collect();
        let matches = find_homology(&seqs, settings.limit);
        let products = find_products(&matches, &seqs)
            .map_err(|e| Error::new(&format!("Failed finding products: {}", e)))?;
        let convert = |v: Vec<Path>| {
            let mut res: Vec<_> = v
                .into_iter()
                .map(|p: Path| Product {
                    len: product_len(&p, &seqs) as usize,
                    desc: p
                        .iter()
                        .map(|&Node(idx, _)| {
                            let mut name = seqs[idx.index()]
                                .name
                                .clone()
                                .unwrap_or_else(|| "<>".into());
                            if let MatchIdx::IdxRc(_) = idx {
                                name.push_str("[rev]");
                            }
                            name
                        })
                        .join(", "),
                    n_fragments: p.len(),
                    path: p,
                })
                .collect();
            res.sort();
            res
        };
        Ok(AssemblyResult {
            circular: convert(products.circular),
            linear: convert(products.linear),
            seqs: self.seqs.clone(),
            settings,
        })
    }
}

#[wasm_bindgen]
pub struct AssemblyResult {
    seqs: Vec<Rc<Seq>>,
    settings: JsAssemblySettings,
    circular: Vec<Product>,
    linear: Vec<Product>,
}

#[wasm_bindgen]
impl AssemblyResult {
    pub fn get_circular(&self) -> JsValue {
        JsValue::from_serde(&self.circular).unwrap()
    }
    pub fn get_linear(&self) -> JsValue {
        JsValue::from_serde(&self.linear).unwrap()
    }
    pub fn render_diagram_linear(&self, index: usize) -> String {
        self.render_diagram_impl(&self.linear, index)
    }
    pub fn render_diagram_circular(&self, index: usize) -> String {
        self.render_diagram_impl(&self.circular, index)
    }
    fn render_diagram_impl(&self, array: &[Product], index: usize) -> String {
        thread_local! {
            static NEXT_UNIQUE_ID: Cell<u32> = Cell::new(0);
        }

        fn make_unique_id() -> u32 {
            NEXT_UNIQUE_ID.with(|id| {
                let res = id.get();
                id.set(res.wrapping_add(1));
                res
            })
        }
        assembly_diagram::Diagram::new((600.0, 300.0), &self.seqs(), &array[index].path, make_unique_id())
            .render_assembly()
    }
    pub fn extract_product_linear(&self, index: usize) -> JsSeq {
        self.extract_product_impl(&self.linear, index)
    }
    pub fn extract_product_circular(&self, index: usize) -> JsSeq {
        self.extract_product_impl(&self.circular, index)
    }
    fn extract_product_impl(&self, array: &[Product], index: usize) -> JsSeq {
        let product = &array[index];
        let mut seq = extract_product_seq(&product.path, &self.seqs());
        seq.name = Some(sanitise_name(&product.desc));
        JsSeq(Rc::new(seq))
    }
    fn seqs(&self) -> Vec<&Seq> {
        self.seqs.iter().map(|s| s.as_ref()).collect()
    }
}

#[derive(Debug, Clone, PartialEq, PartialOrd, Ord, Eq, Serialize)]
pub struct Product {
    len: usize,
    n_fragments: usize,
    #[serde(skip_serializing)]
    path: Path,
    desc: String,
}

pub fn sanitise_name(name: &str) -> String {
    name.split_whitespace().join("_")
}
