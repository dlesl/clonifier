import * as React from "react";
import { appContext } from ".";
import { Fragment, Primer } from "./db";
import { FragmentList } from "./fragment_list";
import { ListData } from "./components/list_view";
import { PrimerList } from "./primer_list";
import { ResizeHandler } from "./utils";
import { Seq } from "./worker_comms/worker_shims";
import { leftPaneWidth } from "./config";

export enum Panel {
  Fragments,
  Primers
}
export interface Props {
  fragments: ListData<Fragment>;
  setFragments: (fragments: ListData<Fragment>) => void;
  primers: ListData<Primer>;
  setPrimers: (primers: ListData<Primer>) => void;
  selectedPanel: Panel;
  templateSelected: null | Promise<Seq>;
  setSelectedPanel: (panel: Panel) => void;
}

export const LeftPanel = React.memo(function LeftPanel({
  selectedPanel,
  setSelectedPanel,
  templateSelected,
  setFragments,
  fragments,
  setPrimers,
  primers
}: Props) {
  const divRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    appContext.db.primers.toArray(primers => setPrimers(new ListData(primers)));
    const resizeHandler = new ResizeHandler(false);
    resizeHandler.install(divRef.current as Element, leftPaneWidth.val, newWidth => leftPaneWidth.val = newWidth);
    return () => resizeHandler.uninstall();
  }, []);
  return (
    <>
      <div className="switcher">
        <span
          onClick={() => setSelectedPanel(Panel.Primers)}
          className={selectedPanel == Panel.Primers ? "selected" : ""}
        >
          Primers
        </span>
        <span
          onClick={() => setSelectedPanel(Panel.Fragments)}
          className={selectedPanel == Panel.Fragments ? "selected" : ""}
        >
          Fragments
        </span>
      </div>
      <div className="left_panel" ref={divRef}>
        <div className="primer_list_container">
          {selectedPanel == Panel.Primers && (
            <PrimerList
              templateSelected={templateSelected}
              primers={primers}
              setPrimers={setPrimers}
            />
          )}
          {selectedPanel == Panel.Fragments && (
            <FragmentList
              templateSelected={templateSelected}
              fragments={fragments}
              setFragments={setFragments}
            />
          )}
        </div>
        <div className="resizer">
          <div className="resizer_handle" />
        </div>
      </div>
    </>
  );
});
