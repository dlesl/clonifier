import * as React from "react";
import { FixedSizeList } from "react-window";
import { appContext } from ".";
import { EditField } from "./edit_field";
import { ListData, ListView } from "./components/list_view";
import PromiseButton from "./components/promise_button";
import { readCachedPromise, readMethodCall } from "./utils/suspense";
import { Tab } from "./tab";
import * as utils from "./utils";
import { Seq } from "./worker_comms/worker_shims";
import { Diagram, IArrow, intersectsInterval, colourScale } from "./diagram";
import { makeDialog, promptDialog } from "./utils/dialogs";

type Feature = any; // TODO update

export const highlightedFeatureColour = "yellow";

const TOO_MANY = Symbol();

function Button({
  data,
  fallbackName
}: {
  data: Promise<Seq>;
  fallbackName: string;
}) {
  const name = readMethodCall(
    readCachedPromise(data),
    Seq.prototype.get_metadata
  ).name;
  return <>{name || fallbackName || "Untitled"}</>;
}

export default class SeqTab extends Tab {
  private readonly data: Promise<Seq>;
  /// set `url` if you want this sequence to be linkable, i.e. if it can be fetched from a url
  constructor(seq: Promise<Seq>, private readonly filename?: string, private readonly url?: string) {
    super();
    this.data = seq;
  }
  get symbol() {
    return "🧬";
  }
  public renderSelf() {
    return (
      <SeqView
        data={this.data}
        onUpdate={newSeq => this.update(new SeqTab(newSeq))}
      />
    );
  }
  public renderButton() {
    return (
      <React.Suspense fallback={<>Loading...</>}>
        <Button data={this.data} fallbackName={this.filename} />
      </React.Suspense>
    );
  }
  get seq() {
    return this.data;
  }
  public async free() {
    (await this.seq).free();
  }
  get hash(): string | null {
    return this.url || null;
  }
}

interface Props {
  onUpdate: (newSeq: Promise<Seq>) => void;
  data: Promise<Seq>;
}

