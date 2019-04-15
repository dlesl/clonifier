import * as React from "react";
import { appContext } from ".";
import { Primer } from "./db";
import { ListData, ListView } from "./components/list_view";
import { PcrTab } from "./pcr_view";
import * as utils from "./utils";
import { newPcrer, Seq } from "./worker_comms/worker_shims";
import { QuickSelect } from "./components/quick_select";

export interface Props {
  templateSelected: Promise<Seq> | null;
  primers: ListData<Primer>;
  setPrimers: (primers: ListData<Primer>) => void;
}

function pcr(seqPromise: Promise<Seq>, primers: Primer[]) {
  const settings = {
    minFp: 14,
    minLen: 100,
    maxLen: 10000
  };
  const pcrTab = new PcrTab(
    seqPromise.then(seq => newPcrer(seq, primers, settings))
  );
  appContext.addTab(pcrTab);
}
function savePrimers(primers: Primer[]) {
  const table = appContext.db.primers;
  appContext.db.transaction("rw", table, () => {
    table.clear();
    table.bulkAdd(primers);
  });
}

export const PrimerList = React.memo(function({
  templateSelected,
  primers,
  setPrimers
}: Props) {
  const [editingPrimers, setEditingPrimers] = React.useState<string | null>(
    null
  );
  const [filter, setFilter] = React.useState<Set<number> | null>(null);
  const primerSelected = primers.checkedIdxs.length > 0;
  const editPrimers = () => {
    const val = primers.rows
      .map(p => `${p.name}\t${p.seq}\t${p.desc}`)
      .join("\n");
    setEditingPrimers(val);
  };
  const editedPrimers = () => {
    if (editingPrimers === null) {
      return;
    }
    const lines = editingPrimers.split("\n");
    const primers = [];
    for (const l of lines) {
      const match = l.match(/([^\s]*)\s+([^\s]+)(?:\s+)?(.*)/);
      if (match) {
        primers.push({
          name: match[1],
          seq: match[2],
          desc: match[3]
        });
      }
    }
    setEditingPrimers(null);
    setPrimers(new ListData(primers));
    savePrimers(primers);
  };
  const onItemEdited = (rowIdx: number, idx: number, newVal: string) => {
    if (idx < 2) {
      const error = utils.noWhiteSpace(newVal);
      if (error) {
        return error;
      }
    }
    let { name, seq, desc } = primers.rows[rowIdx];
    switch (idx) {
      case 0:
        name = newVal;
        break;
      case 1:
        seq = newVal;
        break;
      case 2:
        desc = newVal;
        break;
    }
    const newPrimers = primers.replaceRow(rowIdx, { name, seq, desc });
    setPrimers(newPrimers);
    savePrimers(newPrimers.rows);
  };
  return (
    <>
      <div className="primer_list">
        {editingPrimers !== null && (
          <textarea
            className="recessed scroll"
            value={editingPrimers}
            onChange={e => setEditingPrimers(e.target.value)}
          />
        )}
        {editingPrimers === null && (
          <ListView<Primer>
            columns={primerListColumns}
            data={primers}
            checkboxes={true}
            filter={filter}
            onUpdate={setPrimers}
            onItemEdited={onItemEdited}
          />
        )}
      </div>
      <QuickSelect data={primers.rows} setFilter={setFilter} />
      <div className="primer_list_buttons toolbar recessed_light">
        <button
          className="button button_small"
          onClick={() =>
            setPrimers(
              primers.append({
                name: "",
                seq: "",
                desc: ""
              })
            )
          }
        >
          ➕
        </button>
        <button
          className="button button_small"
          disabled={!primerSelected}
          onClick={() => {
            const newPrimers = primers.removeSelected("primers");
            setPrimers(newPrimers);
            savePrimers(newPrimers.rows);
          }}
        >
          ➖
        </button>
        <button
          className="button"
          onClick={editingPrimers !== null ? editedPrimers : editPrimers}
        >
          {editingPrimers === null && "🗒️  Bulk edit"}
          {editingPrimers !== null && "💾  Save"}
        </button>
        <button
          className="button"
          disabled={!primerSelected || !!editingPrimers || !templateSelected}
          onClick={() => pcr(templateSelected, primers.checkedRows)}
        >
          PCR
        </button>
      </div>
    </>
  );
});

const primerListColumns = [
  {
    getter: (r: Primer) => r.name,
    name: "Name",
    sort: utils.numericCompare,
    editable: true
  },
  {
    getter: (r: Primer) => r.seq,
    name: "Sequence",
    sort: utils.fastCompare,
    editable: true
  },
  {
    getter: (r: Primer) => r.desc,
    name: "Description",
    sort: utils.fastCompare,
    editable: true
  }
];
