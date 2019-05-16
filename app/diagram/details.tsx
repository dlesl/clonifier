import * as React from "react";
import { FixedSizeList } from "react-window";
import { Seq } from "../worker_comms/worker_shims";
import { readMethodCall } from "../utils/suspense";
import * as utils from "../utils";
import { IArrow, intersectsInterval, colourScale, DiagramHandle } from ".";
import { highlightedFeatureColour } from "../seq_view";

export const DetailsDiagram = React.memo(
  React.forwardRef(
    (
      { seq, highlightedFeature }: { seq: Seq; highlightedFeature: number },
      ref: React.Ref<DiagramHandle>
    ) => {
      const { len } = readMethodCall(seq, seq.get_metadata);
      const seqDiv = React.useRef<HTMLDivElement>(null);
      const [seqWidth, seqHeight] = utils.useElementSize(seqDiv);
      const [monoWidth, monoHeight] = utils.getMonoCharDimensions();
      const seqListRef = React.useRef(null);
      const lineNumDigits = len.toString().length;
      const lineWidth = seqWidth - (lineNumDigits + 4) * monoWidth;
      const lineLen = Math.max(10, Math.floor(lineWidth / monoWidth / 10) * 10);
      const nLines = Math.ceil(len / lineLen);
      const visibleRange = React.useRef<number[]>([0, len]);
      const twelveOClock = React.useRef(0);
      React.useImperativeHandle(ref, () => ({
        scrollTo: (start: number, end: number) => {
          const line = Math.floor(start / lineLen);
          seqListRef.current.scrollToItem(line, "center");
        },
        getVisibleRange: () => visibleRange.current,
        getTwelveOClock: () => twelveOClock.current
      }));
      const onItemsRendered = ({ visibleStartIndex, visibleStopIndex }) => {
        visibleRange.current = [
          visibleStartIndex * lineLen,
          Math.min(len, visibleStopIndex * lineLen + lineLen)
        ];
        twelveOClock.current = Math.floor(
          (visibleStartIndex + (visibleStopIndex - visibleStartIndex) / 2) *
            lineLen +
            lineLen / 2
        );
      };
      return (
        <div className="sequence_pane" ref={seqDiv}>
          <FixedSizeList
            ref={seqListRef}
            width={seqWidth}
            height={seqHeight}
            overScanCount={10} // TODO: cache the seq data instead?
            itemCount={nLines}
            itemSize={monoHeight + 2 + 10}
            itemData={{ seq, len, lineLen, lineNumDigits, highlightedFeature }}
            onItemsRendered={onItemsRendered}
          >
            {SeqLineSuspender}
          </FixedSizeList>
        </div>
      );
    }
  )
);
function SeqLineSuspender(props) {
  return (
    <React.Suspense fallback={""}>
      <SeqLine {...props} />
    </React.Suspense>
  );
}
function SeqLine({
  data: { seq, len, lineLen, lineNumDigits, highlightedFeature },
  index,
  style
}) {
  // const { data, error, isLoading } = utils.useAsync(() =>
  //   seq.get_seq_slice(index * LINELEN, Math.min((index + 1) * LINELEN, len))
  // );
  const dd: IArrow[] = readMethodCall(seq, seq.get_diagram_data);
  const [monoWidth, monoHeight] = utils.getMonoCharDimensions();
  const start = index * lineLen;
  const end = Math.min((index + 1) * lineLen, len);
  const thisLineLen = end - start;
  const data = (readMethodCall(seq, seq.get_seq_slice, 0, len) as string).slice(
    start,
    end
  ); // TODO: chunks?
  const overlaps = dd.filter(a =>
    intersectsInterval(a.start, a.end, start, end)
  );
  const highlights = overlaps.filter(a => a.featureId === highlightedFeature);
  highlights.sort((a, b) => a.start - b.start);
  const maxRing = React.useMemo(() => Math.max(...dd.map(a => a.ring)) + 1, [
    dd
  ]);
  return (
    <div className="seq_line" style={style}>
      <span className="line_number">
        {(index * lineLen + 1)
          .toString()
          .padStart(lineNumDigits, " " /* &nbsp; */)}
      </span>
      <div>
        {highlights.length > 0 && (
          <div className="highlights">
            {highlights.map((a, idx) => (
              <React.Fragment key={idx}>
                <span>
                  {" " /*&nbsp;*/
                    .repeat(
                      Math.max(
                        0,
                        idx === 0
                          ? a.start - start
                          : a.start - highlights[idx - 1].end - 1
                      )
                    )}
                </span>
                <span style={{ background: highlightedFeatureColour }}>
                  {" " /*&nbsp;*/
                    .repeat(
                      Math.min(a.end + 1, end) - Math.max(a.start, start)
                    )}
                </span>
              </React.Fragment>
            ))}
          </div>
        )}
        <span>{data}</span>
        <svg
          viewBox={`0 0 ${thisLineLen} ${maxRing * 10}`}
          width={`${thisLineLen}px`}
          height="10px"
          strokeWidth="10px"
          preserveAspectRatio="none"
        >
          {overlaps.map((a, idx) => {
            const y = a.ring * 10 + 5;
            const colour = colourScale(a.colour);
            return (
              <line
                key={idx}
                x1={Math.max(a.start, start) - start}
                x2={Math.min(a.end, end) - start}
                y1={y}
                y2={y}
                stroke={colour}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}
