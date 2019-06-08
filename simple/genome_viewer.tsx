import * as React from "react";
import * as ReactDOM from "react-dom";
import { readFileBinary, downloadData } from "../app/utils/io";
import { setErrorHandler, setLogHandler } from "../app/worker_comms";
import { parse_gb, Seq } from "../app/worker_comms/worker_shims";
import { ForkMe } from "./common";
import { Diagram } from "../app/diagram";
import "hack";
import "./common.css";
import "./genome_viewer.css";
import { readCachedPromise } from "../app/utils/suspense";
import { ErrorBoundary } from "../app/components/error_boundary";

setErrorHandler(alert);
setLogHandler(() => {}); // gets logged to console anyway

function App() {
  const fileRef = React.useRef<HTMLInputElement>();
  const lastSeqPromise = React.useRef<Promise<Seq>>(null);
  const [seqPromise, setSeqPromise] = React.useState<Promise<Seq>>(null);
  const [noCanvas, setNoCanvas] = React.useState<boolean>(false);

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
    }
    e.target.value = "";
  };

  const downloadSvg = () => {
    // this is a hack and might not work in future React versions ;)
    // we are assuming that the callback won't be called until the SVG
    // has been re-rendered
    if (!noCanvas) setNoCanvas(true);
    setTimeout(() => {
      const el = document.querySelector(".diagram svg");
      const svg = `<?xml version="1.0" encoding="UTF-8" ?>
                    <svg 
                      version="1.1" 
                      baseProfile="full" 
                      width="${el.getBoundingClientRect().width}"
                      height="${el.getBoundingClientRect().height}"
                      xmlns="http://www.w3.org/2000/svg"
                      xmlns:xlink="http://www.w3.org/1999/xlink">
                        ${el.innerHTML}
                      </svg>`;
      const te = new TextEncoder();
      const ab = te.encode(svg).buffer;
      downloadData(ab, "diagram.svg", "image/svg+xml");
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
            className="btn btn-default"
            onClick={() => fileRef.current.click()}
          >
            Load template from file
          </button>
        </p>
        <p>
          <label htmlFor="no_canvas">SVG only (slower)</label>
          <input
            type="checkbox"
            name="no_canvas"
            checked={noCanvas}
            id="no_canvas"
            onChange={e => setNoCanvas(e.target.checked)}
          />
        </p>
        <p>
          <button className="btn btn-default" onClick={downloadSvg}>
            Download SVG
          </button>
        </p>
      </div>
      {seqPromise && <Viewer seqPromise={seqPromise} noCanvas={noCanvas} />}
    </>
  );
}

interface Props {
  seqPromise: Promise<Seq>;
  noCanvas: boolean;
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

const DiagramDiv = ({ seqPromise, noCanvas }: Props) => {
  const seq = readCachedPromise(seqPromise);
  return (
    <>
      <Diagram
        seq={seq}
        hidden={false}
        showDetails={false}
        noCanvas={noCanvas}
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
