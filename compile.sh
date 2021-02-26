#!/bin/sh

# Optionally run a script before compiling the site.
if test -f "./pre_compile.sh"; then
  ./pre_compile.sh
fi


# Compile the website!
python3 -m compile "$@" || exit 1

# Optionally run a script after compiling the site.
if test -f "./post_compile.sh"; then
  ./post_compile.sh
fi
