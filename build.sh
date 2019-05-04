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
