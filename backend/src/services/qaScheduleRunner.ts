import { env } from "../config/env.js";
import { runAllDueQaSchedules } from "./qa.js";

let intervalHandle: NodeJS.Timeout | null = null;
let tickRunning = false;

async function runScheduleTick() {
  if (tickRunning) {
    return;
  }

  tickRunning = true;
  try {
    const result = await runAllDueQaSchedules();
    if (result.started > 0) {
      console.log(`Started ${result.started} scheduled QA run(s) from ${result.scanned} due schedule(s).`);
    }
  } catch (error) {
    console.error("Unable to process scheduled QA runs.", error);
  } finally {
    tickRunning = false;
  }
}

export function startQaScheduleRunner() {
  if (env.NODE_ENV === "test" || intervalHandle) {
    return;
  }

  const startupTick = setTimeout(() => {
    void runScheduleTick();
  }, 5000);
  startupTick.unref?.();

  intervalHandle = setInterval(() => {
    void runScheduleTick();
  }, env.QA_SCHEDULE_INTERVAL_MS);
  intervalHandle.unref?.();
}

export function stopQaScheduleRunner() {
  if (!intervalHandle) {
    return;
  }

  clearInterval(intervalHandle);
  intervalHandle = null;
}
