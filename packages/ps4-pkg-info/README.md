# ps4-pkg-info

Get information (paramSfo and icon0) from a PlayStation 4 PKG file

## Features

- Support generate paramSfo and icon0 data
- Support Nodejs and Browser
- Full type definition

## Install

```bash
npm i @njzy/ps4-pkg-info
```

## Usage

```ts
// nodejs
import { getPs4PkgInfo } from '@njzy/ps4-pkg-info'
// browser
import { getPs4PkgInfo } from '@njzy/ps4-pkg-info/web'

getPs4PkgInfo('nodejs: filePath or browser: fileUrl')
  .then((res) => {
    console.log(res)
  })
  .catch((err) => {
    console.error(err)
  })
```

### Options

- generateParamSfo - true
- generateIcon0 - true
- generateBase64Icon - false

## Thanks

The main implementation principle of this project is derived from the following projects:

- [psdevwiki](https://www.psdevwiki.com/ps4/Package_Files)
- [dexter85/ps4-pkg-info](https://github.com/dexter85/ps4-pkg-info)
- [flatz/ps4_remote_pkg_installer](https://github.com/flatz/ps4_remote_pkg_installer)

## Optional artwork and trophies

`getPs4PkgInfo` retains its existing defaults (PARAM.SFO and ICON0 only).
Both Node and web entry points additionally export `getPs4PkgArtwork(pathOrUrl)`
and `getPs4PkgTrophies(pathOrUrl)`. Web calls accept `{ signal: AbortSignal }`.
Artwork returns an array of actual image entries `{ id, name, size }`, discovered
from the filename table with standard ID name fallbacks (including localized variants).
Listing reads no image bodies. Call `getPs4PkgArtworkImage(pathOrUrl, id)` to load
one image (16 MiB maximum); it returns `ready` with `{ url, extension, preview }`,
`missing`, or `unavailable` (unsupported encryption). PNG/JPEG/WebP/GIF/BMP can
be previewed; DDS can be exported. File type is validated from its signature.
Only PKG resource entries are listed, not embedded PFS textures or TRP icons.
Trophy results use the same resource status and include names, descriptions, grades, hidden flags,
groups, and PNG icons. These are package definitions, not player progress.

Trophy parsing reads trophy00.trp
(0x1400), TRP versions 1–3, plaintext XML/SFM and AES-128-CBC ESFM metadata.
NPWR is resolved from npbind.dat / nptitle.dat, including encrypted entries in
standard zero-passcode FPKGs. Derived keys must match the ENTRY_KEYS digest
before decryption; ciphertext reads include the final aligned AES block.
Multiple bound NPWR candidates (up to 16) are checked against ESFM decryption,
the zero prefix and XML identity; only a unique validated match is accepted.
Retail/custom-passcode encryption requiring other keys remains unsupported. If metadata
cannot be decoded, readable trophy icons remain available with a warning.
`getPs4PkgTrophies` accepts `{ language: 'default' | '09' | '10' | ... }`
(default: `default`). Results expose the languages actually present in the TRP.
Language-specific TROP_nn XML/SFM/ESFM entries are parsed only when selected;
missing or damaged selected text is reported rather than silently substituted.
Additional trophy archives are not yet supported.

The browser requires HTTP Range support and CORS. Requests preserve query
parameters and Basic authentication, reject full-file responses, and stop on
abort/timeout. Resource and table sizes are bounded; XML DTDs/entities are
rejected. The format was cross-checked against
[PkgViewer](https://github.com/pearlxcore/PkgViewer) and
[OrbisPkgTool](https://github.com/pearlxcore/OrbisPkgTool); this implementation uses
TypeScript with @noble/ciphers and fast-xml-parser, not their C# runtime.
