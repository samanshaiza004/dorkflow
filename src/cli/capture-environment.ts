import { resolve } from "node:path";
import { writeEnvironment } from "../environment/capture.ts";

const root = resolve(import.meta.dirname, "../..", "benchmarks");
const fonts = process.argv[2] ? resolve(process.argv[2]) : resolve(root, "calibration/uswds-v3.14.0/source/package/dist/fonts");
const output = process.argv[3] ? resolve(process.argv[3]) : resolve(root, "rendering-environment.json");

const environment = await writeEnvironment(output, fonts);
console.log(`Captured rendering environment ${environment.environmentSha256}`);
