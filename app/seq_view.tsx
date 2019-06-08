import * as React from "react";
import { appContext } from ".";
import { EditField } from "./edit_field";
import { ListData, ListView } from "./components/list_view";
import PromiseButton from "./components/promise_button";
import { readCachedPromise, readMethodCall } from "./utils/suspense";
import { Tab } from "./tab";
import * as utils from "./utils";
import { Seq, SeqSearchResult } from "./worker_comms/worker_shims";
import {
  Diagram,
  IArrow,
  intersectsInterval,
  colourScale,
  Handle,
  HighlightedRange
} from "./diagram";
import { makeDialog, promptDialog } from "./utils/dialogs";
import { downloadData } from "./utils/io";

type Feature = any; // TODO update


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
  constructor(
    seq: Promise<Seq>,
    private readonly filename?: string,
    private readonly url?: string
  ) {
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
  const diagramRef = React.useRef<Handle>(null);
  const [hoveredFeatureIdx, setHoveredFeatureIdx] = React.useState<
    number | null
  >(null);

  const onFeatureClick = React.useCallback(
    (f: Feature, idx: number) => diagramRef.current.scrollToFeature(idx),
    []
  );

  const onExtractRange = async () => {
    try {
      const visibleRange = diagramRef.current.getVisibleRange();
      const res = await extractRangeDialog(visibleRange.map(v => v + 1));
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
      diagramRef.current.getTwelveOClock().toString()
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
  React.useLayoutEffect(() => {
    const resizeHandler = new utils.ResizeHandler(true);
    resizeHandler.install(
      featuresPaneRef.current as Element,
      null,
      newHeight => { }
    );
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

  const seqSearchSelectRef = React.useRef<HTMLSelectElement>();

  const [seqResults, seqSearch] = utils.useDebouncedQueuedSearch<
    string,
    SeqSearchResult[] | null
  >(query => {
    if (query.length >= 3) {
      return seq.search_seq(query, max_res);
    } else {
      return Promise.resolve(null);
    }
  });

  const [highlightedRange, setHighlightedRange] = React.useState<HighlightedRange>(null);

  const scrollToSeqSearchResult = (idx: number) => {
    if (seqResults && idx < seqResults.length) {
      diagramRef.current.scrollToPosition(seqResults[idx].start);
      setHighlightedRange({start: seqResults[idx].start, end: seqResults[idx].end - 1});
    }
  };

  // select the first match whenever a new search result arrives
  React.useEffect(() => {
    setHighlightedRange(null);
    if (seqResults) {
      seqSearchSelectRef.current.value = "0";
      scrollToSeqSearchResult(0);
    }
  }, [seqResults]);

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
                    downloadData(gb, name + ".gb", "chemical/x-genbank")
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
              <select
                className="seq_search_results mono"
                ref={seqSearchSelectRef}
                size={5}
                onChange={e => scrollToSeqSearchResult(Number(e.target.value))}
                onClick={e => {
                  if (e.target && e.target instanceof HTMLOptionElement) {
                    scrollToSeqSearchResult(Number(e.target.value));
                  }
                }}
              >
                {seqResults.map(({ start, fwd }, idx) => (
                  <option value={idx} key={idx}>
                    {fwd ? ">> " : "<< "}
                    {start}
                  </option>
                ))}
              </select>
            )}
          </li>
          <li>
            {seqResults && (
              <span>
                {seqResults.length === max_res + 1
                  ? `>${max_res}`
                  : seqResults.length}{" "}
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
            onFeatureHover={(f, idx) => { } /*setHoveredFeatureIdx(idx)*/}
            highlightedFeature={hoveredFeatureIdx}
          />
        </div>
        <div className="resizer resizer_horizontal" />
      </div>
      <div className="template_content">
        <Diagram
          ref={diagramRef}
          seq={seq}
          highlightedFeature={hoveredFeatureIdx}
          highlightedRanges={highlightedRange ? [highlightedRange] : null}
          hidden={false}
          showDetails={showDetails}
        />
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
        // idx === highlightedFeature
        //   ? highlightedFeatureColour : 
          getFeatureColour(row, idx),
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
