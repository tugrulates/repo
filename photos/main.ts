import { colors } from "@cliffy/ansi/colors";
import { Command } from "@cliffy/command";
import { copyExif, getData } from "./exif.ts";
import { allPhotos } from "./file.ts";
import type { Photo } from "./types.ts";

/**
 * Returns a warning message if the photo is missing required fields.
 *
 * @param data Photo data to check.
 * @returns Message with the following text: [⚠️ warnings...].
 */
function check(data: Photo) {
  const result = [];
  for (
    const field of [
      "title",
      "description",
      "keywords",
      "date",
      "location",
      "camera",
      "lens",
    ] as const
  ) {
    if (!data[field]) result.push(field);
  }
  if (!data.title) result.push("title");
  if (!data.description) result.push("description");
  if (!data.keywords) result.push("keywords");
  if (!data.date) result.push("date");
  if (!data.location) result.push("location");
  if (!data.camera) result.push("camera");
  if (!data.lens) result.push("lens");
  if (!data.sizes.every((size) => size.sameExif)) result.push("inconsistent");
  if (result.length) return `[${colors.yellow(result.join(", "))}]`;
  return "";
}

function getCommand() {
  return new Command()
    .name("photos")
    .example("photos", "Lists for all photos under current directory.")
    .example("photos [directory] --json", "Data for a photo with all sizes.")
    .example("photos [file.jpg] --json", "Data for a single size file.")
    .example("photos [directory] --copy", "Copy EXIF data to all sizes.")
    .description("Manage photos.")
    .arguments("[photos...:file]")
    .option("--copy", "Copy the EXIF from source jpg file to other jpg files.")
    .option("--json", "Output the EXIF information as JSON.")
    .action(async ({ copy, json }, ...photos) => {
      for await (const photo of (photos.length > 0 ? photos : allPhotos())) {
        let data = await getData(photo);
        if (copy) {
          await copyExif(photo);
          data = await getData(photo);
        }
        if (json) console.log(JSON.stringify(data));
        else console.log(`🖼  ${data.title} ${check(data)}`);
      }
    });
}

/** CLI entrypoint. */
export async function main(): Promise<void> {
  const command = getCommand();
  await command.parse();
}
