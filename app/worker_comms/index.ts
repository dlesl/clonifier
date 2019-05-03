import {
  ArgType,
  CallRequest,
  DeleteRequest,
  NewRequest,
  Response,
  DbgLogObjectsRequest,
  LogMessage
} from "../../worker/shared";
import * as workerShims from "./worker_shims";

const WASM_URL = "worker.js";
const BACKUP_URL = "worker_wasm2js.js";


/** This function creates a message handler that stores all messages
 *  received until `setHandler` is called. At this point, the queued
 *  messages are passed to the handler and any further messages are
 *  forwarded directly to the handler. This allows us to have one
 *  global instance of the worker, while avoiding any dependency on
 *  the consumer or the need for the consumer to call `init` or
 *  similar.
 */

function handlerQueueUntilSet<T>(): [
  ((e: T) => void),
  (handler: (e: T) => void) => void
] {
  let queue = new Array<T>();
  let _handler = null;
  const handler = (e: T) => {
    if (_handler) {
      _handler(e);
    } else {
      queue.push(e);
    }
  };
  const setHandler = (h: (e: T) => void) => {
    _handler = h;
    if (queue) {
      for (const e of queue) {
        _handler(e);
      }
      queue = null;
    }
  };
  return [handler, setHandler];
}

const [onError, setOnError] = handlerQueueUntilSet<string>();
export const setErrorHandler = setOnError;

const [onLogMessage, setOnLogMessage] = handlerQueueUntilSet<LogMessage>();
export const setLogHandler = setOnLogMessage;

// this allows us to distinguish errors loading the worker
// from runtime errors that occur later
let workerDidLoad = false;
let workerIsBackup = false;

// Catches catastrophic errors in the worker:
// - code parsing/webassembly loading errors
// - rust panics
// These errors are non-recoverable and render the worker unusable.
const workerOnError = ev => {
  if (!workerDidLoad && !workerIsBackup) {
      onLogMessage({level: "WARN", msg: "Failed loading worker, falling back to wasm2js. Error was: " + ev.message});
      setWorker(new Worker(BACKUP_URL));
      workerIsBackup = true;
  } else {
    onError(
      "Worker failed\n" + ev
        ? `${ev.filename}:${ev.lineno} : ${ev.message}`
        : ""
    );
  }
};

const workerOnMessage = e => {
  const resp: Response = e.data;
  switch (resp.command) {
    case "call":
      {
        let retVal = resp.retVal;
        if (resp.retType === "obj") {
          retVal = new workerShims[resp.targetType](resp.retVal);
        } else if (resp.retType === "obj_array") {
          retVal = retVal.map(v => new workerShims[resp.targetType](v));
        }
        onDone(resp.callId, true, retVal);
      }
      break;
    case "new":
      {
        const retVal = new workerShims[resp.targetType](resp.retVal);
        onDone(resp.callId, true, retVal);
      }
      break;
    case "error":
      {
        onDone(resp.callId, false, resp.error);
      }
      break;
    case "log":
      {
        onLogMessage(resp.msg);
      }
      break;
    case "ready":
      {
        workerDidLoad = true;
      }
      break;
  }
};

let worker: Worker;
const setWorker = (w: Worker) =>  {
    if (worker) {
        worker.onerror = null;
        worker.onmessage = null;
    }
    w.onerror = workerOnError;
    w.onmessage = workerOnMessage;
    worker = w;
};

setWorker(new Worker(WASM_URL)); // try this first

// slab allocator containing `[resolve, reject]` for every pending call.
// data structure implementation stolen from wasm_bindgen :)

const calls = [];
let calls_next = 0;

function onDone(idx: number, success: boolean, res: any) {
  const fn = calls[idx][success ? 0 : 1];
  // remove pending call
  calls[idx] = calls_next;
  calls_next = idx;
  // resolve/reject promise
  fn(res);
}

/** How many worker calls have not yet returned? */
export function dbgPendingCalls(): number {
  return calls.filter(v => typeof v !== "number").length;
}

/** Tell the worker to log all existing proxied objects (to
 * console) */
export function dbgLogObjects() {
  const req: DbgLogObjectsRequest = { command: "log_objects" };
  worker.postMessage(req);
}

/** Tell the worker to forget an object (note, this doesn't free the
 * object. You shouldn't call this directly, use `RemoteObj.free`) */
export function workerDeleteObj(obj: workerShims.RemoteObj) {
  const req: DeleteRequest = { command: "delete", targetObj: obj.id };
  worker.postMessage(req);
}

/** Send a response-requiring request to the worker, and return a
 * Promise that resolves upon its completion. You probably don't want
 * to call this directly. Intended for use by the shims in
 * worker_shims.ts */
export function workerRequest(
  req: NewRequest | CallRequest,
  transfer?: Transferable[]
): Promise<any> {
  if (calls_next === calls.length) {
    calls.push(calls.length + 1);
  }
  const idx = calls_next;
  calls_next = calls[idx];
  const p = new Promise((resolve, reject) => (calls[idx] = [resolve, reject])); // callback gets executed before return
  req.callId = idx;
  worker.postMessage(req, transfer);
  return p;
}

export function workerCall(
  fn: string,
  retType: ArgType,
  args: any[],
  specialArgs?,
  transfer?: Transferable[]
): Promise<any> {
  return workerRequest(
    { fn, args, specialArgs, command: "call", retType },
    transfer
  );
}
