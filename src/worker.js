import "dotenv/config";

import Agenda from "agenda";
import { syncUserData } from "./agenda/sync";
import mongoose from "mongoose";
// import { dbConnection } from "../index";

const isProduction = process.env.NODE_ENV === "production";

// DB Config
const dbConnection = isProduction
  ? process.env.MONGO_URI_PROD
  : process.env.MONGO_URI_DEV;

// Connect to Mongo
mongoose
  .connect(dbConnection, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
  })
  .then(() => {
    console.log("MongoDB Connected...");
    // seedDb();
  })
  .catch((err) => console.log(err));

export const agenda = new Agenda({
  db: {
    address: dbConnection,
    collection: "jobs",
    options: { useNewUrlParser: true, useUnifiedTopology: true },
  },
});

agenda.on("ready", () => {
  console.log("Agenda connected");
  syncUserData(agenda);
  agenda.start();
  agenda.processEvery("1 minute");
});

// agenda.processEvery("5 seconds").start();

async function graceful() {
  await agenda.stop();
  process.exit(0);
}

process.on("SIGTERM", graceful);
process.on("SIGINT", graceful);
