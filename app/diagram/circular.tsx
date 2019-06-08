import * as React from "react";
import * as ReactDOM from "react-dom";
import * as d3 from "d3";
import { useElementSize } from "../utils";
import {
  IArrow,
  newDivId,
  padding,
  intersectsInterval,
  maxSvgElements,
  colourScale,
  spacing,
  arrowLength,
  textPadding,
  DiagramProps,
  DiagramHandle
} from ".";
import { mod } from "../utils";

const PI2 = Math.PI * 2;

let render = 0;

export default React.forwardRef(
  (
    { data, name, len, hidden, highlightedFeature, noCanvas }: DiagramProps,
    ref: React.Ref<DiagramHandle>
  ) => {
    console.log(render++);
    const [divId] = React.useState(() => newDivId());
    const divRef = React.useRef<HTMLDivElement>(null);
    const dragRectRef = React.useRef<SVGRectElement>(null);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const [width, height] = useElementSize(divRef);
    let radius = Math.min(width, height) / 2 - padding;
    radius = Math.max(radius, 0);
    const [scale, setScale] = React.useState(1);
    const [rotation, setRotation] = React.useState(0);
    const [drag] = React.useState(() => d3.drag());
    React.useEffect(() => {
      drag(d3.select(dragRectRef.current));
      drag.on("drag", () => {
        const startX = d3.event.x - d3.event.dx;
        const startY = d3.event.y - d3.event.dy;
        const theta =
          Math.atan2(d3.event.y, d3.event.x) - Math.atan2(startY, startX);
        //@ts-ignore
        ReactDOM.flushSync(() => setRotation(r => mod(r + theta, PI2)));
      });
    }, []);
    const visibleRange = [0, len - 1]; // gets updated later
    React.useImperativeHandle(ref, () => ({
      scrollTo: (fStart: number, fEnd: number) => {
        const aStart = (PI2 * fStart) / len;
        const aEnd = (PI2 * fEnd) / len;
        setRotation(mod(-(aEnd + aStart) / 2, PI2));
        // console.log(fStart, fEnd, aStart, aEnd);
      },
      getVisibleRange: () => visibleRange,
      getTwelveOClock: () => mod(Math.floor((-rotation / PI2) * len), len) + 1
    }));
    const circleYTranslation = radius * (scale - 1 / scale);
    const x = Math.floor(width / 2);
    // gradually move the circle down as we zoom in
    const y = Math.floor(height / 2) + circleYTranslation;
    const svgTransform = `translate(${x},${y})`;
    let partialView = radius * scale > width / 2 && circleYTranslation > height;
    // maximum possible view angle (at any radius, ie. for features)
    const maxViewAngle = partialView
      ? // ? Math.acos((circleYTranslation - height) / (radius * scale)) // TODO: tighten this
        Math.asin(x / (radius * scale - spacing * 5)) // TODO: calculate this
      : PI2;
    if (isNaN(maxViewAngle)) {
      partialView = false;
    }
    // intersection of the circle with the sides
    const minViewAngle = partialView ? Math.asin(x / (radius * scale)) : PI2;
    const onWheel = (e: React.WheelEvent) => {
      // from d3-zoom
      const wheelDelta = (-e.deltaY * (e.deltaMode ? 120 : 1)) / 500;
      let k = Math.pow(2, wheelDelta);
      let s = scale * k;
      if (s < 1) {
        k = 1.0 / scale;
        s = 1.0;
      }
      const sMax = Math.max(len / width, 1);
      if (s > sMax) {
        k = sMax / scale;
        s = sMax;
      }
      setScale(s);
      // TODO: calculate this exactly
      // Rotate the view to keep the feature under the cursor
      const [pX, pY] = d3.clientPoint(dragRectRef.current, e);
      const isNearOrOutsideCircle =
        Math.pow(pX, 2) + Math.pow(pY, 2) > Math.pow(radius * scale, 2) / 2;
      if (isNearOrOutsideCircle) {
        const theta0 = Math.atan2(pY, pX);
        const theta1 = Math.atan2(pY * k, pX);
        const delta = theta1 - theta0;
        setRotation(rotation + delta);
      }
    };
    let limits = null;
    const visible = [];
    if (partialView) {
      // TODO: this is a mess: would be better to 'unwrap' the view, and the
      // arrow coords
      let left = Math.floor(((-maxViewAngle - rotation) / PI2) * len);
      let right = Math.ceil(((maxViewAngle - rotation) / PI2) * len);
      const intervals = [];
      left = mod(left, len);
      right = mod(right, len);
      visibleRange[0] = left;
      visibleRange[1] = right;
      limits = [left, right];
      if (right > left) {
        intervals.push([left, right]);
      } else {
        intervals.push([left, len]);
        intervals.push([0, right]);
      }
      for (const d of data) {
        const checkInterval = (displayInterval, arrowInterval, id) => {
          const [a, b] = displayInterval;
          const [aStart, aEnd] = arrowInterval;
          if (intersectsInterval(aStart, aEnd, a, b)) {
            const start = Math.max(a, aStart);
            const end = Math.min(b, aEnd);
            visible.push({
              ...d,
              start,
              end,
              arrowId: d.arrowId + id /* make the key unique for react */
            });
          }
        };
        intervals.forEach((i, idx) =>
          checkInterval(i, [d.start, d.end], idx / 10)
        );
        if (d.end > len)
          intervals.forEach((i, idx) =>
            checkInterval(i, [0, d.end - len], idx / 10 + 0.01)
          );
      }
    } else {
      for (const d of data) {
        if (d.end - d.start + 1 === len) {
          visible.push({ ...d, start: 0, end: len - 1 }); // the circle is rendered much more nicely like this
        } else {
          visible.push(d);
        }
      }
    }
    const minLenSvg = (10 / radius / scale / PI2) * len; // 10 px
    let svgArrowData: IArrow[], canvasArrowData: IArrow[];
    if (!noCanvas) {
      const longEnough =
        visible.length < maxSvgElements
          ? d => true
          : d => d.end - d.start > minLenSvg;
      svgArrowData = visible.filter(longEnough);
      canvasArrowData = visible.filter(d => !longEnough(d));
    } else {
      svgArrowData = visible;
      canvasArrowData = [];
    }
    // We use `useLayoutEffect` instead of `useEffect` to ensure the canvas is always
    // in sync with the svg while dragging.
    React.useLayoutEffect(() => {
      const context = canvasRef.current.getContext("2d");
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, width, height);
      context.translate(x, y);
      context.beginPath();
      if (radius * scale > width / 2) {
        context.arc(
          0,
          0,
          radius * scale,
          -minViewAngle - Math.PI / 2,
          minViewAngle - Math.PI / 2
        );
      } else {
        context.arc(0, 0, radius * scale, 0, PI2);
      }
      context.stroke();
      context.rotate(rotation);
      canvasArrowData.sort((a, b) => b.colour - a.colour);
      let lastColour = 0;
      for (const a of canvasArrowData) {
        if (a.colour !== lastColour) {
          lastColour = a.colour;
          context.fillStyle = colourScale(lastColour);
        }
        context.beginPath();
        drawArrow(a, len, limits, radius, scale, rotation, context);
        context.closePath();
        context.fill();
      }
    });
    const svgArrows = svgArrowData.map(a => {
      const arrowPath = d3.path();
      const textPath = d3.path();
      drawArrow(a, len, limits, radius, scale, rotation, arrowPath, textPath);
      return {
        arrowPath,
        textPath,
        arrow: a,
        textPathId: `${divId}_label_${a.arrowId}`
      };
    });
    return (
      <div
        ref={divRef}
        className={"diagram"}
        style={{
          position: "relative",
          display: hidden ? "none" : ""
        }}
        onWheel={onWheel}
      >
        <canvas
          width={width}
          height={height}
          style={{ position: "absolute" }}
          ref={canvasRef}
        />
        <svg style={{ position: "absolute", width, height }}>
          <g transform={svgTransform}>
            <g transform={`rotate(${(rotation / PI2) * 360})`}>
              {svgArrows.map(a => (
                <g key={a.arrow.arrowId}>
                  <path
                    fill={colourScale(a.arrow.colour)}
                    d={a.arrowPath.toString()}
                  />
                </g>
              ))}
              {svgArrows.map(a => (
                <path
                  key={a.arrow.arrowId}
                  d={a.textPath.toString()}
                  fill={"none"}
                  id={a.textPathId}
                />
              ))}
              {svgArrows.map(a => (
                <text key={a.arrow.arrowId}>
                  <textPath
                    startOffset={"50%"}
                    style={{
                      textAnchor: "middle"
                      // fontSize: spacing - padding
                    }}
                    xlinkHref={`#${a.textPathId}`}
                  >
                    {a.arrow.name}
                  </textPath>
                </text>
              ))}
            </g>
            <text style={{ textAnchor: "middle" }}>{name}</text>
            <rect
              x={-x}
              y={-y}
              width={width}
              height={height}
              fill="none"
              pointerEvents="all"
              ref={dragRectRef}
            />
          </g>
        </svg>
      </div>
    );
  }
);

