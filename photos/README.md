# photos ([jsr.io](https://jsr.io/@tugrulates/photos))

Managing photos.

## CLI

Run `photos` after installation, or run `deno run -A @tugrulates/photos` without
installation.

### Examples

| Command                     | Description                                   |
| --------------------------- | --------------------------------------------- |
| `photos`                    | Lists for all photos under current directory. |
| `photos [directory] --json` | Data for a photo with all sizes.              |
| `photos [file.jpg] --json`  | Data for a single size file.                  |
| `photos [directory] --copy` | Copy EXIF data to all sizes.                  |

## Types

### [Exif](https://jsr.io/@tugrulates/photos/doc/~/Exif)

Represents the EXIF (Exchangeable Image File Format) metadata of a photo.

This only lists the fields relevant for my photography workflow.

### [Photo](https://jsr.io/@tugrulates/photos/doc/~/Photo)

Represents a photo with additional metadata and sizes.

## Functions

### [allPhotos](https://jsr.io/@tugrulates/photos/doc/~/allPhotos)

Returns a list of all photo directories under cwd.

### [copyExif](https://jsr.io/@tugrulates/photos/doc/~/copyExif)

Copies the EXIF data from source.jpg to all other jpg files.

### [getData](https://jsr.io/@tugrulates/photos/doc/~/getData)

Returns the data for a photo or a single file.

### [getFiles](https://jsr.io/@tugrulates/photos/doc/~/getFiles)

Returns a list of all JPG files in the directory.

### [isPhotoDirectory](https://jsr.io/@tugrulates/photos/doc/~/isPhotoDirectory)

Returns true if the directory contains a source photo.
