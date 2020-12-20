import "dotenv/config";
import session from "express-session";
import express from "express";
import mongoose from "mongoose";
import http from "http";
import https from "https";
import { readFileSync } from "fs";
import { resolve, join } from "path";
import passport from "passport";
import cookieParser from "cookie-parser";
import all_routes from "express-list-endpoints";

import WebSocket from "ws";

import routes from "./routes";

const app = express();
const sessionParser = session({
  // name: "session",
  secret: process.env.COOKIE_KEY,
  resave: true,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 100 },
});
app.use(sessionParser);

app.use(cookieParser());

// Bodyparser Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(passport.initialize());
app.use(passport.session());
require("./services/jwtStrategy");

require("./services/twitterStrategy");

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

// Use Routes
app.use("/", routes);

const httpsOptions = {
  key: readFileSync(resolve(__dirname, "../security/cert.key")),
  cert: readFileSync(resolve(__dirname, "../security/cert.pem")),
};
const port = process.env.PORT || (isProduction ? 54870 : 5000);
const server = isProduction
  ? http
      .createServer(app)
      .listen(port, () => console.log(`Server started on port ${port}`))
  : https.createServer(httpsOptions, app).listen(port, () => {
      console.log("https server running at " + port);
    });

const wss = new WebSocket.Server({ noServer: true });
app.set("wss", wss);

let id = 0;
let lookup = {};
app.locals.lookup = lookup;
server.on("upgrade", function (request, socket, head) {
  sessionParser(request, {}, () => {
    if (!request.session?.passport?.user) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, function done(ws) {
      ws.id = request.session.passport.user;
      if (lookup[ws.id]) {
        lookup[ws.id].add(ws);
      } else {
        lookup[ws.id] = new Set();
        lookup[ws.id].add(ws);
      }
      ws.on("close", () => {
        lookup[ws.id].delete(ws);
      });
    });
  });
});
