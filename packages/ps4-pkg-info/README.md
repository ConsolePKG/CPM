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
