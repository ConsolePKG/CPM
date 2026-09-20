declare module 'content-disposition' {
  const create: (value: string) => string
  export default create
}
declare module 'fs-extra' {
  const fs: any
  export default fs
}
declare module 'serve-static' {
  const serve: any
  export default serve
}
declare module 'semver' {
  export const gte: (version: string, range: string) => boolean
  export const lt: (version: string, range: string) => boolean
  const semver: any
  export default semver
}
