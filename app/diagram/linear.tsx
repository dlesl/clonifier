import * as React from "react";
import * as d3 from "d3";
import { useElementSize } from "../utils";
import { Path, ZoomTransform } from "d3";
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
import { highlightedFeatureColour } from "../seq_view";

export default React.forwardRef(
  (
    {
      data,
      name,
      len,
      hidden,
      highlightedFeature /*, setVisibleInterval */
    }: DiagramProps,
    ref: React.Ref<DiagramHandle>
  ) => {
    const [divId] = React.useState(() => newDivId());
    const diagramDiv = React.useRef<HTMLDivElement>(null);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const axisGRef = React.useRef<SVGGElement>(null);
    const [width, height] = useElementSize(diagramDiv);
    const lineLength = Math.max(0, width - padding * 2);
    const [zoom] = React.useState(() => d3.zoom());
    zoom
      .scaleExtent([1, len / width])
      .translateExtent([[padding, 0], [padding + lineLength, height]]);
    let scale = d3
      .scaleLinear()
      .range([padding, padding + lineLength])
      .domain([0, len - 1]);
    const [transform, setTransform] = React.useState<ZoomTransform>(null);
    if (transform) {
      scale = transform.rescaleX(scale);
    }
    React.useEffect(() => {
      zoom(d3.select(diagramDiv.current));
      zoom.on("zoom", () => setTransform(d3.event.transform));
    }, []);
    React.useImperativeHandle(ref, () => ({
      scrollTo: (fStart: number, fEnd: number) => {
        setTransform(
          d3.zoomIdentity
            .translate((-fStart / len) * width, 0)
            .scale(len / (fEnd - fStart))
        );
      },
      visibleRange: [
        Math.floor(scale.invert(padding)),
        Math.ceil(scale.invert(padding + lineLength))
      ],
      twelveOClock: null
    }));
    const left = scale.invert(0);
    const right = scale.invert(width);
    const tickFormat = (x: number) => {
      const range = right - left;
      const e = range <= 0 ? 0 : Math.floor(Math.log10(range) / 3);
      const k = Math.pow(10, e * 3);
      const suffix = ["", " k", " M", " G", " T"];
      return x / k + suffix[e];
    };
    React.useEffect(() => {
      const axis = d3.axisTop(scale).tickFormat(tickFormat);
      axis(d3.select(axisGRef.current));
    }, [scale]);
    const middle = height / 3;
    const minLenSvg = scale.invert(10) - scale.invert(0); // 10 px
    const visible = data.filter(
      d => intersectsInterval(d.start, d.end, left, right) // offscreen?
    );
    const longEnough =
      visible.length < maxSvgElements
        ? d => true
        : d => d.end - d.start > minLenSvg;
    const svgArrowData: IArrow[] = visible.filter(longEnough);
    const canvasArrowData: IArrow[] = visible.filter(d => !longEnough(d));
    React.useEffect(() => {
      const context = canvasRef.current.getContext("2d");
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.translate(0, middle);
      context.clearRect(0, 0, width, height - middle);
      canvasArrowData.sort((a, b) => b.colour - a.colour);
      let lastColour = 0;
      for (const a of canvasArrowData) {
        if (a.colour !== lastColour) {
          lastColour = a.colour;
          context.fillStyle = colourScale(lastColour);
        }
        if (a.featureId === highlightedFeature) {
          context.fillStyle = highlightedFeatureColour;
        }
        context.beginPath();
        drawArrow(a, lineLength, scale, [0, width], context);
        context.closePath();
        context.fill();
        if (a.featureId === highlightedFeature) {
          context.fillStyle = colourScale(lastColour); // restore
        }
      }
    });
    const svgArrows = svgArrowData.map(a => {
      const arrowPath = d3.path();
      const textPath = d3.path();
      drawArrow(a, lineLength, scale, [0, width], arrowPath, textPath);
      return {
        arrowPath,
        textPath,
        arrow: a,
        textPathId: `${divId}_label_${a.arrowId}`
      };
    });
    let maskImage = `linear-gradient(to right,rgba(0,0,0,0) 0px, rgba(0,0,0,1) ${padding}px, rgba(0,0,0,1) ${padding +
      lineLength}px, rgba(0,0,0,0) ${width}px)`;
    return (
      <div
        ref={diagramDiv}
        className={"diagram"}
        style={{ position: "relative", display: hidden ? "none" : "" }}
      >
        <canvas
          width={width}
          height={height}
          style={{ position: "absolute", maskImage }}
          ref={canvasRef}
        />
        <svg style={{ position: "absolute", width, height, maskImage }}>
          <g transform={`translate(0,${middle})`}>
            <g ref={axisGRef} />
            {svgArrows.map(a => (
              <g key={a.arrow.arrowId}>
                <path
                  fill={
                    a.arrow.featureId == highlightedFeature
                      ? highlightedFeatureColour
                      : colourScale(a.arrow.colour)
                  }
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
                  style={{ textAnchor: "middle", fontSize: spacing - padding }}
                  xlinkHref={`#${a.textPathId}`}
                >
                  {a.arrow.name}
                </textPath>
              </text>
            ))}
            <text
              x={width / 2}
              y={-spacing * 2 - padding}
              style={{ textAnchor: "middle" }}
            >
              {name}
            </text>
          </g>
        </svg>
      </div>
    );
  }
);

function drawArrow(
  d: IArrow,
  lineLength: number,
  scale: (x: number) => number,
  [left, right]: number[],
  arrow: CanvasRenderingContext2D | Path,
  text?: CanvasRenderingContext2D | Path
) {
  const r = (d.ring + 1) * spacing + (d.ring + 1) * padding;
  const a = Math.max(scale(d.start), left);
  const b = Math.min(scale(d.end), right);
  const hl = Math.min(lineLength * arrowLength, b - a);
  const hr = r - spacing / 2;
  switch (d.arrowhead) {
    case 0:
      arrow.moveTo(a, r);
      arrow.lineTo(b, r);
      arrow.lineTo(b, r - spacing);
      arrow.lineTo(a, r - spacing);
      if (text) {
        text.moveTo(a, r - textPadding * 2);
        text.lineTo(b, r - textPadding * 2);
      }
      break;
    case -1:
      arrow.moveTo(a, hr);
      arrow.lineTo(a + hl, r);
      arrow.lineTo(b, r);
      arrow.lineTo(b, r - spacing);
      arrow.lineTo(a + hl, r - spacing);
      if (text) {
        text.moveTo(a + hl, r - textPadding * 2);
        text.lineTo(b, r - textPadding * 2);
      }
      break;
    case 1:
      arrow.moveTo(a, r);
      arrow.lineTo(b - hl, r);
      arrow.lineTo(b, hr);
      arrow.lineTo(b - hl, r - spacing);
      arrow.lineTo(a, r - spacing);
      if (text) {
        text.moveTo(a, r - textPadding * 2);
        text.lineTo(b - hl, r - textPadding * 2);
      }
      break;
  }
}
