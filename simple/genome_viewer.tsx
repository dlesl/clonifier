import * as React from "react";
import * as ReactDOM from "react-dom";
import {
  readFileBinary,
  downloadData,
  fetchBinary,
  fetchText
} from "../app/utils/io";
import { setErrorHandler, setLogHandler } from "../app/worker_comms";
import { parse_gb, Seq, parse_bin } from "../app/worker_comms/worker_shims";
import { ForkMe } from "./common";
import { Diagram } from "../app/diagram";
import "hack";
import "./common.css";
import "./genome_viewer.css";
import { readCachedPromise, readMethodCall } from "../app/utils/suspense";
import { ErrorBoundary } from "../app/components/error_boundary";
import { standardTemplates } from "../templates";

setErrorHandler(alert);
setLogHandler(() => {}); // gets logged to console anyway

function App() {
  const fileRef = React.useRef<HTMLInputElement>();
  const lastSeqPromise = React.useRef<Promise<Seq>>(null);
  const [seqPromise, setSeqPromise] = React.useState<Promise<Seq>>(null);
  const [noCanvas, setNoCanvas] = React.useState<boolean>(false);
  const [geneKey, setGeneKey] = React.useState("locus_tag");
  const [colourData, setColourData] = React.useState("");
  const [matchesOnly, setMatchesOnly] = React.useState<boolean>(false);

  const freeSeq = () => {
    if (seqPromise) {
      setTimeout(async () => {
        (await seqPromise).free();
      }, 0);
    }
  };

  const onLoadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files.length === 1) {
      const f = e.target.files[0];
      const newSeqPromise = (async () => {
        try {
          const data = await readFileBinary(f);
          const seqs = await parse_gb(data);
          if (seqs.length >= 1) return seqs[0];
          else throw new Error(`File: '${f.name}' contains no sequences`);
        } catch (e) {
          alert(e.toString());
          setSeqPromise(null);
        }
      })();
      setSeqPromise(newSeqPromise);
      freeSeq();
    }
    e.target.value = "";
  };

  const onLoadExample = (basename: string) => {
    const newSeqPromise = (async () => {
      try {
        const data = await fetchBinary(`${basename}.bin`);
        return await parse_bin(data);
      } catch (e) {
        alert(e.toString());
        setSeqPromise(null);
      }
    })();
    setSeqPromise(newSeqPromise);
    freeSeq();
  };

  const loadSampleExprData = async e => {
    e.preventDefault();
    onLoadExample("na1000");
    const text = await fetchText("schramm_data.txt");
    setColourData(text);
    setGeneKey("locus_tag");
  };

  const downloadSvg = () => {
    // this is a hack and might not work in future React versions ;)
    // we are assuming that the callback won't be called until the SVG
    // has been re-rendered
    if (!noCanvas) setNoCanvas(true);
    setTimeout(() => {
      let el = document.querySelector(".diagram svg");
      const { width, height } = el.getBoundingClientRect();
      // some standalone SVG viewers don't support rgba colours, the spec says
      // we need to use `fill-opacity` instead.
      el = el.cloneNode(true) as Element;
      for (const child of el.getElementsByTagName("*")) {
        const fill = child.getAttribute("fill");
        if (fill) {
          const match = fill.match(/^rgba\((.+),\s?([0-9\.]+)\)/);
          if (match) {
            child.setAttribute("fill", `rgb(${match[1]})`);
            child.setAttribute("fill-opacity", match[2]);
          }
        }
      }
      const svg = `<?xml version="1.0" encoding="UTF-8" ?>
                    <svg 
                      version="1.1" 
                      baseProfile="full" 
                      width="${width}"
                      height="${height}"
                      xmlns="http://www.w3.org/2000/svg"
                      xmlns:xlink="http://www.w3.org/1999/xlink">
                        ${el.innerHTML}
                    </svg>`;
      const te = new TextEncoder();
      const ab = te.encode(svg).buffer;
      downloadData(ab, "diagram.svg", "image/svg+xml");
      if (!noCanvas) setNoCanvas(false); // restore setting
    }, 0);
  };

  return (
    <>
      <ForkMe />
      <div className="left">
        <h1 className="title">Genome Viewer</h1>
        <input
          type="file"
          ref={fileRef}
          onChange={onLoadFile}
          multiple={false}
          style={{ opacity: 0, width: 0, height: 0, overflow: "hidden" }}
        />
        <p>
          <button
            className="btn btn-default btn-block btn-primary"
            onClick={() => fileRef.current.click()}
          >
            Load template from file
          </button>
          <p>Supported formats: Genbank (.gb, .ape)</p>
        </p>
        <select
          onChange={e => {
            if (e.target.value !== "default") {
              onLoadExample(e.target.value);
              e.target.value = "default";
            }
          }}
        >
          <option value="default">Load an example template...</option>
          {standardTemplates.map(({ name, basename }) => (
            <option key={basename} value={basename}>
              {name}
            </option>
          ))}
        </select>
        <p />
        <div className="card">
          <header className="card-header">Display settings</header>
          <input
            type="checkbox"
            name="no_canvas"
            checked={noCanvas}
            id="no_canvas"
            onChange={e => setNoCanvas(e.target.checked)}
          />
          <label htmlFor="no_canvas"> SVG only (slower)</label>
        </div>
        <br />
        <p>
          <button
            className={
              "btn btn-default btn-block" + (seqPromise ? " btn-primary" : "")
            }
            disabled={!seqPromise}
            onClick={downloadSvg}
          >
            Download SVG
          </button>
        </p>
        <div className="card">
          <header className="card-header">Custom colours</header>
          <p>
            Apply custom colours to genes, for example to visualise expression
            data
          </p>
          <fieldset className="form-group">
            <label htmlFor="key" className="form-control">
              Key to select:
            </label>
            <input
              className="form-control"
              value={geneKey}
              id="key"
              onChange={e => setGeneKey(e.target.value)}
            />
          </fieldset>
          <fieldset className="form-group form-textarea">
            <label htmlFor="data">Data:</label>
            <textarea
              id="data"
              rows={5}
              className="form-control"
              value={colourData}
              onChange={e => setColourData(e.target.value)}
            />
          </fieldset>
          Data format:
          <br />
          <code>key colour</code>
          <br />
          Colour format:
          <br />
          <code>#rrggbb</code> or <code>rgb(rrr, ggg, bbb)</code>
          <br />
          <input
            type="checkbox"
            checked={matchesOnly}
            id="matches_only"
            onChange={e => setMatchesOnly(e.target.checked)}
          />
          <label htmlFor="matches_only"> Show matching features only</label>
          <p>
            <a href="#" onClick={loadSampleExprData}>
              Load sample expression data
            </a>
          </p>
        </div>
      </div>
      {seqPromise && (
        <Viewer
          {...{ seqPromise, geneKey, colourData, noCanvas, matchesOnly }}
        />
      )}
    </>
  );
}

