use bio::data_structures::interval_tree::IntervalTree;
use gb_io::seq::*;
use std::collections::{HashMap, HashSet};
use std::iter::FromIterator;
use wasm_bindgen::prelude::*;

pub fn get_diagram_data(t: &Seq, subset: Option<Vec<usize>>) -> Box<[JsValue]> {
    const DIRECTIONAL: &[FeatureKind] = &[feature_kind!("CDS"), feature_kind!("gene")];
    // This can't be done in a closure because it's recursive
    fn range_finder<'a>(p: &'a Location, closure: &mut impl FnMut(i64, i64, bool), fwd: bool) {
        use Location::*;
        match *p {
            Complement(ref p) => range_finder(p, closure, !fwd),
            Join(ref ps) | OneOf(ref ps) | Bond(ref ps) | Order(ref ps) => {
                for p in ps {
                    range_finder(p, closure, fwd);
                }
            }
            Range((a, _), (b, _)) => closure(a, b, fwd),
            _ => {}
        }
    }
    struct ArrowIntervals<'a> {
        idx: usize,
        start: i64,
        end: i64,
        colour: i32,
        arrowhead: i32,
        name: &'a str,
        intervals: Vec<(i64, i64)>,
    };
    const NAME_KEYS: &[QualifierKey] = &[
        qualifier_key!("gene"),
        qualifier_key!("label"),
        qualifier_key!("locus_tag"),
        qualifier_key!("product"),
        qualifier_key!("organism"),
        qualifier_key!("note"),
    ];
    let mut arrows = Vec::<ArrowIntervals>::new();
    let mut colour_map = HashMap::new();
    let mut colour = -1;
    let filter: Option<HashSet<usize>> = subset.map(|s| HashSet::from_iter(s.into_iter()));
    for (idx, f) in t.features.iter().enumerate() {
        if let Some(filter) = &filter {
            if filter.get(&idx).is_none() {
                continue;
            }
        }
        let c = *colour_map.entry(&f.kind).or_insert_with(|| {
            colour += 1;
            colour
        });
        let name = NAME_KEYS
            .iter()
            .filter_map(|k| f.qualifier_values(k.clone()).next())
            .next()
            .unwrap_or_default();
        let has_dir = DIRECTIONAL.iter().any(|x| x == &f.kind);
        let mut add_span = |start, end, fwd| {
            let arrowhead = if !has_dir {
                0 // no arrow
            } else if fwd {
                1
            } else {
                -1
            };
            if start == 0 && t.is_circular() {
                if let Some(last) = arrows.last_mut() {
                    if last.end == t.len()
                                && last.idx == idx // same Feature?
                                && last.arrowhead == arrowhead
                    // same direction, if that matters?
                    {
                        // last.start -= t.len();
                        last.end = end + t.len();
                        last.intervals.push((start, end));
                        return;
                    }
                }
            }
            let a = ArrowIntervals {
                idx,
                start,
                end,
                colour: c,
                arrowhead,
                name,
                intervals: vec![(start, end)],
            };
            arrows.push(a);
        };
        range_finder(&f.location, &mut add_span, true);
    }
    arrows.sort_by(|b, a| (a.end - a.start).cmp(&(b.end - b.start))); // sort by length
    /// Final output for js
    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    struct Arrow<'a> {
        feature_id: u32,
        start: i32,
        end: i32,
        ring: u32,
        name: &'a str,
        colour: i32,
        arrowhead: i32,
        arrow_id: u32,
    }
    let mut it: IntervalTree<i64, usize> = IntervalTree::new();
    let mut res = Vec::new();
    let mut arrow_id = 0;
    for a in arrows {
        let slots = a
            .intervals
            .iter()
            .flat_map(|&(a, b)| it.find(a..b).map(|e| e.data()).cloned())
            .collect::<Vec<_>>();
        // find a ring that's not taken
        let ring = (0..)
            .skip_while(|i| slots.iter().any(|j| j == i))
            .next()
            .unwrap();
        // save it
        for (a, b) in a.intervals {
            it.insert(a..b, ring);
        }

        let arrow = Arrow {
            feature_id: a.idx as u32,
            start: a.start as i32,
            end: a.end as i32,
            ring: ring as u32,
            name: a.name,
            colour: a.colour,
            arrowhead: a.arrowhead,
            arrow_id,
        };

        arrow_id += 1;
        res.push(JsValue::from_serde(&arrow).unwrap());
    }
    res.into_boxed_slice().into()
}