function SeqView({ data, onUpdate }: Props) {
  const seq = readCachedPromise(data);
  const { name, len, circular } = readMethodCall(seq, seq.get_metadata);
  const [showDetails, setShowDetails] = React.useState(false);
  const diagramRef = React.useRef(null);
  const seqRef = React.useRef(null);
  const [hoveredFeatureIdx, setHoveredFeatureIdx] = React.useState<
    number | null
  >(null);

  const onFeatureClick = React.useCallback(
    (f: Feature, idx: number) =>
      showDetails
        ? seqRef.current.scrollToFeature(f)
        : diagramRef.current.zoomTo(idx),
    [showDetails]
  );

  const onExtractRange = async () => {
    try {
      const visibleInterval = diagramRef.current.limits;
      const res = await extractRangeDialog(visibleInterval.map(v => v + 1));
      if (res !== null) {
        const [from, to] = res;
        if (
          from === 0 ||
          to === 0 ||
          (!circular && (from < 1 || to > len || from > to))
        ) {
          throw new Error("Invalid range!");
        }
        const extractedLen = to >= from ? to - from + 1 : to - from + len + 1;
        if (extractedLen > len) {
          throw new Error(
            "Extracted range may not loop around more than once (ie. overlap itself)"
          );
        }
        const extractedName = `${name}_${from}-${to}`;
        const extracted = seq.extract_range(from - 1, to, extractedName);
        appContext.addTab(new SeqTab(extracted, extractedName));
        return extracted;
      }
    } catch (e) {
      alert(e.toString());
    }
  };

  const onSetOrigin = async () => {
    const input = await promptDialog(
      "New origin",
      diagramRef.current.twelveOClock.toString()
    );
    if (input === null) return;
    const origin = parseInt(input, 10);
    if (origin <= 0 || origin > len) {
      alert(`Origin must be between 1 and ${len}`);
      return;
    }
    const newSeq = seq.set_origin(origin - 1);
    appContext.addTab(new SeqTab(newSeq));
    return newSeq;
  };

  const featuresPaneRef = React.useRef(null);
  React.useEffect(() => {
    const resizeHandler = new utils.ResizeHandler(true);
    resizeHandler.install(featuresPaneRef.current as Element, newHeight => {});
    return () => resizeHandler.uninstall();
  }, []);

  interface FeatureQuery {
    query: string;
    caseSensitive: boolean;
    includeKeys: boolean;
  }

  const [featureQuery, setFeatureQuery] = React.useState<FeatureQuery>({
    query: "",
    caseSensitive: false,
    includeKeys: false
  });

  const [filter, featureSearch] = utils.useDebouncedQueuedSearch<
    FeatureQuery,
    Set<number> | null
  >(async ({ query, caseSensitive, includeKeys }) => {
    if (query.length >= 1) {
      const res = await seq.search_features(query, !caseSensitive, includeKeys);
      return new Set(res);
    } else {
      return Promise.resolve(null);
    }
  });

  const doFeatureSearch = (query: FeatureQuery) => {
    setFeatureQuery(query);
    featureSearch(query);
  };

  const max_res = 1000;

  const [seqResults, seqSearch] = utils.useDebouncedQueuedSearch<
    string,
    Uint32Array | null | typeof TOO_MANY
  >(async query => {
    if (query.length >= 3) {
      const res = await seq.search_seq(query, max_res + 1);
      return res && res.length < max_res + 1 ? res : TOO_MANY;
    } else {
      return Promise.resolve(null);
    }
  });

  return (
    <div className="template">
      <div className="template_left recessed_light">
        <ul>
          <li>
            <label>Name</label>
            <EditField
              initialValue={name}
              onSave={newName => {
                const error = utils.noWhiteSpace(newName);
                if (error) {
                  return error;
                }
                onUpdate(seq.set_name(newName));
              }}
            />
          </li>
          <li>
            <label>Length</label>
            <p>{len} bp</p>
          </li>
          <li>
            <label>Circular</label>
            <input
              type="checkbox"
              checked={circular}
              onChange={() => {
                const newSeq = seq.set_circular(!circular);
                onUpdate(newSeq);
              }}
            />
          </li>
          <hr />
          <li>
            <PromiseButton
              onClick={() =>
                seq
                  .to_gb()
                  .then(gb =>
                    utils.downloadData(gb, name + ".gb", "chemical/x-genbank")
                  )
              }
            >
              Download
            </PromiseButton>
          </li>
          <li>
            <PromiseButton onClick={() => appContext.saveFragment(seq)}>
              Save as Fragment
            </PromiseButton>
          </li>
          <li>
            <PromiseButton
              onClick={() => {
                const rc = seq.revcomp();
                appContext.addTab(new SeqTab(rc));
                return rc;
              }}
            >
              Reverse Complement
            </PromiseButton>
          </li>
          <li>
            <PromiseButton onClick={onExtractRange}>
              Extract Range
            </PromiseButton>
          </li>
          <li>
            <PromiseButton onClick={onSetOrigin} disabled={!circular}>
              Set Origin
            </PromiseButton>
          </li>
          <li>
            <label>View:</label>
            <label>
              <input
                type="radio"
                checked={!showDetails}
                onChange={() => setShowDetails(false)}
              />
              Graphical
            </label>
            <label>
              <input
                type="radio"
                checked={!!showDetails}
                onChange={() => setShowDetails(true)}
              />
              Details
            </label>
          </li>
          <hr />
          <li>
            <label>Feature search: </label>
            <input
              className="recessed_light"
              onChange={e =>
                doFeatureSearch({ ...featureQuery, query: e.target.value })
              }
            />
          </li>
          <li>
            <label>Case sensitive: </label>
            <input
              type="checkbox"
              checked={featureQuery.caseSensitive}
              onChange={e =>
                doFeatureSearch({
                  ...featureQuery,
                  caseSensitive: e.target.checked
                })
              }
            />
          </li>
          <li>
            <label>Include keys: </label>
            <input
              type="checkbox"
              checked={featureQuery.includeKeys}
              onChange={e =>
                doFeatureSearch({
                  ...featureQuery,
                  includeKeys: e.target.checked
                })
              }
            />
          </li>
          <li>{filter && <span>{filter.size} results</span>}</li>
          <hr />
          <li>
            <label>Sequence search: </label>
            <input
              className="recessed_light"
              onChange={e => seqSearch(e.target.value.replace(/\s/g, ""))}
            />
          </li>
          <li>
            {seqResults && (
              <span>
                {seqResults == TOO_MANY ? `>${max_res}` : seqResults.length}{" "}
                matches
              </span>
            )}
          </li>
        </ul>
      </div>
      <div
        className="features_pane"
        onMouseLeave={() => setHoveredFeatureIdx(null)}
        ref={featuresPaneRef}
      >
        <div className="features_list">
          <Features
            seq={seq}
            filter={filter}
            onFeatureClick={onFeatureClick}
            onFeatureHover={(f, idx) => {} /*setHoveredFeatureIdx(idx)*/}
            highlightedFeature={hoveredFeatureIdx}
          />
        </div>
        <div className="resizer resizer_horizontal" />
      </div>
      <div className="template_content">
        {!showDetails && (
          <Diagram
            ref={diagramRef}
            seq={seq}
            highlightedFeature={hoveredFeatureIdx}
            hidden={false}
            // setVisibleInterval={(left, right) =>
            //   setVisibleInterval(state =>
            //     state[0] === left && state[1] === right ? state : [left, right]
            //   )
            // }
          />
        )}
        {showDetails && (
          <Sequence
            seq={seq}
            ref={seqRef}
            highlightedFeature={hoveredFeatureIdx}
          />
        )}
      </div>
    </div>
  );
}

