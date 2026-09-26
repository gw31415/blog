#!/usr/bin/env bash
set -euo pipefail
# Activate Emscripten 6.0.10 before running. Build artifacts are checked in so
# normal dev/build never downloads a compiler or builds native dependencies.
repo_dir=$(cd "$(dirname "$0")/.." && pwd)
build_root="$repo_dir/.cache/avif-build"
source_dir="$build_root/libavif"
if [ ! -d "$source_dir/.git" ]; then
  git clone --depth 1 --branch v1.4.2 https://github.com/AOMediaCodec/libavif.git "$source_dir"
fi
if [ "$(git -C "$source_dir" rev-parse HEAD)" != c5240fc79fe5c2407e10afd35f5505ef6333ea49 ]; then
  echo 'Unexpected libavif source revision' >&2
  exit 1
fi
emcmake cmake -S "$source_dir" -B "$build_root/build" \
  -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF \
  -DAVIF_CODEC_AOM=LOCAL -DAVIF_CODEC_AOM_DECODE=OFF -DAVIF_LIBYUV=OFF \
  -DAVIF_BUILD_APPS=OFF -DAVIF_BUILD_TESTS=OFF -DAOM_TARGET_CPU=generic \
  -DCONFIG_MULTITHREAD=0 -DENABLE_NASM=OFF
cmake --build "$build_root/build" --parallel 8
if [ "$(git -C "$build_root/build/_deps/libaom-src" rev-parse HEAD)" != 03087864cf4bea6abb0d28f95cf7843511413d8f ]; then
  echo 'Unexpected libaom source revision' >&2
  exit 1
fi
mkdir -p "$repo_dir/public/codecs"
emcc "$repo_dir/scripts/image-codec/encoder.c" \
  -I "$source_dir/include" "$build_root/build/libavif.a" \
  "$build_root/build/_deps/libaom-build/libaom.a" \
  -O3 -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=worker \
  -sALLOW_MEMORY_GROWTH=1 -sMAXIMUM_MEMORY=536870912 -sSTACK_SIZE=5242880 -sFILESYSTEM=0 \
  -sEXPORTED_FUNCTIONS='["_malloc","_free"]' \
  -sEXPORTED_RUNTIME_METHODS='["HEAPU8"]' \
  -o "$repo_dir/public/codecs/avif-encoder.js"
cp "$source_dir/LICENSE" "$repo_dir/public/codecs/LICENSE-libavif.txt"
cp "$build_root/build/_deps/libaom-src/LICENSE" "$repo_dir/public/codecs/LICENSE-libaom.txt"
cp "$build_root/build/_deps/libaom-src/PATENTS" "$repo_dir/public/codecs/PATENTS-libaom.txt"
