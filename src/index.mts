import VDir from "./vdir.mjs";
import http from "node:http";
import { URL } from "node:url";

const host = "localhost";
const port = 8007;

const vdir = new VDir(process.argv[2]);

const requestListener = function (
  req: http.IncomingMessage,
  res: http.ServerResponse
) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  switch (url.pathname) {
    case "/":
      res.writeHead(200);
      res.end(JSON.stringify(vdir));
      break;
    case "/all/":
      res.writeHead(200);
      res.end(JSON.stringify(vdir.all()));
      break;
    case "/between/":
      res.writeHead(200);
      const start = url.searchParams.get("start") as string;
      const end = url.searchParams.get("end") as string;
      res.end(JSON.stringify(vdir.between(start, end)));
      break;
    default:
      res.writeHead(404);
      res.end(JSON.stringify({ error: "not found" }));
  }
};

const server = http.createServer(requestListener);
server.listen(port, host, () => {
  console.log(`Server is running on http://${host}:${port}`);
});
