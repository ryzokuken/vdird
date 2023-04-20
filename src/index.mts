import VDir from "./vdir.mjs";
import http from "http";
// import util from "util";

const host = "localhost";
const port = 8007;

const vdir = new VDir(process.argv[2]);
//const start = process.argv[3]
//const end = process.argv[4]
const start = "2000-01-01";
const end = "2030-01-01";

const requestListener = function (
  req: http.IncomingMessage,
  res: http.ServerResponse
) {
  res.setHeader("Content-Type", "application/json");
  switch (req.url) {
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
  //console.log(util.inspect(vdir, { depth: 5 }));
  //console.log(vdir.between(start, end))
});
