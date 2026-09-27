# ブラウザー用AVIF変換器

アプリの画像保存・寿命管理は [アーキテクチャ](architecture.md)、入力形式・上限・編集操作は [文書仕様](tiptap-document-spec-v1.md) 第13.1節を参照してください。以下は同梱変換器のソースと再ビルド手順です。

Both still images and GIF sequences use [encoder.c](../scripts/image-codec/encoder.c) and the same libavif / libaom
WebAssembly module. Still images use `AVIF_ADD_IMAGE_FLAG_SINGLE`. The wrapper
accepts RGBA pixels only; source EXIF, XMP and other metadata never enter it.
GIF decoding and disposal composition happen in the worker with gifuct-js.

Checked-in outputs are `public/codecs/avif-encoder.{js,wasm}`. Ordinary application
builds need no native compiler. To rebuild, activate Emscripten 6.0.10 and run
[scripts/build-image-codec.sh](../scripts/build-image-codec.sh) from the repository root. CMake and Git are required;
dependencies and intermediate outputs are confined to `.cache/avif-build`.

Sources used for these outputs:

- [libavif v1.4.2](https://github.com/AOMediaCodec/libavif/tree/v1.4.2), commit
  `c5240fc79fe5c2407e10afd35f5505ef6333ea49`.
- [libaom v3.14.1](https://aomedia.googlesource.com/aom/+/refs/tags/v3.14.1), commit
  `03087864cf4bea6abb0d28f95cf7843511413d8f`, selected by libavif's LOCAL AOM CMake recipe.
- [Emscripten 6.0.10](https://github.com/emscripten-core/emscripten/releases/tag/6.0.10).

The accompanying libavif and libaom licenses and libaom patent notice are copied
into `public/codecs` by the build script. Compilation uses a single-threaded
encoder, grows WASM memory up to 512 MiB, and needs no cross-origin isolation.
