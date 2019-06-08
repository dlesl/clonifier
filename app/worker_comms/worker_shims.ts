import { workerCall, workerRequest, workerDeleteObj } from ".";
import { Request, ArgType } from "../../worker/shared";
import { IArrow } from "../diagram";

/** This is a class which all proxied Rust objects (which live in the
 *  worker, and whose lifetimes must be manually managed)
 *  extend. These classes are also defined in this file.  Each
 *  `RemoteObj` is identified by a numeric `id`.  Calling `free` first
 *  queues a call to `free` (freeing the Rust object) on the worker,
 *  then tells the worker to forget that object. Any further calls to
 *  the object's methods will throw an exception!
 */
export class RemoteObj {
  private _id: number;
  constructor(id: number) {
    this._id = id;
  }
  get id() {
    return this._id;
  }
  callMethod(
    name: string,
    retType: ArgType,
    args: any[],
    specialArgs?: ArgType[],
    transfer?: any[]
  ): Promise<any> {
    if (this.id === -1) {
      console.error("Bad stuff happening, use after free!", this);
      throw new Error("Attempt to call method on freed object");
    }
    const req: Request = {
      fn: name,
      args,
      retType,
      specialArgs,
      command: "call",
      targetObj: this.id
    };
    return workerRequest(req, transfer);
  }
  free() {
    this.callMethod("free", "val", []);
    workerDeleteObj(this);
    this._id = -1;
  }
}

////// The following is mostly autogenerated (with manual tweaks), see generate_shims.py

export function tester(arg0: number): Promise<number> {
  return workerCall("tester", "val", [arg0], ["val"], []);
}

export function parse_gb(arg0: ArrayBuffer): Promise<Seq[]> {
  return workerCall("parse_gb", "obj_array", [arg0], ["binary"], [arg0]);
}

export function parse_fasta(arg0: ArrayBuffer): Promise<Seq[]> {
  return workerCall("parse_fasta", "obj_array", [arg0], ["binary"], [arg0]);
}

export function parse_bin(arg0: ArrayBuffer): Promise<Seq> {
  return workerCall("parse_bin", "obj", [arg0], ["binary"], [arg0]);
}

export interface Metadata {
  name: string;
  len: number;
  circular: boolean;
}

export interface JsMatch {
  primer: any;
  start: number;
  len: number;
  fwd: boolean;
}
export interface JsMatch {
  primer: any;
  start: number;
  len: number;
  fwd: boolean;
  tm: number;
  tmDbd: number;
}

export interface JsProduct {
  primerFwd: any;
  primerRev: any;
  start: number;
  end: number;

  len: number;
}
export type PcrSettings = {
  minFp: number;
  minLen: number;
  maxLen: number;
};

export class AssemblyResult extends RemoteObj {
  get_circular(): Promise<any> {
    return this.callMethod("get_circular", "val", [], [], []);
  }

  get_linear(): Promise<any> {
    return this.callMethod("get_linear", "val", [], [], []);
  }

  render_diagram_linear(arg0: number): Promise<string> {
    return this.callMethod("render_diagram_linear", "val", [arg0], ["val"], []);
  }

  render_diagram_circular(arg0: number): Promise<string> {
    return this.callMethod(
      "render_diagram_circular",
      "val",
      [arg0],
      ["val"],
      []
    );
  }

  extract_product_linear(arg0: number): Promise<Seq> {
    return this.callMethod(
      "extract_product_linear",
      "obj",
      [arg0],
      ["val"],
      []
    );
  }

  extract_product_circular(arg0: number): Promise<Seq> {
    return this.callMethod(
      "extract_product_circular",
      "obj",
      [arg0],
      ["val"],
      []
    );
  }
}

export function newAssembly(): Promise<Assembly> {
  return workerRequest({ command: "new", className: "Assembly", args: [] });
}

export class Assembly extends RemoteObj {
  push(arg0: Seq): Promise<void> {
    return this.callMethod("push", "val", [arg0], ["obj"], []);
  }
  clone(): Promise<Assembly> {
    return this.callMethod("clone", "obj", [], [], []);
  }
  assemble(arg0: any): Promise<AssemblyResult> {
    return this.callMethod("assemble", "obj", [arg0], ["val"], []);
  }
}

export type SeqSearchResult = {
  start: number;
  end: number;
  fwd: boolean;
};

export class Seq extends RemoteObj {
  set_name(arg0: string): Promise<Seq> {
    return this.callMethod("set_name", "obj", [arg0], ["val"], []);
  }

  get_metadata(): Promise<any> {
    return this.callMethod("get_metadata", "val", [], [], []);
  }

  is_empty(): Promise<boolean> {
    return this.callMethod("is_empty", "val", [], [], []);
  }

