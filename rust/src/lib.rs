#![feature(async_await, await_macro, futures_api)]
#[macro_use]
extern crate gb_io;
#[macro_use]
extern crate serde_derive;
#[macro_use]
extern crate wasm_typescript_definition;
use std::panic;
use std::rc::Rc;
use std::str;

use bincode::{deserialize_from, serialize_into};
use gb_io::reader::SeqReader;
use gb_io::seq::*;
use bio::io::fasta;

#[derive(Serialize, Deserialize, PartialEq)]
struct BinSeqVersion(u32);

// update this if/when `gb-io::Seq` breaks compatibility
const BIN_SEQ_FORMAT_VERSION: BinSeqVersion = BinSeqVersion(2);

use js_sys::{Error, RegExp, JsString};

use wasm_bindgen::prelude::*;

mod arc;
mod assembly;
mod assembly_diagram;
mod js_pcr;
mod seq_diagram;
mod utils;
mod search;
mod logger;
pub use crate::assembly::*;

#[wasm_bindgen]
extern "C" {
    // defined in `worker.ts`
    #[wasm_bindgen]
    fn workerPanic(msg: String);
    #[wasm_bindgen]
    pub fn logMessage(level: String, msg: String);
}

pub fn panic_hook(info: &panic::PanicInfo) {
    workerPanic(info.to_string());
}

#[wasm_bindgen]
pub fn init() {
    panic::set_hook(Box::new(panic_hook));
    logger::Logger::init().unwrap();
}

#[wasm_bindgen]
pub fn parse_gb(data: &[u8]) -> Result<Box<[JsValue]>, JsValue> {
    let mut res = Vec::new();
    for seq in SeqReader::new(data) {
        res.push(JsValue::from(JsSeq(Rc::new(
            seq.map_err(|e| Error::new(&format!("Parsing failed: {}", e)))?,
        ))));
    }
    Ok(res.into_boxed_slice())
}

#[wasm_bindgen]
pub fn parse_fasta(data: &[u8]) -> Result<Box<[JsValue]>, JsValue> {
    let mut res = Vec::new();
    for r in fasta::Reader::new(data).records() {
        let r = r.map_err(|e| Error::new(&format!("Parsing failed: {}", e)))?;
        r.check().map_err(|e| Error::new(&format!("Invalid sequence: {}", e)))?;
        let seq = Seq {
            seq: r.seq().into(),
            name: Some(r.id().into()),
            ..Seq::empty()
        };
        res.push(JsValue::from(JsSeq(Rc::new(seq))));
    }
    Ok(res.into_boxed_slice())
}

#[wasm_bindgen]
pub fn parse_bin(mut data: &[u8]) -> Result<JsSeq, JsValue> {
    // read version tag
    let ver: BinSeqVersion = deserialize_from(&mut data).map_err(|e| Error::new(&format!("Decoding header failed: {}", e)))?;
    if ver != BIN_SEQ_FORMAT_VERSION {
        return Err(Error::new(&format!("Can't decode version {} of binary sequence format", ver.0)).into())
    }
    let seq = deserialize_from(&mut data).map_err(|e| Error::new(&format!("Decoding failed: {}", e)))?;
    Ok(JsSeq(Rc::new(seq)))
}

#[wasm_bindgen(js_name = Seq)]
pub struct JsSeq(Rc<Seq>);

