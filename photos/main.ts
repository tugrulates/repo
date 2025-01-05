import { colors } from "@cliffy/ansi/colors";
import { Command } from "@cliffy/command";
import { omit } from "@std/collections/omit";
import { expandGlob } from "@std/fs";
import { join } from "@std/path";
import { OPTIONAL_FIELDS, VARIANT_FIELDS } from "./fields.ts";
import { copyExifToVariants, getPhoto } from "./photo.ts";
import type { Photo } from "./types.ts";

const SOURCE_FILE = "source.jpg";

async function isFile(path: string): Promise<boolean> {
  try {
    const info = await Deno.lstat(path);
    return info.isFile;
  } catch {
    return false;
  }
}

async function* getPhotos(photos: string[]): AsyncGenerator<Photo> {
  if (photos.length === 0) {
    for await (const entry of expandGlob(join("*", SOURCE_FILE))) {
      yield await getPhoto(entry.path);
    }
  }
  for (const photo of photos) {
    if (await isFile(photo)) {
      yield (await getPhoto(photo));
    } else if (await isFile(join(photo, SOURCE_FILE))) {
      yield getPhoto(join(photo, SOURCE_FILE));
    }
  }
}

function check(data: Photo) {
  const result = [];
  for (const [field, value] of Object.entries(omit(data, OPTIONAL_FIELDS))) {
    if (!value) result.push(`missing:${field}`);
  }
  for (const size of data.variants) {
    for (const field in omit(size, VARIANT_FIELDS)) {
      if (field in data) result.push(`${size.src}:${field}`);
    }
  }
  if (result.length) return `[${colors.yellow(result.join(", "))}]`;
  return "";
}

function getCommand() {
  return new Command()
    .name("photos")
    .example("photos", "Lists all photos under current directory.")
    .example("photos [photo] --json", "Data for a photo with all variants.")
    .example("photos [photo] --copy", "Copy EXIF data to all variants.")
    .description("Manage photos.")
    .arguments("[photos...:file]")
    .option("--copy", "Copy the EXIF from source JPG to other variants.")
    .option("--json", "Output the EXIF information as JSON.")
    .action(async ({ copy, json }, ...photos) => {
      for await (let photo of getPhotos(photos)) {
        if (copy) {
          await copyExifToVariants(photo);
          photo = await getPhoto(photo.src);
        }
        if (json) console.log(JSON.stringify(photo));
        else console.log(`🖼  ${photo.title} ${check(photo)}`);
      }
    });
}

/** CLI entrypoint. */
export async function main(): Promise<void> {
  const command = getCommand();
  await command.parse();
}
