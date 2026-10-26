/**
 * Javy/WASM entry point.
 *
 * Keep this module's only export as a zero-argument `main`: Javy rejects exported
 * functions with parameters. The workflow itself lives in workflow.ts.
 */
import { Runner } from "@chainlink/cre-sdk";
import { initWorkflow, type Config } from "./workflow";

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}
