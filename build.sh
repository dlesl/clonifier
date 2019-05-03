#!/bin/sh
set -e

# clean up
rm -rf dist
mkdir -p dist/tmp
rm -rf rust/pkg

# build app
webpack --config webpack.prod.js
# build .gb -> .bin converter
webpack --config webpack.templates.js
# convert .gb -> .bin
node dist/tmp/build_templates.js
rm -rf dist/tmp

# build no-wasm backup

## build binaryen
mkdir binaryen_build || true
cd binaryen_build
cmake ../binaryen
make -j 4 wasm2js
cd ..
WASM2JS=binaryen_build/bin/wasm2js

#wasm-pack build --release rust
$WASM2JS rust/pkg/clonifier_bg.wasm -o rust/pkg/clonifier_bg.js
# delete wasm so as not to confuse webpack
rm rust/pkg/clonifier_bg.wasm
webpack --config webpack.wasm2js.js
# delete the generated js or it will overwhelm webpack next time it runs ;)
rm -rf rust/pkg