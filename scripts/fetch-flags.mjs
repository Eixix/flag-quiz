import { execFile } from "node:child_process";
import { mkdir, readFile, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const answersPath = join(projectRoot, "src/res/countryFlags.json");
const outputDirectory = join(projectRoot, "public/flags");
const answers = JSON.parse(await readFile(answersPath, "utf8"));
const codes = Object.keys(answers).map((code) => code.toLowerCase()).sort();
const run = promisify(execFile);

await mkdir(outputDirectory, { recursive: true });

// Download into temporary files so an interrupted refresh does not leave
// partially written SVGs that still look valid to the application.
async function download(code) {
  const destination = join(outputDirectory, `${code}.svg`);
  const temporary = `${destination}.tmp`;
  await run("curl", [
    "--fail", "--silent", "--show-error",
    "--retry", "4", "--retry-all-errors",
    "--connect-timeout", "20", "--max-time", "90",
    `https://flagcdn.com/${code}.svg`,
    "--output", temporary,
  ]);
  const svg = await readFile(temporary, "utf8");
  if (!/^\s*<svg[\s>]/i.test(svg)) throw new Error(`${code}: response is not an SVG`);
  await rename(temporary, destination);
}

try {
  // A small worker pool is polite to the CDN and considerably faster than 250
  // sequential requests.
  const queue = [...codes];
  const workers = Array.from({ length: 6 }, async () => {
    while (queue.length) await download(queue.shift());
  });
  await Promise.all(workers);
} catch (error) {
  await Promise.all(codes.map((code) => rm(join(outputDirectory, `${code}.svg.tmp`), { force: true })));
  throw error;
}

console.log(`Downloaded ${codes.length} SVG flags from flagcdn.com`);
