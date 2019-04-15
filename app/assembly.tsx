import * as React from "react";
import * as ReactDOM from "react-dom";
import { appContext } from ".";
import { ListData, ListView } from "./components/list_view";
import { readMethodCall, readCachedPromise } from "./utils/suspense";
import { Tab } from "./tab";
import SeqTab from "./seq_view";
import * as utils from "./utils";
import {
  AssemblyResult,
  Seq,
  newAssembly,
  Assembly,
  parse_bin
} from "./worker_comms/worker_shims";
import { ErrorBoundary } from "./components/error_boundary";
import { Fragment, loadFragment } from "./db";

export function assemblyFromFragments(
  fragments: Fragment[]
): { name: string; assembly: Promise<Assembly> } {
  const seqPromises = fragments.map(f => loadFragment(f));
  const name = fragments.map(f => f.name).join(", ");
  // @ts-ignore (this seems to confuse typescript)
  const assembly: Promise<Assembly> = Promise.all([
    newAssembly(),
    ...seqPromises
  ]).then(([a, ...seqs]: [Assembly, ...Seq[]]) => {
    for (const seq of seqs) {
      a.push(seq); // no need to await, the worker is single threaded ;)
      seq.free(); // the `Assembly` has cloned the ref-counted Seq, we no longer need it.
    }
    return a;
  });
  return { name, assembly };
}

export interface Settings {
  limit: number;
}

export class AssemblyTab extends Tab {
  public result: Promise<AssemblyResult>;
  private assembly: Promise<Assembly>;
  public settings: Settings;
  public _name: string;
  public onUpdate: (settings: Settings) => void;
  constructor(assembly: Promise<Assembly>, name: string, settings: Settings) {
    super();
    this.assembly = assembly;
    this.result = assembly.then(a => a.assemble(settings));
    this._name = name;
    this.settings = settings;
    this.onUpdate = (settings: Settings) => {
      this.update(
        new AssemblyTab(assembly.then(a => a.clone()), name, settings)
      );
    };
  }
  public renderButton() {
    return <>{this.name}</>;
  }
  get symbol() {
    return "🖇️";
  }
  public renderSelf() {
    return (
      <AssemblyView
        settings={this.settings}
        arPromise={this.result}
        onUpdate={this.onUpdate}
      />
    );
  }
  get name(): string {
    return this._name;
  }
  public free() {
    this.assembly.then(a => a.free());
    this.result.then(ar => ar.free());
  }
}

interface Props {
  settings: Settings;
  arPromise: Promise<AssemblyResult>;
  onUpdate: (settings: Settings) => void;
}

interface SettingsProps {
  settings: Settings;
  onUpdate: (settings: Settings) => void;
}

interface DiagramItem {
  idx: number;
  linear: boolean;
}

interface ListsProps {
  arPromise: Promise<AssemblyResult>;
  setDiagram: (item: DiagramItem) => void;
  openSeq: (seq: Promise<Seq>) => void;
}

const productCols = [
  { getter: r => r.desc, name: "Fragments", sort: utils.numericCompare },
  { getter: r => r.len, name: "Length", sort: (a: number, b: number) => a - b }
];

function AssemblyView({ settings, arPromise, onUpdate }: Props) {
  const [diagram, setDiagram] = React.useState(null);

  function openSeq(seq) {
    appContext.addTab(new SeqTab(seq));
  }

  return (
    // TODO: Clean up this mess
    <div className="assembly">
      <div className="assembly_lists">
        <h2>Settings</h2>
        <Settings {...{ settings, onUpdate }} />
        <ErrorBoundary>
          <Lists {...{ arPromise, setDiagram, openSeq }} />
        </ErrorBoundary>
      </div>
      <ErrorBoundary>
        <React.Suspense fallback={<div className="assembly_diagram" />}>
          <AssemblyDiagram arPromise={arPromise} item={diagram} />
        </React.Suspense>
      </ErrorBoundary>
    </div>
  );
}

function AssemblyDiagram({
  arPromise,
  item
}: {
  arPromise: Promise<AssemblyResult>;
  item: DiagramItem;
}) {
  let html = "";
  if (item) {
    const ar = readCachedPromise(arPromise);
    html = readMethodCall(
      ar,
      item.linear ? ar.render_diagram_linear : ar.render_diagram_circular,
      item.idx
    );
  }
  return (
    <div
      className="assembly_diagram"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function Settings({ settings, onUpdate }: SettingsProps) {
  const [overlap, setOverlap] = React.useState(settings.limit.toString());

  const olInt = parseInt(overlap, 10);
  const olValid = olInt > 5 && olInt <= 63;

  return (
    <div className="assembly_settings">
      <p>
        <label>
          <input
            type="number"
            value={overlap}
            min="5"
            max="63"
            onChange={e => setOverlap(e.target.value)}
          />
          Min overlap
        </label>
        <button disabled={!olValid} onClick={() => onUpdate({ limit: olInt })}>
          Update
        </button>
      </p>
    </div>
  );
}

function Lists({ arPromise, setDiagram, openSeq }: ListsProps) {
  const ar = readCachedPromise(arPromise);
  const [linear, updateLinear] = React.useState(
    () => new ListData(readMethodCall(ar, ar.get_linear))
  );
  const [circular, updateCircular] = React.useState(
    () => new ListData(readMethodCall(ar, ar.get_circular))
  );

  return (
    <>
      {" "}
      <h2>Circular</h2>
      <div className="assembly_list">
        <ListView
          data={circular}
          onUpdate={updateCircular}
          columns={productCols}
          onMouseOver={(_, idx) => setDiagram({ linear: false, idx })}
          onRowClicked={(_, idx) => openSeq(ar.extract_product_circular(idx))}
          checkboxes
        />
      </div>
      <h2>Linear</h2>
      <div className="assembly_list">
        <ListView
          data={linear}
          onUpdate={updateLinear}
          columns={productCols}
          onMouseOver={(_, idx) => setDiagram({ linear: true, idx })}
          onRowClicked={async (_, idx) =>
            openSeq(ar.extract_product_linear(idx))
          }
          checkboxes
        />
      </div>
    </>
  );
}
