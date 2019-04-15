import * as React from "react";
import * as d3 from "d3";
import { readMethodCall } from "../utils/suspense";
import { Seq } from "../worker_comms/worker_shims";
import LinearDiagram from "./linear";
import CircularDiagram from "./circular";

export interface CommonProps {
  hidden: boolean;
  highlightedFeature: number;
}

export type Props = CommonProps & {
  seq: Seq;
};

export type DiagramProps = CommonProps & {
  name: string;
  len: number;
  data: IArrow[];
  hidden: boolean;
  highlightedFeature: number;
};

export const Diagram = React.memo(
  React.forwardRef((props: Props, ref) => {
    const { seq, ...restProps } = props;
    const { name, len, circular } = readMethodCall(seq, seq.get_metadata);
    const data = readMethodCall(seq, seq.get_diagram_data);
    const DiagramType = circular ? CircularDiagram : LinearDiagram;
    const diagramProps = {
      name,
      len,
      data,
      ...restProps
    };
    return <DiagramType ref={ref} {...diagramProps} />;
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
