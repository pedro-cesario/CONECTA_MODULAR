#!/bin/sh
set -eu

prepare_writable_dir() {
  target="$1"
  mkdir -p "$target"
  chown -R node:node "$target"
  chmod u+rwx "$target"
}

prepare_writable_dir /home/node/app/auth.sqlite
prepare_writable_dir /home/node/app/data

exec su-exec node "$@"
