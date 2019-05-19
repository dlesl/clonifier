import * as React from "react";
import { appContext } from ".";
import { Primer } from "./db";
import { ListData, ListView } from "./components/list_view";
import { readCachedPromise, readMethodCall } from "./utils/suspense";
import { Tab } from "./tab";
import SeqTab from "./seq_view";
import * as utils from "./utils";
import {
  JsMatch,
  JsProduct,
  Pcrer,
  PcrResults
} from "./worker_comms/worker_shims";
import PromiseButton from "./components/promise_button";

interface Footprint {
  primer: Primer;
  start: number;
  len: number;
  fwd: boolean;
}

interface Product {
  primerFwd: Primer;
  primerRev: Primer;
  start: number;
  end: number;
  len: number;
}

export interface PcrSettings {
  minFp: number;
  minLen: number;
  maxLen: number;
}

function PcrProgress({ pcr }: { pcr: Pcrer }) {
  const [percent, setPercent] = React.useState(0);
  React.useEffect(() => {
    const interval = setInterval(
      () => pcr.get_status().then(s => setPercent(s.percent)),
      300
    );
    return () => clearInterval(interval);
  }, []);
  return <progress max="100" value={percent} />;
}

export class PcrTab extends Tab {
  private data: Promise<Pcrer>;
  private settings: PcrSettings | undefined;
  private result: Promise<PcrResults>;
  constructor(data: Promise<Pcrer>, settings?: PcrSettings) {
    super();
    this.data = data;
    this.settings = settings;
    this.result = this.data.then(pcr => pcr.get_result());
  }
  public renderSelf() {
    return (
      <Pcr
        pcrPromise={this.data}
        resultPromise={this.result}
        settings={this.settings}
        onRun={settings => this.run(settings)}
      />
    );
  }
  public renderButton() {
    return "Untitled PCR";
  }
  get symbol() {
    return "🧪";
  }
  public async run(newSettings: PcrSettings) {
    this.update(
      new PcrTab(this.result.then(res => res.run(newSettings)), newSettings)
    );
  }
  public free() {
    this.data.then(pcr => {
      pcr.cancel();
      pcr.free();
    });
    this.result.then(r => r.free());
  }
}

interface Props {
  pcrPromise: Promise<Pcrer>;
  resultPromise: Promise<PcrResults>;
  settings: PcrSettings;
  onRun: (settings: PcrSettings) => Promise<void>;
}
interface ResultProps {
  pcr: Pcrer;
  resultPromise: Promise<PcrResults>;
  dirty: boolean;
  setSelectedMatches: (matches: number[]) => void;
  setSelectedProducts: (products: number[]) => void;
}
function Pcr({ pcrPromise, resultPromise, settings, onRun }: Props) {
  const pcr = readCachedPromise(pcrPromise);
  const [dirty, setDirty] = React.useState(false);
  const [cancelled, setCancelled] = React.useState(false);
  const [running, setRunning] = React.useState(true);
  const [selectedMatches, setSelectedMatches] = React.useState<number[]>([]);
  const [selectedProducts, setSelectedProducts] = React.useState<number[]>([]);
  React.useEffect(() => {
    resultPromise.then(() => setRunning(false));
  }, []);
  if (!settings) {
    settings = readMethodCall(pcr, pcr.get_settings);
  }
  return (
    <div className="pcr_view">
      <Settings
        onRun={onRun}
        onCancel={() => pcr.cancel().then(() => setCancelled(true))}
        setDirty={setDirty}
        dirty={dirty || cancelled}
        {...{
          running,
          settings,
          selectedMatches,
          selectedProducts,
          resultPromise
        }}
      />
      <React.Suspense fallback={<PcrProgress pcr={pcr} />}>
        <Result
          pcr={pcr}
          resultPromise={resultPromise}
          dirty={dirty || cancelled}
          {...{ setSelectedMatches, setSelectedProducts }}
        />
      </React.Suspense>
    </div>
  );
}

