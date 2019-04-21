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

const worker = new Worker("worker.js");

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

// if the worker fails, bail
worker.onerror = ev =>
  onError(
    "Worker failed\n" + ev ? `${ev.filename}:${ev.lineno} : ${ev.message}` : ""
  );

// slab allocator containing `[resolve, reject]` for every pending call.
// data structure implementation stolen from wasm_bindgen :)

const calls = [];
let calls_next = 0;

export function dbgPendingCalls(): number {
  return calls.filter(v => typeof v !== "number").length;
}

export function dbgLogObjects() {
  const req: DbgLogObjectsRequest = { command: "log_objects" };
  worker.postMessage(req);
}

function onDone(idx: number, success: boolean, res: any) {
  const fn = calls[idx][success ? 0 : 1];
  calls[idx] = calls_next;
  calls_next = idx;
  fn(res); // resolve/reject promise
}

export function workerDeleteObj(obj: workerShims.RemoteObj) {
  const req: DeleteRequest = { command: "delete", targetObj: obj.id };
  worker.postMessage(req);
}

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

worker.onmessage = e => {
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
  }
};
