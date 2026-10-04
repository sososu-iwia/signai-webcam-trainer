import { createServer } from "node:http";
import { createApp } from "./app.js";
import { Store } from "./storage.js";
import { developmentOrigins, developmentPorts } from "../shared/development.js";
const store = new Store(process.env.SIGNAI_DB_PATH || "data/signai.sqlite");
const port = Number(process.env.PORT || developmentPorts.backend);
const server = createServer(
  createApp(store, true, {
    devTools: process.env.SIGNAI_DEV_TOOLS === "1",
    allowedOrigin:
      process.env.SIGNAI_ALLOWED_ORIGIN ||
      (process.env.NODE_ENV === "development"
        ? developmentOrigins.frontend
        : undefined),
  }),
);
server.on("error", (error: Error) => {
  console.error(`SignAI could not start: ${error.message}`);
  store.close();
  process.exitCode = 1;
});
server.listen(port, () =>
  console.log(`SignAI ready at http://localhost:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () =>
    server.close(() => {
      store.close();
      process.exit(0);
    }),
  );
}
