import * as React from "react";
import { escapeRegExp } from "../utils";

interface INamed {
  name: string;
}

interface Props {
  data: INamed[];
  setFilter: (vals: Set<number> | null) => void;
}

export function QuickSelect({ data, setFilter }: Props) {
  const onChange = (q: string) => {
    if (q.length === 0) {
      setFilter(null);
    } else {
      const qCaseI = new RegExp(escapeRegExp(q), "i");
      const res = new Set();
      data.forEach((v, idx) => {
        if (qCaseI.test(v.name)) {
          res.add(idx);
        }
      });
      setFilter(res);
    }
  };
  return (
    <div className="recessed_light">
      <input className="quickselect" onChange={e => onChange(e.target.value)} />
    </div>
  );
}
