#!/usr/bin/env bash

# `npm ls --prod --parseable`
mkdir -p build
zip -r build/action.zip node_modules app.js action.js package.json lib/*