function Settings({
  onRun,
  settings,
  setDirty,
  dirty,
  running,
  onCancel,
  selectedMatches,
  selectedProducts,
  resultPromise
}) {
  const [{ minFp, minLen, maxLen }, setNewSettings] = React.useState(settings);
  const updateSetting = (setting: string, val: string) => {
    const newerSettings = {
      minFp,
      minLen,
      maxLen
    };
    (newerSettings as any)[setting] = +val; // convert to int
    setNewSettings(newerSettings);
    setDirty(
      newerSettings.maxLen !== settings.maxLen ||
        newerSettings.minLen !== settings.minLen ||
        newerSettings.minFp !== settings.minFp
    );
  };
  const run = () => onRun({ minFp, minLen, maxLen });
  return (
    <div className="template_left recessed_light">
      <ul>
        <li>
          <label>Min 3' primer homology</label>
          <input
            type="number"
            value={minFp}
            min="1"
            max="63"
            onChange={e => updateSetting("minFp", e.target.value)}
            className="recessed_light"
          />
        </li>
        <li>
          <label>Min length</label>
          <input
            type="number"
            value={minLen}
            min="1"
            onChange={e => updateSetting("minLen", e.target.value)}
            className="recessed_light"
          />
        </li>
        <li>
          <label>Max length</label>
          <input
            type="number"
            value={maxLen}
            min="1"
            onChange={e => updateSetting("maxLen", e.target.value)}
            className="recessed_light"
          />
        </li>
        <hr/>
        <li>
          <PromiseButton
            disabled={!dirty && !running}
            onClick={running ? onCancel : run}
          >
            {running ? "Cancel" : "Run"}
          </PromiseButton>
        </li>
        <li>
          <PromiseButton
            disabled={running || dirty || selectedMatches.length === 0}
            onClick={async () => {
              let r = await resultPromise;
              let s = r.annotate_matches(selectedMatches);
              appContext.addTab(new SeqTab(s));
              return s;
            }}
          >
            Annotate primer binding
          </PromiseButton>
        </li>
        <li>
          <PromiseButton
            disabled={running || dirty || selectedProducts.length === 0}
            onClick={async () => {
              let r = await resultPromise;
              let s = r.annotate_products(selectedProducts);
              appContext.addTab(new SeqTab(s));
              return s;
            }}
          >
            Annotate PCR products
          </PromiseButton>
        </li>
        <li>
          <PromiseButton
            disabled={running || dirty || selectedProducts.length === 0}
            onClick={() =>
              Promise.all(
                selectedProducts.map(idx =>
                  resultPromise.then(r =>
                    r.extract_product(idx).then(p => appContext.saveFragment(p))
                  )
                )
              )
            }
          >
            Save PCR products
          </PromiseButton>
        </li>
      </ul>
    </div>
  );
}

function Result({
  pcr,
  resultPromise,
  dirty,
  setSelectedMatches,
  setSelectedProducts
}: ResultProps) {
  const result = readCachedPromise(resultPromise);
  const [matches, _setMatches] = React.useState<ListData<JsMatch>>(
    () => new ListData(readMethodCall(result, result.get_matches))
  );
  const setMatches = (matches: ListData<JsMatch>) => {
    setSelectedMatches(matches.checkedIdxs);
    _setMatches(matches);
  };
  const [products, _setProducts] = React.useState<ListData<JsProduct>>(
    () => new ListData(readMethodCall(result, result.get_products))
  );
  const setProducts = (products: ListData<JsProduct>) => {
    setSelectedProducts(products.checkedIdxs);
    _setProducts(products);
  };

  /// end of hooks

  const extractProduct = (idx: number) => {
    const seq = result.extract_product(idx);
    appContext.addTab(new SeqTab(seq));
  };

  const saveProducts = () => {
    Promise.all(
      products.checkedIdxs.map(async idx => {
        appContext.saveFragment(await result.extract_product(idx));
      })
    );
  };

  const matchesCols = [
    {
      getter: (r: Footprint) => (r.fwd ? ">>>" : "<<<"),
      name: "Strand",
      sort: (a: string, b: string) => a.charCodeAt(0) - b.charCodeAt(0)
    },
    {
      getter: (r: Footprint) => r.primer.name,
      name: "Primer",
      sort: utils.numericCompare
    },
    {
      getter: (r: Footprint) => r.start,
      name: "Start",
      sort: (a: number, b: number) => a - b
    },
    {
      getter: (r: Footprint) => r.len,
      name: "Length",
      sort: (a: number, b: number) => a - b
    }
  ];
  const productsCols = [
    {
      getter: (r: Product) => r.primerFwd.name,
      name: "Fwd",
      sort: utils.numericCompare
    },
    {
      getter: (r: Product) => r.primerRev.name,
      name: "Rev",
      sort: utils.numericCompare
    },
    {
      getter: (r: Product) => r.start,
      name: "Start",
      sort: (a: number, b: number) => a - b
    },
    {
      getter: (r: Product) => r.end,
      name: "End",
      sort: (a: number, b: number) => a - b
    },
    {
      getter: (r: Product) => r.len,
      name: "Length",
      sort: (a: number, b: number) => a - b
    }
  ];
  return (
    <>
      <div className="pcr_matches">
        <h2>Primer binding</h2>
        <ListView<Footprint>
          columns={matchesCols}
          data={dirty ? null : matches}
          checkboxes={true}
          onUpdate={setMatches}
        />
      </div>
      <div className="pcr_products">
        <h2>PCR products</h2>
        <ListView<Product>
          columns={productsCols}
          data={dirty ? null : products}
          checkboxes={true}
          onUpdate={setProducts}
          onRowClicked={(_, idx) => extractProduct(idx)}
        />
      </div>
    </>
  );
}
