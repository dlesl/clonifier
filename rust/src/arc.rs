use std::f64::consts::PI;

use svg::node::element::path::Data;

const EPSILON: f64 = std::f32::EPSILON as f64;
// Because the SVG spec only requires 32-bit precision
const TAU: f64 = 2.0 * PI;
const TAU_EPSILON: f64 = TAU - EPSILON;

// Following function ported from d3-path: https://github.com/d3/d3-path
pub fn arc(mut data: Data, x: f64, y: f64, r: f64, a0: f64, a1: f64, ccw: bool) -> Data {
    let dx = r * a0.cos();
    let dy = r * a0.sin();
    let x0 = x + dx;
    let y0 = y + dy;
    let cw = !ccw;
    let mut da = if ccw { a0 - a1 } else { a1 - a0 };
    // Is the radius negative? Error.
    if r < 0.0 {
        panic!("negative radius: {}", r);
    }

    // Is this path empty? Move to (x0,y0).
    if data.is_empty() {
        data = data.move_to((x0, y0));
    } else {
        // this is a hack, we line_to even if we don't need to because we don't know the last position...
        data = data.line_to((x0, y0));
    }

    // Is this arc empty? We’re done.
    if r == 0.0 {
        return data;
    }

    // Does the angle go the wrong way? Flip the direction.
    if da < 0.0 {
        da = da % TAU + TAU
    };

    // Is this a complete circle? Draw two arcs to complete the circle.
    if da > TAU_EPSILON {
        data = data
            .elliptical_arc_to((r, r, 0, 1, cw as u32, (x - dx), (y - dy)))
            .elliptical_arc_to((r, r, 0, 1, cw as u32, x0, y0));
    }
    // Is this arc non-empty? Draw an arc!
    else if da > EPSILON {
        data = data.elliptical_arc_to((
            r,
            r,
            0,
            (da >= PI) as u32,
            cw as u32,
            x + r * a1.cos(),
            y + r * a1.sin(),
        ));
    }
    data
}