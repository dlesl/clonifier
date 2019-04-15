use std::f64::consts::PI;

use assembly::*;
use gb_io::seq::Seq;
use svg::node;
use svg::node::element::path::Data;
use svg::node::element::{Line, Path, Rectangle, Text, TextPath};
use svg::Document;

use crate::arc::arc;

const TAU: f64 = PI * 2.0;

pub struct Diagram<'a> {
    width: f64,
    height: f64,
    seqs: &'a [&'a Seq],
    path: &'a assembly::Path,
    total_len: i32,
    y_spacing: f64,
    fragment_thickness: f64,
    prefix: u32,
}

impl<'a> Diagram<'a> {
    pub fn new(
        (width, height): (f64, f64),
        seqs: &'a [&'a Seq],
        path: &'a assembly::Path,
        prefix: u32,
    ) -> Diagram<'a> {
        let total_len = assembly::product_len(path, seqs) as i32;
        Diagram {
            width,
            height,
            seqs,
            path,
            total_len,
            y_spacing: 10.0,
            fragment_thickness: 10.0,
            prefix,
        }
    }
    fn circular(&self) -> bool {
        (self.path[0].1).2 != 0
    }
    fn radius(&self) -> f64 {
        if self.width > self.height {
            self.height / 2.0
        } else {
            self.width / 2.0
        }
    }
    fn centre(&self) -> (f64, f64) {
        (self.width / 2.0, self.height / 2.0)
    }
    fn segment(&self, start: f64, end: f64, y: f64) -> Path {
        let mut data = Data::new();
        data = arc(
            data,
            self.centre().0,
            self.centre().1,
            self.radius() - y,
            start * TAU,
            end * TAU,
            false,
        );
        data = arc(
            data,
            self.centre().0,
            self.centre().1,
            self.radius() - y - self.fragment_thickness,
            end * TAU,
            start * TAU,
            true,
        );
        data = data.close();
        Path::new().set("d", data)
    }
    fn text_path(&self, start: f64, end: f64, y: f64) -> Path {
        let mut tdata = Data::new();
        tdata = arc(
            tdata,
            self.centre().0,
            self.centre().1,
            self.radius() - y - self.fragment_thickness,
            start * TAU,
            end * TAU,
            false,
        );
        Path::new().set("d", tdata)
    }
    fn fragment(
        &self,
        index: usize,
        mut doc: Document,
        seq: &Seq,
        origin: (f64, f64),
        included: (u32, u32),
        fwd: bool,
    ) -> Document {
        let (x, y) = origin;
        let len = seq.len() as f64 / self.total_len as f64;
        let id = format!("fragment_{}_{}", self.prefix, index);
        let path_for_text = if self.circular() {
            self.text_path(x, x + len, y)
        } else {
            let data = Data::new()
                .move_to((x * self.width, y + self.fragment_thickness - 2.0))
                .line_by((len * self.width, 0.0));
            Path::new().set("d", data)
        };
        let path_for_text = path_for_text.set("id", id.clone()).set("fill", "none");
        let mut name = seq.name.clone().unwrap_or_else(|| "Untitled".into());
        if !fwd {
            name = format!("{} [rev]", name);
        }
        let text_path = TextPath::new()
            .set("startOffset", "50%")
            .set("text-anchor", "middle")
            .set("href", format!("#{}", id))
            .add(node::Text::new(name));
        let text = Text::new()
            .set(
                "style",
                format!("font: {}px sans-serif;", self.fragment_thickness as i64),
            )
            .add(text_path);
        let class = if fwd {
            "assembly_diagram_fragment_fwd"
        } else {
            "assembly_diagram_fragment_rev"
        };
        if self.circular() {
            let fragment = self.segment(x, x + len, y).set("class", class);
            doc = doc.add(fragment);
        } else {
            let rect = Rectangle::new()
                .set("x", x * self.width)
                .set("y", y)
                .set("width", len * self.width)
                .set("height", self.fragment_thickness)
                .set("class", class);
            doc = doc.add(rect);
        };
        let include_to = included.1 as f64 / self.total_len as f64;
        if self.circular() {
            let shading = |offset, width| {
                self.segment(x + offset, x + offset + width, y)
                    .set("fill", "url(#diagonalHatch)")
            };
            let width1 = included.0 as f64 / self.total_len as f64;
            doc = doc
                .add(shading(0.0, width1))
                .add(shading(include_to, len - include_to))
                // now add the included part again so the shading can't hide it if it wraps around ;)
                .add(
                    self.segment(x + width1, x + include_to, y)
                        .set("class", class),
                );
        } else {
            let shading = |offset, width| {
                Rectangle::new()
                    .set("x", (x + offset) * self.width)
                    .set("y", y)
                    .set("width", width * self.width)
                    .set("height", self.fragment_thickness)
                    .set("fill", "url(#diagonalHatch)")
            };
            doc = doc
                .add(shading(0.0, included.0 as f64 / self.total_len as f64))
                .add(shading(include_to, len - include_to))
        }
        doc.add(path_for_text).add(text)
    }
    fn connection(&self, mut doc: Document, x: f64, y: f64, y2: f64, match_len: u32) -> Document {
        let len = match_len as f64 / self.total_len as f64;
        if self.circular() {
            let line = |start_offset, end_offset| {
                let start: f64 = (x + start_offset) * TAU;
                let end: f64 = (x + end_offset) * TAU;
                let r = self.radius() - y;
                let r2 = self.radius() - y2;
                let (cx, cy) = self.centre();
                Line::new()
                    .set("x1", cx + r * start.cos())
                    .set("y1", cy + r * start.sin())
                    .set("x2", cx + r2 * end.cos())
                    .set("y2", cy + r2 * end.sin())
                    .set("class", "assembly_diagram_connector")
            };
            doc = doc.add(line(0.0, len));
            doc.add(line(len, 0.0))
        } else {
            let line = |start_offset, end_offset| {
                Line::new()
                    .set("x1", (x + start_offset) * self.width)
                    .set("y1", y)
                    .set("x2", (x + end_offset) * self.width)
                    .set("y2", y2)
                    .set("class", "assembly_diagram_connector")
            };
            doc = doc.add(line(0.0, len));
            doc.add(line(len, 0.0))
        }
    }
    pub fn render_assembly(&self) -> String {
        let mut document = Document::new().set(
            "viewBox",
            (-40.0, -40.0, self.width + 80.0, self.height + 80.0),
        );
        let mut x = 0.0;
        let mut y = 0.0;
        let mut last_to = 0;
        for (i, &assembly::Node(idx, assembly::Match(from, to, len))) in
            self.path.iter().enumerate()
        {
            x += (from as f64 - last_to as f64) / self.total_len as f64;
            let connect_start_x = x;
            let offset = to as f64 / self.total_len as f64;
            let next_from = self
                .path
                .get(i + 1)
                .map(|&assembly::Node(_, assembly::Match(f, _, len))| f + len)
                .unwrap_or_else(|| self.seqs[idx.index()].len() as u32);
            document = self.fragment(
                i,
                document,
                &self.seqs[idx.index()],
                (x - offset, y),
                (to, next_from),
                match idx {
                    Idx(_) => true,
                    IdxRc(_) => false,
                },
            );
            if i == 0 {
                // skip the first if linear
                if self.circular() {
                    // connect all the way to the end
                    document = self.connection(
                        document,
                        connect_start_x,
                        y + self.fragment_thickness,
                        y + (self.y_spacing + self.fragment_thickness)
                            * (self.path.len() - 1) as f64,
                        len,
                    );
                }
            } else {
                document = self.connection(document, connect_start_x, y - self.y_spacing, y, len);
            }
            y += self.fragment_thickness;
            y += self.y_spacing;
            last_to = to as i32;
        }
        let mut res: Vec<u8> = Vec::new();
        svg::write(&mut res, &document).unwrap();
        String::from_utf8(res).unwrap()
    }
}
