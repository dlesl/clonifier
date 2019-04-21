export type ArgType = "obj" | "val" | "transferable" | "binary" | "obj_array";

export interface CallRequest {
  command: "call";
  callId?: number;
  retType: ArgType;
  specialArgs?: Array<ArgType>;
  fn: string;
  args: Array<any>;
  targetObj?: number;
}

export interface CallResponse {
  command: "call";
  callId: number;
  retType?: ArgType;
  targetType?: string;
  retVal: any;
}

export interface NewRequest {
  command: "new";
  callId?: number;
  specialArgs?: Array<ArgType>;
  className: string;
  args: Array<any>;
}

export interface NewResponse {
  command: "new";
  callId: number;
  targetType: string;
  retVal: number;
}

export interface DeleteRequest {
  command: "delete";
  targetObj: number;
}

export interface DbgLogObjectsRequest {
  command: "log_objects";
}

export interface ErrorResponse {
  command: "error";
  callId: number;
  error: string;
}

// not really a 'Response', but oh well
export interface LogResponse {
  command: "log";
  msg: LogMessage;
}

export interface LogMessage {
  level: string;
  msg: string;
}

export type Request =
  | CallRequest
  | NewRequest
  | DeleteRequest
  | DbgLogObjectsRequest;
export type Response = CallResponse | NewResponse | ErrorResponse | LogResponse;
