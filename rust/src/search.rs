use gb_io::seq::*;
use pcr::Annealer;
use std::cmp;

/// reuse the pcr crate to do a fast, circular sequence search
pub fn search(s: &Seq, query: &[u8], max_res: usize, rc: bool) -> Option<Vec<i32>> {
    if s.seq.is_empty() || query.is_empty() {
        return Some(Vec::new());
    }
    // BNDM can't handle more than 63 chars, so we limit the 'seed' to that here,
    // and check the length later
    let a = Annealer::new(&s, cmp::min(63, query.len() as i64));
    let fwd = a.find_matches_fwd(&query);
    // conditional iterator chaining hack, is there a nicer way?
    let rev = if rc {
        Some(a.find_matches_rev(&query))
    } else {
        None
    };
    let res: Vec<i32> = fwd
        .chain(rev.into_iter().flatten())
        .filter(|fp| fp.extent.abs() == query.len() as i64) // rev matches have extent < 0
        .map(|fp| (fp.start + cmp::min(fp.extent + 1, 0)) as i32) // move rev matches to their end
        .take(max_res + 1)
        .collect();
    if res.len() == max_res + 1 {
        None // too many hits
    } else {
        Some(res)
    }
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
        assert_eq!(search(&s, b"catgcatg", 2, true), Some(vec![0, 0]));
        assert_eq!(search(&s, b"catgcatg", 2, false), Some(vec![0]));
        assert_eq!(
            search(
                &s,
                b"catgcatg0123456789012345678901234567890123456789012345678901234",
                2,
                false
            ),
            Some(vec![0])
        );
        assert_eq!(
            search(
                &s,
                b"catgcatg0123456789012345678901234567890123456789012345678901234a",
                2,
                true
            ),
            Some(vec![])
        );
        assert_eq!(
            search(
                &s,
                b"catgcatg01234567890123456789012345678901234567890123456789012345",
                2,
                true
            ),
            Some(vec![0])
        );
        assert_eq!(
            search(
                &s,
                b"catgcatg012345678901234567890123456789012345678901234567890123456789",
                2,
                true
            ),
            Some(vec![0])
        );
        assert_eq!(
            search(
                &s,
                b"catgcatg012345678901234567890123456789012345678901234567890123456789a",
                2,
                true
            ),
            Some(vec![])
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
        assert_eq!(search(&s, b"catgcatg", 2, false), Some(vec![70]));
        assert_eq!(search(&s, b"catgcatg", 2, true), Some(vec![70, 70]));
        assert_eq!(
            search(
                &s,
                b"catgcatg0123456789012345678901234567890123456789012345678901234",
                2,
                false
            ),
            Some(vec![70])
        );
        assert_eq!(
            search(
                &s,
                b"catgcatg0123456789012345678901234567890123456789012345678901234a",
                2,
                true
            ),
            Some(vec![])
        );
        assert_eq!(
            search(
                &s,
                b"catgcatg01234567890123456789012345678901234567890123456789012345",
                2,
                true
            ),
            Some(vec![70])
        );
        assert_eq!(
            search(
                &s,
                b"catgcatg012345678901234567890123456789012345678901234567890123456789",
                2,
                true
            ),
            Some(vec![70])
        );
        assert_eq!(
            search(
                &s,
                b"catgcatg012345678901234567890123456789012345678901234567890123456789a",
                2,
                true
            ),
            Some(vec![])
        );
    }
}