  set_circular(arg0: boolean): Promise<Seq> {
    return this.callMethod("set_circular", "obj", [arg0], ["val"], []);
  }

  get_diagram_data(): Promise<IArrow[]> {
    return this.callMethod("get_diagram_data", "val", [], [], []);
  }

  get_diagram_data_filtered(idxes: number[]): Promise<IArrow[]> {
    return this.callMethod(
      "get_diagram_data_filtered",
      "val",
      [idxes],
      ["val"],
      []
    );
  }

  revcomp(): Promise<Seq> {
    return this.callMethod("revcomp", "obj", [], [], []);
  }

  to_bin(): Promise<Uint8Array> {
    return this.callMethod("to_bin", "binary", [], [], []).then(
      ab => new Uint8Array(ab)
    );
  }

  to_gb(): Promise<Uint8Array> {
    return this.callMethod("to_gb", "binary", [], [], []).then(
      ab => new Uint8Array(ab)
    );
  }

  get_feature_count(): Promise<number> {
    return this.callMethod("get_feature_count", "val", [], [], []);
  }

  get_feature(arg0: number): Promise<any> {
    return this.callMethod("get_feature", "val", [arg0], ["val"], []);
  }

  get_features(): Promise<any> {
    return this.callMethod("get_features", "val", [], [], []);
  }
  get_feature_qualifiers(arg0: number): Promise<any> {
    return this.callMethod(
      "get_feature_qualifiers",
      "val",
      [arg0],
      ["val"],
      []
    );
  }
  get_feature_qualifier(arg0: string): Promise<string[]> {
    return this.callMethod(
      "get_feature_qualifier",
      "val",
      [arg0],
      ["val"],
      []
    );
  }
  search_features(
    query: string,
    case_insensitive: boolean,
    include_keys: boolean
  ): Promise<Uint32Array> {
    return this.callMethod(
      "search_features",
      "val",
      [query, case_insensitive, include_keys],
      ["val", "val", "val"],
      []
    );
  }
  /** Returns `max_res + 1` results if more than `max_res` results were available */
  search_seq(query: string, max_res: number): Promise<SeqSearchResult[]> {
    return this.callMethod(
      "search_seq",
      "val",
      [query, max_res],
      ["val", "val"],
      []
    );
  }
  get_seq_slice(arg0: number, arg1: number): Promise<string> {
    return this.callMethod(
      "get_seq_slice",
      "val",
      [arg0, arg1],
      ["val", "val"],
      []
    );
  }

  extract_range(arg0: number, arg1: number, arg2?: string): Promise<Seq> {
    return this.callMethod(
      "extract_range",
      "obj",
      [arg0, arg1, arg2],
      ["val", "val", "val"],
      []
    );
  }

  set_origin(arg0: number): Promise<Seq> {
    return this.callMethod("set_origin", "obj", [arg0], ["val"], []);
  }

  clone(): Promise<Seq> {
    return this.callMethod("clone", "obj", [], [], []);
  }
}

export function newPcrer(arg0: Seq, arg1: any[], arg2: any): Promise<Pcrer> {
  return workerRequest({
    command: "new",
    className: "Pcrer",
    args: [arg0, arg1, arg2],
    specialArgs: ["obj", "val", "val"]
  });
}

export class Pcrer extends RemoteObj {
  get_status(): Promise<PcrStatus> {
    return this.callMethod("get_status", "val", [], [], []);
  }

  get_result(): Promise<PcrResults> {
    return this.callMethod("get_result", "obj", [], [], []);
  }

  cancel(): Promise<void> {
    return this.callMethod("cancel", "val", [], [], []);
  }

  get_settings(): Promise<PcrSettings> {
    return this.callMethod("get_settings", "val", [], [], []);
  }
}
export type PcrStatus = {
  done: boolean;
  cancelled: boolean;
  percent: any;
};

export class PcrResults extends RemoteObj {
  get_matches(): Promise<any> {
    return this.callMethod("get_matches", "val", [], [], []);
  }

  get_products(): Promise<any> {
    return this.callMethod("get_products", "val", [], [], []);
  }

  extract_product(arg0: number): Promise<Seq> {
    return this.callMethod("extract_product", "obj", [arg0], ["val"], []);
  }

  annotate_products(idxes: Uint32Array): Promise<Seq> {
    return this.callMethod("annotate_products", "obj", [idxes], ["val"], []);
  }

  annotate_matches(idxes: Uint32Array): Promise<Seq> {
    return this.callMethod("annotate_matches", "obj", [idxes], ["val"], []);
  }

  run(arg0: any): Promise<Pcrer> {
    return this.callMethod("run", "obj", [arg0], ["val"], []);
  }
}
