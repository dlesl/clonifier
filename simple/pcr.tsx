import * as React from "react";
import * as ReactDOM from "react-dom";
import { readFileText, downloadData } from "../app/utils/io";
import { setErrorHandler, setLogHandler } from "../app/worker_comms";
import {
  parse_gb,
  Seq,
  newPcrer,
  PcrResults,
  JsProduct,
  JsMatch,
  parse_fasta
} from "../app/worker_comms/worker_shims";
import { useIntFromInputLS } from "./common";
import "hack";
import "./common.css";

setErrorHandler(alert);
setLogHandler(() => {}); // gets logged to console anyway

const MINFP_MIN = 5;
const MINFP_MAX = 63;
const MINLEN_MIN = 0;
const MINLEN_MAX = Infinity;
const MAXLEN_MIN = 0;
const MAXLEN_MAX = Infinity;

function App() {
  const templateRef = React.useRef<HTMLTextAreaElement>();
  const fileRef = React.useRef<HTMLInputElement>();
  const [primersText, _setPrimersText] = React.useState<string>(
    () => window.localStorage["primers"] || ""
  );
  const setPrimersText = (text: string) => {
    window.localStorage["primers"] = text;
    _setPrimersText(text);
  };
  const [minFp, setMinFp] = useIntFromInputLS(
    14,
    MINFP_MIN,
    MINFP_MAX,
    "pcr_minfp"
  );
  const [minLen, setMinLen] = useIntFromInputLS(
    50,
    MINLEN_MIN,
    MINLEN_MAX,
    "pcr_minlen"
  );
  const [maxLen, setMaxLen] = useIntFromInputLS(
    10000,
    MAXLEN_MIN,
    MAXLEN_MAX,
    "pcr_maxlen"
  );

  const result = React.useRef<PcrResults>(null);
  const [running, setRunning] = React.useState(false);
  const [products, setProducts] = React.useState<JsProduct[]>(null);
  const [matches, setMatches] = React.useState<JsMatch[]>(null);
  const cachedSeq = React.useRef<Seq>(null);
  const freeCachedSeq = () => {
    if (cachedSeq.current) cachedSeq.current.free();
    cachedSeq.current = null;
  };
  const onLoadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files.length === 1) {
      freeCachedSeq();
      readFileText(e.target.files[0]).then(
        seq => (templateRef.current.value = seq)
      );
      e.target.value = "";
    }
  };
  const parseSeq = async () => {
    if (cachedSeq.current) return cachedSeq.current;
    const templateText = templateRef.current.value;
    const enc = new TextEncoder();
    let seqs: Seq[];
    const ab = () => enc.encode(templateText).buffer;
    seqs = await parse_fasta(ab()).catch(e =>
      parse_gb(ab()).catch(e0 => {
        throw new Error(
          `Failed parsing as FASTA: ${e.toString()}
          Failed parsing as Genbank: ${e0.toString()}`
        );
      })
    );
    if (seqs.length > 1) {
      alert("File contains multiple sequences, using only first sequence");
    } else if (seqs.length === 0) {
      throw new Error("Sequence empty!");
    }
    cachedSeq.current = seqs[0];
    return seqs[0];
  };
  const pcr = async () => {
    setRunning(true);
    if (result.current) {
      result.current.free();
      result.current = null;
      setProducts(null);
      setMatches(null);
    }
    let seq;
    try {
      seq = await parseSeq();
    } catch (e) {
      alert(e.message);
      setRunning(false);
      return;
    }
    const settings = {
      minFp,
      minLen,
      maxLen
    };
    const primers = primersText.split("\n").map((p, idx) => {
      const split = p.split(/\s+/).filter(s => s.length > 0);
      if (split.length > 1) {
        return { name: split[0].trim(), seq: split[1].trim(), desc: "" };
      }
      return {
        name: (idx + 1).toString(),
        seq: p.trim(),
        desc: ""
      };
    });
    const pcrer = await newPcrer(seq, primers, settings);
    const res = await pcrer.get_result();
    pcrer.free();
    result.current = res;
    const prods = await res.get_products();
    setProducts(prods);
    const matches = await res.get_matches();
    setMatches(matches);
    setRunning(false);
  };
  const extractProduct = async (idx: number) => {
    const product = await result.current.extract_product(idx);
    const data = await product.to_gb();
    product.free();
    downloadData(data, `product_${idx}.gb`, "text/plain");
  };
  return (
    <>
      <section>
        <div className="container">
          <h1 className="title">
            <i>In silico</i> PCR
          </h1>
          <label>
            Template (Genbank or FASTA format)
            <textarea
              ref={templateRef}
              style={{ height: "20em" }}
              onChange={freeCachedSeq}
            />
          </label>
          <input
            type="file"
            ref={fileRef}
            onChange={onLoadFile}
            multiple={false}
            style={{ opacity: 0, width: 0, height: 0, overflow: "hidden" }}
          />
          <button
            className="btn btn-default"
            onClick={() => fileRef.current.click()}
          >
            Load template from file
          </button>
          <p />
          <label>
            Primers, one per line (if two columns are provided, the first will
            be used as names)
            <textarea
              value={primersText}
              onChange={e => setPrimersText(e.target.value)}
            />
          </label>
          <h2>Settings</h2>
          <fieldset className="form-group">
            <label htmlFor="minfp">Min 3' homology</label>
            <input
              id="minfp"
              type="number"
              defaultValue={"" + minFp}
              min={MINFP_MIN}
              max={MINFP_MAX}
              onChange={setMinFp}
              className="form-control"
            />
          </fieldset>
          <fieldset className="form-group">
            <label htmlFor="minlen">Min Length</label>
            <input
              id="minlen"
              type="number"
              defaultValue={"" + minLen}
              min={MINLEN_MIN}
              max={MINLEN_MAX}
              onChange={setMinLen}
              className="form-control"
            />
          </fieldset>
          <fieldset className="form-group">
            <label htmlFor="maxlen">Max Length</label>
            <input
              id="maxlen"
              type="number"
              defaultValue={"" + maxLen}
              min={MAXLEN_MIN}
              max={MAXLEN_MAX}
              onChange={setMaxLen}
              className="form-control"
            />
          </fieldset>
          <button
            className="btn btn-primary btn-block"
            disabled={
              running || minFp === null || minLen === null || maxLen === null
            }
            onClick={() => pcr()}
          >
            Go!
            {running && <span className="loading" />}
          </button>
        </div>
      </section>
      <section>
        <div className="container">
          {(matches || products) && (
            <>
              <hr/>
              <h2>Results</h2>
              <h3>Products</h3>
              <table>
                <thead>
                  <tr>
                    <th>Forward primer</th>
                    <th>Reverse primer</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Length</th>
                  </tr>
                </thead>
                <tbody>
                  {products &&
                    products.map((p, idx) => {
                      return (
                        <tr
                          className="clickable"
                          key={idx}
                          onClick={() => extractProduct(idx)}
                        >
                          <td>{p.primerFwd.name}</td>
                          <td>{p.primerRev.name}</td>
                          <td>{p.start + 1}</td>
                          <td>{p.end}</td>
                          <td>{p.len}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              <h3>Binding</h3>
              <table>
                <thead>
                  <tr>
                    <th>Strand</th>
                    <th>Primer</th>
                    <th>Start</th>
                    <th>Length</th>
                  </tr>
                </thead>
                <tbody>
                  {matches &&
                    matches.map((m, idx) => {
                      return (
                        <tr key={idx}>
                          <td>{m.fwd ? ">>>" : "<<<"}</td>
                          <td>{m.primer.name}</td>
                          <td>{m.start}</td>
                          <td>{m.len}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </>
          )}
        </div>
      </section>
    </>
  );
}

const app = document.createElement("div");
document.body.appendChild(app);
ReactDOM.render(<App />, app);
