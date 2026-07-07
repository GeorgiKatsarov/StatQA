import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { startQaScheduleRunner } from "./services/qaScheduleRunner.js";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`StatQA backend listening on port ${env.PORT}`);
  startQaScheduleRunner();
});
