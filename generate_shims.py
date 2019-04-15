#!/usr/bin/python3
# The output will need manual curation!

import re

lines = open("rust/pkg/clonifier.d.ts").readlines()
class_def = re.compile("export class (.+) {")
fn_def = re.compile(r"export function ([^\s]+)\((.*)\): (.+);")
method_def = re.compile(r"([^\s]+)\((.*)\): (.+);")
constructor_def = re.compile(r"constructor\(\);")  # TODO
promise = re.compile("Promise<(.+)>")
arg_re = re.compile("(.+): (.+)")
arg_types = {"Uint8Array": "binary"}

for line in lines:
    # find class definitions, save the name
    res = class_def.search(line)
    if res:
        class_name = res.group(1)
        arg_types[class_name] = "obj"

def parse_fn(name, args, ret_type, pre, call):
    if name == "free":  # free is special-cased and implemented by RemoteObj
        return
    p_type = promise.search(ret_type)
    if p_type:
        ret_type = p_type.group(1)
    ret_handling = arg_types.get(ret_type, "val")
    post = ""
    if ret_handling == "binary":
        post = ".then(ab => new Uint8Array(ab))"
    ret_type = "Promise<{}>".format(ret_type)
    arg_handling = []
    arg_names = []
    arg_in_types = []
    transfer = []

    if len(args):
        for a in args.split(", "):
            (arg_name, arg_ty) = arg_re.search(a).groups()
            arg_handling.append('"' + arg_types.get(arg_ty, "val") + '"')
            arg_names.append(arg_name)
            if arg_ty == "Uint8Array":
                arg_ty = "ArrayBuffer"
                transfer.append(arg_name)
            arg_in_types.append(arg_ty)

    args_in = []
    for a in zip(arg_names, arg_in_types):
        args_in.append("{}: {}".format(*a))

    print(
        '{} {}({}): {} {{ \
        return {}("{}", "{}", [{}], [{}], [{}]){}; \
        }}'.format(
            pre,
            name,
            ", ".join(args_in),
            ret_type,
            call,
            name,
            ret_handling,
            ", ".join(arg_names),
            ", ".join(arg_handling),
            ", ".join(transfer),
            post,
        )
    )

cur_class = ""
for line in lines:
    # find class definitions, save the name
    res = class_def.search(line)
    if res:
        cur_class = res.group(1)
        print("export class {} extends RemoteObj {{".format(cur_class))
        continue
    res = fn_def.search(line)
    if res:
        parse_fn(*res.groups(), "export function", "workerCall")
        continue
    res = method_def.search(line)
    if res:
        parse_fn(*res.groups(), "", "this.callMethod")
        continue
    print(line)
