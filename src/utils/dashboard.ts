import express from "express";
import { ExpressAdapter } from "@bull-board/express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { cacheWarmQueue } from "../queues/test.cacheWarm.queue.ts";
import { followersBackfillQueue } from "../queues/followersBackfill.queue.ts";

const app = express();
const port = 4040;

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [
    new BullMQAdapter(cacheWarmQueue),
    new BullMQAdapter(followersBackfillQueue)
  ],
  serverAdapter,
});

app.use("/admin/queues", serverAdapter.getRouter());

app.listen(port, () => {
  console.log(`🚀 Bull Board running at http://localhost:${port}/admin/queues`);
});