#[wasm_bindgen(js_class = Seq)]
impl JsSeq {
    pub fn set_name(&self, name: String) -> JsSeq {
        let mut res = Seq::clone(&self.0);
        res.name = Some(name);
        JsSeq(Rc::new(res))
    }
    pub fn get_metadata(&self) -> JsValue {
        #[derive(Serialize)]
        struct SeqMetadata<'a> {
            name: &'a str,
            circular: bool,
            len: i64,
        }
        JsValue::from_serde(&SeqMetadata {
            name: self.0.name.as_ref().map(|s| s.as_str()).unwrap_or_default(),
            circular: self.0.is_circular(),
            len: self.0.len(),
        })
        .unwrap()
    }
    pub fn is_empty(&self) -> bool {
        self.0.len() == 0
    }
    pub fn set_circular(&self, val: bool) -> JsSeq {
        let mut res = Seq::clone(&self.0);
        res.topology = if val {
            Topology::Circular
        } else {
            Topology::Linear
        };
        JsSeq(Rc::new(res))
    }
    pub fn get_diagram_data(&self) -> Box<[JsValue]> {
        crate::seq_diagram::get_diagram_data(&self.0)
    }
    pub fn revcomp(&self) -> JsSeq {
        JsSeq(Rc::new(self.0.revcomp()))
    }
    pub fn to_bin(&self) -> Result<Vec<u8>, JsValue> {
        let mut res = Vec::new();
        let mut buf = &mut res;
        // write version tag
        serialize_into(&mut buf, &BIN_SEQ_FORMAT_VERSION).expect("Writing header failed");
        let seq: &Seq = &self.0;
        // can this actually fail?
        serialize_into(&mut buf, seq).map_err(|e| Error::new(&format!("Couldn't encode: {}", e)))?;
        Ok(res)
    }
    pub fn to_gb(&self) -> Vec<u8> {
        let seq: &Seq = &self.0;
        let mut data = Vec::new();
        seq.write(&mut data).unwrap();
        data
    }
    pub fn get_feature_count(&self) -> u32 {
        self.0.features.len() as u32
    }
    pub fn get_feature(&self, idx: u32) -> JsValue {
        if idx as usize > self.0.features.len() {
            return JsValue::UNDEFINED;
        }
        JsValue::from_serde(&JsFeature::from(&self.0.features[idx as usize])).unwrap()
    }
    pub fn get_features(&self) -> JsValue {
        JsValue::from_serde(
            &self
                .0
                .features
                .iter()
                .map(JsFeature::from)
                .collect::<Vec<_>>(),
        )
        .unwrap()
    }
    pub fn get_feature_qualifiers(&self, idx: usize) -> JsValue {
        JsValue::from_serde(&self.0.features[idx].qualifiers).unwrap()
    }

    pub fn search_features(&self, query: &str, case_insensitive: bool, include_keys: bool) -> Vec<u32> {
        let flags = if case_insensitive { "i" } else { "" };
        // from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
        let escape_re = RegExp::new(r#"[.*+?^${}()|[\]\\]"#, "g");
        let query: JsString = query.into();
        let query: String = query.replace_by_pattern(&escape_re, "\\$&").into();
        let re = RegExp::new(&query, flags);
        self.0
            .features
            .iter()
            .enumerate()
            .filter(|(_, f)| {
                f.qualifiers
                    .iter()
                    .any(|(k, v)| (include_keys && re.test(k)) ||
                    v.as_ref().map(|v| re.test(v)).unwrap_or(false))
            })
            .map(|(i, _)| i as u32)
            .collect()
    }

    /// `None` if too many
    pub fn search_seq(&self, query: &str, max_res: usize) -> Option<Vec<i32>> {
        search::search(&self.0, query.as_bytes(), max_res, true)
    }
    pub fn get_seq_slice(&self, start: usize, end: usize) -> String {
        if start > self.0.seq.len() || end > self.0.seq.len() {
            return String::new();
        }
        str::from_utf8(&self.0.seq[start..end])
            .unwrap_or_default()
            .into()
    }
    pub fn extract_range(&self, start: i32, end: i32, new_name: Option<String>) -> JsSeq {
        let mut seq = self.0.extract_range(start as i64, end as i64);
        if new_name.is_some() {
            seq.name = new_name;
        }
        JsSeq(Rc::new(seq))
    }
    pub fn set_origin(&self, origin: i32) -> JsSeq {
        let mut seq = self.0.set_origin(origin as i64);
        seq.topology = Topology::Circular;
        JsSeq(Rc::new(seq))
    }
    pub fn clone(&self) -> JsSeq {
        JsSeq(self.0.clone())
    }
}

impl<'a> From<&'a Feature> for JsFeature<'a> {
    fn from(f: &'a Feature) -> Self {
        let (start, end) = match f.location.find_bounds() {
            Ok((start, end)) => (Some(start), Some(end)),
            Err(_) => (None, None),
        };
        let name = f
            .qualifier_values(qualifier_key!("gene"))
            .next()
            .unwrap_or("");
        JsFeature {
            name,
            fwd: match f.location {
                Location::Complement(_) => false,
                _ => true,
            },
            kind: &f.kind,
            start,
            end,
        }
    }
}

#[derive(Serialize)]
struct JsFeature<'a> {
    name: &'a str,
    fwd: bool,
    kind: &'a str,
    start: Option<i64>,
    end: Option<i64>,
}
