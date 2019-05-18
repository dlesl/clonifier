import * as React from "react";
import { appContext } from ".";
import { AssemblyTab, assemblyFromFragments } from "./assembly";
import { Fragment, loadFragment } from "./db";
import { ListData, ListView } from "./components/list_view";
import SeqTab from "./seq_view";
import { numericCompare } from "./utils";
import { Seq } from "./worker_comms/worker_shims";
import { QuickSelect } from "./components/quick_select";

export interface Props {
  templateSelected: Promise<Seq> | null;
  fragments: ListData<Fragment>;
  setFragments: (fragments: ListData<Fragment>) => void;
}

const columns = [
  {
    getter: (r: Fragment) => r.name,
    name: "Name",
    sort: numericCompare
  },
  {
    getter: (r: Fragment) => r.len,
    name: "Length",
    sort: (a: number, b: number) => a - b
  }
];

export const FragmentList = React.memo(function FragmentList({
  templateSelected,
  fragments,
  setFragments
}: Props) {
  const [filter, setFilter] = React.useState<Set<number> | null>(null);
  const removeSelectedFragments = () => {
    if (
      !window.confirm(
        `Really remove ${fragments.checkedIdxs.length} fragments?`
      )
    ) {
      return;
    }
    appContext.db.fragments.bulkDelete(fragments.checkedRows.map(f => f.id));
    setFragments(fragments.removeSelected());
  };

  const openFragment = (f: Fragment) => {
    appContext.addTab(new SeqTab(loadFragment(f)));
  };

  const openSelectedFragments = () => {
    for (const f of fragments.checkedRows) {
      openFragment(f);
    }
  };
  const selection = fragments.checkedRows.length !== 0;
  return (
    <>
      <div
        className="primer_list"
        onDrop={e => {
          e.preventDefault();
          e.stopPropagation();
          if (e.dataTransfer.files) {
            appContext.saveFiles(e.dataTransfer.files);
          }
        }}
        onDragOver={e => e.preventDefault()}
      >
        <ListView<Fragment>
          columns={columns}
          data={fragments}
          checkboxes={true}
          filter={filter}
          onUpdate={setFragments}
          onRowClicked={openFragment}
        />
      </div>
      <QuickSelect data={fragments.rows} setFilter={setFilter} />
      <div className="primer_list_buttons toolbar recessed_light">
        <button
          className="button button_small"
          disabled={!templateSelected}
          onClick={async () => appContext.saveFragment(await templateSelected)}
        >
          ➕
        </button>
        <button
          className="button button_small"
          disabled={!selection}
          onClick={removeSelectedFragments}
        >
          ➖
        </button>
        <button
          className="button"
          disabled={!selection}
          onClick={openSelectedFragments}
        >
          Open
        </button>
        <button
          className="button"
          disabled={!selection}
          onClick={() => {
            const a = assemblyFromFragments(fragments.checkedRows);
            appContext.addTab(
              new AssemblyTab(a.assembly, a.name, { limit: 16 })
            );
          }}
        >
          Assemble
        </button>
      </div>
    </>
  );
});