function drawArrow(
  d: IArrow,
  len: number,
  limits: number[],
  radius: number,
  scaleRadius: number,
  rotation: number,
  arrow: CanvasRenderingContext2D | d3.Path,
  text?: CanvasRenderingContext2D | d3.Path
) {
  const r = radius * scaleRadius - d.ring * spacing - (d.ring + 1) * padding;
  if (r < 20) {
    console.log("Radius too small, bailing");
    return;
  }
  const offset = -Math.PI / 2; // rotate -90°
  const a = (PI2 * d.start) / len; // angle from 12 o'clock
  const b = (PI2 * d.end) / len;
  const ar = a + offset; // rotated coordinate for plotting
  const br = b + offset;
  const hl = Math.min((PI2 * arrowLength) / scaleRadius, Math.max(b - a, 0));
  const hr = r - spacing / 2; // arrowhead radius
  if (b - a < 0 || hl < 0) {
    debugger;
  }
  let arrowhead = d.arrowhead;
  if ((arrowhead === -1 && ar + hl > br) || (arrowhead === 1 && br - hl < ar)) {
    arrowhead = 0;
  }
  if ((b - a) * r > 10) {
    switch (arrowhead) {
      case 0:
        arrow.arc(0, 0, r, ar, br, false);
        arrow.arc(0, 0, r - spacing, br, ar, true);
        break;
      case -1:
        arrow.moveTo(hr * Math.cos(ar), hr * Math.sin(ar));
        arrow.arc(0, 0, r, ar + hl, br, false);
        arrow.arc(0, 0, r - spacing, br, ar + hl, true);
        break;
      case 1:
        arrow.arc(0, 0, r, ar, br - hl, false);
        arrow.lineTo(hr * Math.cos(br), hr * Math.sin(br)); // arrowhead
        arrow.arc(0, 0, r - spacing, br - hl, ar, true);
        break;
    }
    if (text) {
      let mid = (a + b) / 2 + rotation;
      mid = mod(mid, Math.PI * 2);
      if (mid > Math.PI / 2 && mid < Math.PI * 1.5) {
        text.arc(0, 0, r - textPadding * 2, br, ar, true);
      } else {
        text.arc(0, 0, r - spacing + textPadding * 2, ar, br, false);
      }
    }
  } else {
    // linear
    const lr = r - spacing;
    const at = ar;
    const bt = br;
    const tr = lr + textPadding * 2;
    const car = Math.cos(ar);
    const sar = Math.sin(ar);
    const cbr = Math.cos(br);
    const sbr = Math.sin(br);
    switch (d.arrowhead) {
      case 0:
        arrow.moveTo(r * car, r * sar);
        arrow.lineTo(r * cbr, r * sbr);
        arrow.lineTo(lr * cbr, lr * sbr);
        arrow.lineTo(lr * car, lr * sar);
        if (text) {
          text.moveTo(tr * Math.cos(at), tr * Math.sin(at));
          text.lineTo(tr * Math.cos(bt), tr * Math.sin(bt));
        }
        break;
      case -1:
        arrow.moveTo(hr * car, hr * sar);
        arrow.lineTo(r * Math.cos(ar + hl), r * Math.sin(ar + hl));
        arrow.lineTo(r * cbr, r * sbr);
        arrow.lineTo(lr * cbr, lr * sbr);
        arrow.lineTo(lr * Math.cos(ar + hl), lr * Math.sin(ar + hl));
        if (text) {
          text.moveTo(tr * Math.cos(at + hl), tr * Math.sin(at + hl));
          text.lineTo(tr * Math.cos(bt), tr * Math.sin(bt));
        }
        break;
      case 1:
        arrow.moveTo(r * car, r * sar);
        arrow.lineTo(r * Math.cos(br - hl), r * Math.sin(br - hl));
        arrow.lineTo(hr * cbr, hr * sbr);
        arrow.lineTo(lr * Math.cos(br - hl), lr * Math.sin(br - hl));
        arrow.lineTo(lr * car, lr * sar);
        if (text) {
          text.moveTo(tr * Math.cos(at), tr * Math.sin(at));
          text.lineTo(tr * Math.cos(bt - hl), tr * Math.sin(bt - hl));
        }
        break;
    }
  }
}