interface Props {
  seqPromise: Promise<Seq>;
  noCanvas: boolean;
  colourData: string;
  geneKey: string;
  matchesOnly: boolean;
}

const Viewer = (props: Props) => {
  return (
    <div className="viewer">
      <ErrorBoundary>
        <React.Suspense fallback={<Message text="Loading..." />}>
          <DiagramDiv {...props} />
        </React.Suspense>
      </ErrorBoundary>
    </div>
  );
};

const DiagramDiv = ({
  seqPromise,
  noCanvas,
  colourData,
  geneKey,
  matchesOnly
}: Props) => {
  const seq = readCachedPromise(seqPromise);
  const colourMap = new Map<number, string>();
  if (colourData.length > 0) {
    const vals = readMethodCall(seq, seq.get_feature_qualifier, geneKey);
    const valIdMap = new Map<string, number>();
    vals.forEach((v, idx) => valIdMap.set(v, idx));
    for (const l of colourData.split("\n")) {
      const split = l.match(/([^\s]+)\s+(.+)/);
      if (split) {
        const key = split[1].trim();
        const idx = valIdMap.get(key);
        if (idx !== undefined) {
          colourMap.set(idx, split[2].trim());
        }
      }
    }
  }

  const filter =
    matchesOnly && colourMap.size ? [...colourMap.keys()] : undefined;

  return (
    <>
      <Diagram
        seq={seq}
        hidden={false}
        showDetails={false}
        noCanvas={noCanvas}
        overrideFeatureColour={colourMap.size ? colourMap : undefined}
        defaultColour="grey"
        filterFeatures={filter}
      />
    </>
  );
};

const Message = ({ text }: { text: string }) => {
  return (
    <div className="message_container">
      <h2>{text}</h2>
    </div>
  );
};

const root = document.getElementById("root");
ReactDOM.render(<App />, root);
