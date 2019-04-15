import Dexie from "dexie";
import { Seq, parse_bin } from "./worker_comms/worker_shims";
import { readFileBinary } from "./utils";

export interface Primer {
  name: string;
  seq: string;
  desc: string;
}

export interface Fragment {
  id?: number;
  name: string;
  len: number;
  circular: boolean;
  blob: Blob;
}

export class Db extends Dexie {
  public primers: Dexie.Table<Primer, number>;
  public fragments: Dexie.Table<Fragment, number>;
  constructor() {
    super("Db");
    this.version(1).stores({
      primers: "++id",
      fragments: "++id"
    });
  }
}

export async function loadFragment(f: Fragment): Promise<Seq> {
  try {
    return parse_bin(await readFileBinary(f.blob));
  } catch (error) {
    alert("" + error); // TODO: handle better?
  }
}
