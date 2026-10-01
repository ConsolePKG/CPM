/** OS/NAS metadata is not a package, including sidecars named *.pkg. */
export function isSystemMetadataPath(path: string) {
  return path
    .split(/[\\/]/)
    .some(
      (name) => name.startsWith('._') || ['.DS_Store', '__MACOSX', '@eaDir', 'Thumbs.db', 'desktop.ini'].includes(name),
    )
}
