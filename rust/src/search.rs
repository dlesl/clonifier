use gb_io::seq::*;
use pcr::Annealer;
use std::cmp;
use wasm_bindgen::prelude::*;


#[derive(Serialize, Clone, Debug, PartialEq, TypescriptDefinition)]
#[serde(rename_all = "camelCase")]
pub struct SeqSearchResult {
    start: i64,
    end: i64,
    fwd: bool,
}

/// reuse the pcr crate to do a fast, circular sequence search
/// Returns `max_res + 1` results to signify that the search was terminated prematurely
pub fn search(s: &Seq, query: &[u8], max_res: usize, rc: bool) -> Vec<SeqSearchResult> {
    if s.seq.is_empty() || query.is_empty() {
        return Vec::new();
    }
    // BNDM can't handle more than 63 chars, so we limit the 'seed' to that here,
    // and check the length later
    let a = Annealer::new(&s, cmp::min(63, query.len() as i64));
    let mut res = a
        .find_matches_fwd(&query)
        .filter(|fp| fp.extent == query.len() as i64)
        .map(|fp| SeqSearchResult {
            start: fp.start,
            end: fp.start + fp.extent,
            fwd: true,
        })
        .take(max_res + 1)
        .collect::<Vec<_>>();
    if rc {
        let rev = a
            .find_matches_rev(&query)
            .filter(|fp| -fp.extent == query.len() as i64) // rev matches have extent < 0
            .map(|fp| SeqSearchResult {
                start: fp.start + fp.extent + 1,
                end: fp.start + 1,
                fwd: false,
            })
            .take(max_res + 1 - res.len());
        res.extend(rev);
    }
    res
}

#[cfg(test)]
mod test {
    use super::*;
    #[test]
    fn test_search() {
        let s = Seq {
            // 78 bytes
            seq: b"catgCATG0123456789012345678901234567890123456789012345678901234567890123456789"
                [..]
                .into(),
            ..Seq::empty()
        };

        assert_eq!(
            search(&s, b"catgcatg", 2, true),
            vec![
                SeqSearchResult {
                    start: 0,
                    end: 8,
                    fwd: true
                },
                SeqSearchResult {
                    start: 0,
                    end: 8,
                    fwd: false
                }
            ]
        );
        assert_eq!(
            search(&s, b"catgcatg", 2, false),
            vec![SeqSearchResult {
                start: 0,
                end: 8,
                fwd: true
            }]
        );
        assert_eq!(
            search(
                &s,
                b"catgcatg0123456789012345678901234567890123456789012345678901234",
                2,
                false
            ),
            vec![SeqSearchResult {
                start: 0,
                end: 63,
                fwd: true
            }]
        );
        assert_eq!(
            search(
                &s,
                b"catgcatg0123456789012345678901234567890123456789012345678901234a",
                2,
                true
            ),
            vec![]
        );
        assert_eq!(
            search(
                &s,
                b"catgcatg01234567890123456789012345678901234567890123456789012345",
                2,
                true
            ),
            vec![SeqSearchResult {
                start: 0,
                end: 64,
                fwd: true
            }]
        );
        assert_eq!(
            search(
                &s,
                b"catgcatg012345678901234567890123456789012345678901234567890123456789",
                2,
                true
            ),
            vec![SeqSearchResult {
                start: 0,
                end: 68,
                fwd: true
            }]
        );
        assert_eq!(
            search(
                &s,
                b"catgcatg012345678901234567890123456789012345678901234567890123456789a",
                2,
                true
            ),
            vec![]
        );
    }
    #[test]
    fn test_search_circ() {
        let s = Seq {
            // 78 bytes
            seq: b"0123456789012345678901234567890123456789012345678901234567890123456789catgCATG"
                [..]
                .into(),
            topology: Topology::Circular,

            ..Seq::empty()
        };
        assert_eq!(
            search(&s, b"catgcatg", 2, false),
            vec![SeqSearchResult {
                start: 70,
                end: 78,
                fwd: true
            }]
        );
        assert_eq!(
            search(&s, b"catgcatg", 2, true),
            vec![
                SeqSearchResult {
                    start: 70,
                    end: 78,
                    fwd: true
                },
                SeqSearchResult {
                    start: 70,
                    end: 78,
                    fwd: false
                }
            ]
        );


        assert_eq!(
            search(
                &s,
                b"catgcatg0123456789012345678901234567890123456789012345678901234",
                2,
                false
            ),
            vec![SeqSearchResult {
                start: 70,
                end: 133,
                fwd: true
            }]
        );
        assert_eq!(
            search(
                &s,
                b"catgcatg0123456789012345678901234567890123456789012345678901234a",
                2,
                true
            ),
            vec![]
        );
        assert_eq!(
            search(
                &s,
                b"catgcatg01234567890123456789012345678901234567890123456789012345",
                2,
                true
            ),
            vec![SeqSearchResult {
                start: 70,
                end: 134,
                fwd: true
            }]
        );
        assert_eq!(
            search(
                &s,
                b"catgcatg012345678901234567890123456789012345678901234567890123456789",
                2,
                true
            ),
            vec![SeqSearchResult {
                start: 70,
                end: 138,
                fwd: true
            }]
        );
        assert_eq!(
            search(
                &s,
                b"catgcatg012345678901234567890123456789012345678901234567890123456789a",
                2,
                true
            ),
            vec![]
        );
    }
}
