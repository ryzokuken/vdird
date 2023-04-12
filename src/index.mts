import VDir from "./vdir.mjs"

const vdir = new VDir(process.argv[2])
const start = process.argv[3]
const end = process.argv[4]
console.log(vdir.between(start, end))
