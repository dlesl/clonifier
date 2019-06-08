import * as React from "react";
import * as d3 from "d3";
import { readMethodCall } from "../utils/suspense";
import { Seq } from "../worker_comms/worker_shims";
import LinearDiagram from "./linear";
import CircularDiagram from "./circular";
import { DetailsDiagram } from "./details";

export const highlightedFeatureColour = "yellow";

export interface HighlightedRange {
  start: number;
  end: number;
}

/** "base" props */
export interface CommonProps {
  hidden: boolean;
  highlightedFeature?: number;
  highlightedRanges?: HighlightedRange[];
  noCanvas?: boolean;
  seq: Seq;
}

/** extra props we are given */
export type Props = CommonProps & {
  showDetails: boolean;
};

/** extra props a "Diagram" receives */
export type DiagramProps = CommonProps & {
  name: string;
  len: number;
  data: IArrow[];
};

/** The handle we receive */
export interface Handle {
  scrollToFeature: (featureIdx: number) => void;
  scrollToPosition: (pos: number) => void;
  getVisibleRange: () => number[];
  /** `null` if not circular */
  getTwelveOClock: () => number | null;
}

/** The handle we pass on */
export interface DiagramHandle {
  scrollTo: (start: number, end: number) => void;
  getVisibleRange: () => number[];
  /** `null` if not circular */
  getTwelveOClock: () => number | null;
}

/** This Component renders the appropriate diagram based on
 *  `Props.showDetails` and whether the sequence is circular.
 *  It does this by rendering the appropriate component, which
 *  receives `DiagramProps` and must also implement the imperative
 *  interface defined by `DiagramHandle`
 */
export const Diagram = React.memo(
  React.forwardRef((props: Props, ref: React.Ref<Handle>) => {
    const { seq, showDetails } = props;
    const { name, len, circular } = readMethodCall(seq, seq.get_metadata);
    const data = readMethodCall(seq, seq.get_diagram_data);
    let DiagramType: any;
    if (showDetails) {
      DiagramType = DetailsDiagram;
    } else {
      DiagramType = circular ? CircularDiagram : LinearDiagram;
    }
    const diagramProps = {
      ...props,
      name,
      len,
      data
    };
    const subRef = React.useRef<DiagramHandle>();
    React.useImperativeHandle(ref, () => ({
      scrollToFeature: (featureIdx: number) => {
        const arrows = data.filter(a => a.featureId === featureIdx);
        const fStart = Math.min(...arrows.map(a => a.start));
        const fEnd = Math.max(...arrows.map(a => a.end));
        subRef.current.scrollTo(fStart, fEnd);
      },
      scrollToPosition: (pos: number) => {
        subRef.current.scrollTo(pos, pos + 1);
      },
      getVisibleRange: () => subRef.current.getVisibleRange(),
      getTwelveOClock: () => subRef.current.getTwelveOClock()
    }));
    return <DiagramType ref={subRef} {...diagramProps} />;
  })
);

export interface IArrow {
  featureId: number;
  start: number;
  end: number;
  ring: number;
  name: string;
  colour: number;
  arrowhead: number;
  arrowId: number;
}

export const maxSvgElements = 200; // for performance
export const padding = 7;
export const textPadding = 1;
export const spacing = 15;
export const arrowLength = 0.005;
// borrowed this from somewhere
export const colourScale = d3
  .scaleLinear()
  .domain([1, 3.5, 6])
  .range([
    // @ts-ignore
    "rgba(44, 123, 182, 0.7)",
    // @ts-ignore
    "rgba(255, 255, 191, 0.7)",
    // @ts-ignore
    "rgba(215, 25, 28, 0.7)"
  ])
  .interpolate(d3.interpolateHcl);

let nextDivId = 0;
export const newDivId = () => nextDivId++;
export const intersectsInterval = (
  start: number,
  end: number,
  low: number,
  high: number
) => !((start < low && end < low) || (start > high && end > high));
