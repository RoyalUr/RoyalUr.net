#!/bin/bash

# Compile to a release build
python3 -m compile "$@" || exit 1
