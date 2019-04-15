import { readFileSync, writeFileSync } from "fs";
import { standardTemplates } from ".";

import("../rust/pkg/clonifier").then(wasm => {
  for (const t of standardTemplates) {
    const input = readFileSync(`./templates/${t.basename}.gb`);
    const seq = wasm.parse_gb(input)[0];
    const bin = seq.to_bin();
    writeFileSync(`./dist/${t.basename}.bin`, bin);
    seq.free();
  }
});
