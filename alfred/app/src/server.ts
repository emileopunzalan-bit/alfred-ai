import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3001);
const host = String(process.env.HOST ?? "127.0.0.1");

createApp().listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`Alfred Node server listening on http://${host}:${port}`);
});