interface IFeatureProps {
  seq: Seq;
  filter: Set<number>;
  highlightedFeature: number;
  onFeatureHover: (f: Feature, idx: number) => void;
  onFeatureClick: (f: Feature, idx: number) => void;
}

const Features = React.memo(
  ({
    seq,
    filter,
    onFeatureHover,
    onFeatureClick,
    highlightedFeature
  }: IFeatureProps) => {
    const [features, setFeatures] = React.useState(
      () => new ListData(readMethodCall(seq, seq.get_features))
    );
    const dd: IArrow[] = readMethodCall(seq, seq.get_diagram_data);
    const getFeatureColour = React.useMemo(() => {
      const lookup = new Array(features.rows.length);
      for (const a of dd) {
        lookup[a.featureId] = a.colour;
      }
      return (row, idx) =>
        lookup[idx] !== undefined ? colourScale(lookup[idx]) : "";
    }, [dd, features.rows]);

    const getBackgroundColour = React.useCallback(
      (row, idx) =>
        idx === highlightedFeature
          ? highlightedFeatureColour
          : getFeatureColour(row, idx),
      [getFeatureColour, highlightedFeature]
    );

    const columns = [
      {
        getter: r => (r.fwd ? ">>>" : "<<<"),
        name: "Strand",
        sort: (a: string, b: string) => a.charCodeAt(0) - b.charCodeAt(0)
      },
      { getter: r => r.name, name: "Name", sort: utils.fastCompare },
      { getter: r => r.kind, name: "Type", sort: utils.fastCompare },
      {
        getter: r => r.start + 1,
        name: "Start",
        sort: (a: number, b: number) => a - b
      },
      {
        getter: r => r.end + 1,
        name: "End",
        sort: (a: number, b: number) => a - b
      }
    ];

    return (
      <ListView
        columns={columns}
        data={features}
        checkboxes={false}
        onUpdate={setFeatures}
        getBackgroundColour={getBackgroundColour}
        onRowClicked={onFeatureClick}
        onMouseOver={onFeatureHover}
        filter={filter}
      />
    );
  }
);

const Sequence = React.memo(
  React.forwardRef(
    (
      { seq, highlightedFeature }: { seq: Seq; highlightedFeature: number },
      ref
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
      React.useImperativeHandle(ref, () => ({
        scrollToFeature: f => {
          const start = f.start;
          const line = Math.floor(start / lineLen);
          seqListRef.current.scrollToItem(line, "center");
        }
      }));
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
                x2={Math.min(a.end + 1, end) - start}
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

function extractRangeDialog([defaultFrom, defaultTo]: number[]): Promise<
  number[] | null
> {
  const template = document.querySelector("#extract_range_template");
  const dialog = makeDialog(template);
  const form = dialog.querySelector("form");
  form.elements["from"].value = defaultFrom;
  form.elements["to"].value = defaultTo;
  const res = new Promise((resolve, reject) => {
    dialog.addEventListener("close", e => {
      if (dialog.returnValue === "ok") {
        const from = parseInt(form.elements["from"].value, 10);
        const to = parseInt(form.elements["to"].value, 10);
        if (isNaN(from + to)) {
          reject(new Error("not a valid integer"));
        } else {
          resolve([from, to]);
        }
      } else {
        resolve(null); // null means cancelled;
      }
    });
  }).finally(() => {
    dialog.remove();
  }) as any;
  dialog.showModal();
  return res;
}
