import Agenda from "agenda";
import { syncUserData } from "./sync";
// import { dbConnection } from "../index";

const isProduction = process.env.NODE_ENV === "production";

// DB Config
const dbConnection = isProduction
  ? process.env.MONGO_URI_PROD
  : process.env.MONGO_URI_DEV;

const agenda = new Agenda({
  db: {
    address: dbConnection,
    collection: "jobs",
    options: { useNewUrlParser: true, useUnifiedTopology: true },
  },
});

syncUserData(agenda);

export default agenda;
