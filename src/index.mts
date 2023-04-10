import VDir from "./vdir.mjs"

const vdir = new VDir(process.argv[2])
console.log((await import("util")).inspect(vdir, { depth: 5 }))
