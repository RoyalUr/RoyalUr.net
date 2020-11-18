#!/bin/sh

python3 -m compile "$@" || exit 1

if test -f "./post_compile.sh"; then
  ./post_compile.sh
fi
