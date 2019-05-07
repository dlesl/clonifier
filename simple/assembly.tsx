import * as React from "react";
import * as ReactDOM from "react-dom";
import { downloadData, readFileBinary } from "../app/utils/io";
import { setErrorHandler, setLogHandler } from "../app/worker_comms";
import {
  parse_gb,
  Seq,
  parse_fasta,
  newAssembly,
  Assembly,
  AssemblyResult
} from "../app/worker_comms/worker_shims";
import { useIntFromInputLS, useScrollToRef, ForkMe, PromiseSpinnerButton } from "./common";
import "hack";
import "./common.css";

setErrorHandler(alert);
setLogHandler(() => {}); // gets logged to console anyway

const MINFP_MIN = 5;
const MINFP_MAX = 63;

interface SeqWrapper {
  seq: Seq;
  name: string;
}

function App() {
  const templateRef = React.useRef<HTMLTextAreaElement>();
  const fileRef = React.useRef<HTMLInputElement>();
  const seqListRef = React.useRef<HTMLSelectElement>();
  const [minFp, setMinFp] = useIntFromInputLS(
    14,
    MINFP_MIN,
    MINFP_MAX,
    "assembly_minfp"
  );

  const result = React.useRef<AssemblyResult>(null);
  const [running, setRunning] = React.useState(false);
  const [circular, setCircular] = React.useState<any[]>(null);
  const [linear, setLinear] = React.useState<any[]>(null);
  const [seqs, setSeqs] = React.useState<SeqWrapper[]>([]);
  const resultsRef = React.useRef<HTMLHRElement>();
  // scroll results into view when they have all arrived
  useScrollToRef(resultsRef, [!!circular && !!linear]);
  const onLoadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.persist();
    e.preventDefault();
    const files = e.target.files;
    for (const f of files) {
      const ab = await readFileBinary(f);
      try {
        parseSeq(ab);
      } catch (e) {
        alert("" + e);
      }
    }
    e.target.value = "";
  };
  const parseSeqText = async () => {
    const enc = new TextEncoder();
    const templateText = templateRef.current.value;
    const ab = enc.encode(templateText).buffer;
    try {
      await parseSeq(ab);
      templateRef.current.value = "";
    } catch (e) {
      alert("" + e);
    }
  };
  const parseSeq = async (ab: ArrayBuffer) => {
    let seqs: Seq[];
    seqs = await parse_fasta(ab.slice(0)).catch(e =>
      parse_gb(ab).catch(e0 => {
        throw new Error(
          `Failed parsing as FASTA: ${e.toString()}
          Failed parsing as Genbank: ${e0.toString()}`
        );
      })
    );
    if (seqs.length === 0) {
      throw new Error("Sequence empty!");
    }
    const names = await Promise.all(
      seqs.map(async s => (await s.get_metadata()).name)
    );
    setSeqs(s => [
      ...s,
      ...seqs.map((seq, idx) => ({ seq, name: names[idx] }))
    ]);
  };
  const assemble = async () => {
    setRunning(true);
    setCircular(null);
    setLinear(null);
    if (result.current) {
      result.current.free();
      result.current = null;
    }
    const p = newAssembly();
    const [a] = ((await Promise.all([
      p,
      ...seqs.map(s => p.then(a => a.push(s.seq)))
    ] as any)) as unknown) as Assembly[];
    try {
      const ar = await a.assemble({ limit: minFp });
      result.current = ar;
      setCircular(await ar.get_circular());
      setLinear(await ar.get_linear());
    } catch (e) {
      alert("" + e);
    }
    a.free();
    setRunning(false);
  };
  const extractProduct = async (p: Promise<Seq>, idx: number) => {
    const product = await p;
    const data = await product.to_gb();
    product.free();
    downloadData(data, `product_${idx}.gb`, "text/plain");
  };
  const extractProductCircular = (idx: number) =>
    extractProduct(result.current.extract_product_circular(idx), idx);
  const extractProductLinear = (idx: number) =>
    extractProduct(result.current.extract_product_linear(idx), idx);
  return (
    <div className="container">
    <ForkMe/>
      <input
        type="file"
        ref={fileRef}
        onChange={onLoadFile}
        multiple={true}
        style={{ position: "absolute", top:0, left: 0, opacity: 0, width: 0, height: 0, overflow: "hidden" }}
      />
    <h1><i>In silico</i> Gibson assembly</h1>
      <label>
        Enter one or more sequences (Genbank or FASTA format)
        <textarea ref={templateRef} style={{ height: "20em" }} />
      </label>
      <button className="btn btn-primary" onClick={() => parseSeqText()}>Add</button>{" "}
      <button className="btn btn-default" onClick={() => fileRef.current.click()}>
        Load sequences from file
      </button>
      <p/>
      <label>Sequences</label>
        <select multiple ref={seqListRef}>
          {seqs.map((s, idx) => (
            <option value={idx} key={idx}>
              {s.name}
            </option>
          ))}
        </select>
          <button
            className="btn btn-default"
            onClick={() => {
              const selected = new Set();
              for (const o of seqListRef.current.selectedOptions) {
                selected.add(parseInt(o.value, 10));
              }
              setSeqs(seqs.filter((s, idx) => !selected.has(idx)));
              seqs.filter((s, idx) => selected.has(idx)).map(s => s.seq.free());
            }}
          >
            Remove selected
          </button>
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
      <PromiseSpinnerButton className="btn btn-primary btn-block" disabled={running || minFp === null} onClick={assemble}>
        Assemble!
      </PromiseSpinnerButton>
      {(circular || linear) && (
        <>
          <hr ref={resultsRef}/>
          <h2>Results</h2>
          <h3>Circular products</h3>
          <table>
            <thead>
              <tr>
                <th>Fragments</th>
                <th>Length</th>
              </tr>
            </thead>
            <tbody>
              {circular &&
                circular.map((p, idx) => {
                  return (
                    <tr
                      className="clickable"
                      key={idx}
                      onClick={() => extractProductCircular(idx)}
                    >
                      <td>{p.desc}</td>
                      <td>{p.len}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          <h3>Linear products</h3>
          <table>
            <thead>
              <tr>
                <th>Fragments</th>
                <th>Length</th>
              </tr>
            </thead>
            <tbody>
              {linear &&
                linear.map((p, idx) => {
                  return (
                    <tr
                      className="clickable"
                      key={idx}
                      onClick={() => extractProductLinear(idx)}
                    >
                      <td>{p.desc}</td>
                      <td>{p.len}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

const root = document.getElementById("root");
ReactDOM.render(<App />, root);