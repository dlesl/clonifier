# Clonifier
This is a web app that lets you view DNA sequences in Genbank (`.gb`) format and simulate PCR and DNA assembly methods such as Gibson Assembly.

## Notes
All of the work is done by the 'backend' which is written in Rust and runs in a web worker. Because of this, every request to the Rust backend is asynchronous and returns a promise (see `app/worker_comms` for details). To keep things feeling snappy and avoiding excessive 'loading' indicators, the frontend makes use of React's upcoming Suspense feature. In short, views can "throw promises" during rendering, and React will delay rendering until the promise resolves.

Once WebAssembly threads become available, it should be possible to avoid most of this complexity!

The code in `/rust` in this repository is mostly just glue code, the 
actual work is done in [`gb-io`](https://github.com/dlesl/gb-io), [`pcr`](https://github.com/dlesl/pcr) and [`assembly`](https://github.com/dlesl/assembly).