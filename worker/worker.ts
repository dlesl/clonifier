import { ErrorResponse, Request, Response, LogResponse } from "./shared";
// slab allocator for IDs, idea from wasm_bindgen :)
const objects = new Array();
let objects_next = 0;

function addObject(obj: any): number {
  if (objects_next === objects.length) {
    objects.push(objects.length + 1);
  }
  const idx = objects_next;
  objects_next = objects[idx];
  objects[idx] = obj;
  return idx;
}

function deleteObject(idx: number) {
  objects[idx] = objects_next;
  objects_next = idx;
}

// represents a Rust panic (fatal)
class Panic extends Error {
  constructor(message: string) {
    super(message);
  }
}

function forwardError(callId: number, error: any) {
  // if the error is a Rust panic, (raised by worker), terminate the worker immediately
  // to prevent any further calls to Rust code (which is now in an undefined state).
  // The error will be caught by the worker's `onerror` handler.
  if (error instanceof Panic) {
    throw error;
  }

  const resp: ErrorResponse = {
    command: "error",
    callId,
    error: error.toString()
  };
  postMessage(resp);
}

// define error handler (this will be called from Rust)
global["workerPanic"] = (msg: string) => {
  // get call stack (inspired by `console_error_panic_hook`)
  const e = new Error();
  msg += `\n\nStack:\n\n${e.stack}\n\nThis is a bug, please report it!`;
  console.error(msg);
  throw new Panic(msg);
};

// log message handler (called from Rust)
global["logMessage"] = (level: string, msg: string) => {
  const log_msg: LogResponse = { command: "log", msg: { level, msg } };
  postMessage(log_msg);
};

// we need to define `onmessage` here, in case any calls are made before the wasm module has loaded
// we just store any messages that arrive and process them later.
let queuedMessages: any[] = [];
onmessage = e => {
  queuedMessages.push(e);
};

import("../rust/pkg").then(api => {
  api.init(); // initialise panic handler
  onmessage = e => {
    const req: Request = e.data;
    switch (req.command) {
      case "call":
      case "new":
        {
          let res: any;
          let { args } = req;
          const { specialArgs } = req;
          if (specialArgs) {
            args = args.map((a, idx) => {
              switch (specialArgs[idx]) {
                case "binary":
                  return new Uint8Array(a);
                case "obj":
                  return objects[a._id];
                default:
                  return a;
              }
            });
          }
          try {
            if (req.command === "call") {
              const target =
                req.targetObj === undefined ? api : objects[req.targetObj];
              res = target[req.fn](...args);
            } else {
              res = new api[req.className](...args);
            }
          } catch (e) {
            forwardError(req.callId, e);
            return;
          }
          // In case we got a promise:
          Promise.resolve(res)
            .then(val => {
              let res = val;
              let transfer: Transferable[];
              let targetType;
              if (req.command === "new" || req.retType === "obj") {
                res = addObject(val);
                targetType = val.constructor.name;
              } else if (req.retType === "obj_array") {
                res = val.map(v => addObject(v));
                if (val.length) {
                  targetType = val[0].constructor.name;
                } // TODO: fixme?
              } else if (req.retType === "binary") {
                res = (val as Uint8Array).buffer;
                transfer = [res];
              }
              let resp: Response;
              if (req.command === "call") {
                resp = {
                  command: "call",
                  callId: req.callId,
                  retType: req.retType,
                  retVal: res,
                  targetType
                };
              } else {
                resp = {
                  command: "new",
                  callId: req.callId,
                  retVal: res,
                  targetType
                };
              }
              postMessage(resp, transfer);
            })
            .catch(e => forwardError(req.callId, e));
        }
        break;
      case "delete":
        deleteObject(req.targetObj);
        break;
      case "log_objects":
        for (const o of objects) {
          if (typeof o !== "number") {
            console.log(o);
          }
        }
        break;
    }
  };

  // now process any queued messages
  for (const e of queuedMessages) {
    onmessage.call(global, e);
  }
  queuedMessages = undefined;
});
