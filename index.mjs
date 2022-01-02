import fs from "fs"
import path from "path"
import util from "util"

class VDir {
    constructor(vDirPath) {
        if (!fs.statSync(vDirPath).isDirectory()) throw Error()
        this.path = vDirPath
        this.collections = fs
            .readdirSync(this.path)
            .map(
                (collection) =>
                    new Collection(collection, path.join(this.path, collection))
            )
    }
}

class Collection {
    constructor(id, collectionPath) {
        this.id = id
        if (!fs.statSync(collectionPath).isDirectory()) throw Error()
        this.path = collectionPath
        let items = fs.readdirSync(this.path)
        if (items.includes("color")) {
            this.color = fs
                .readFileSync(path.join(this.path, "color"))
                .toString()
            items = items.filter((item) => item != "color")
        } else {
            this.color = null
        }
        if (items.includes("displayname")) {
            this.displayName = fs
                .readFileSync(path.join(this.path, "displayname"))
                .toString()
            items = items.filter((item) => item != "displayname")
        } else {
            this.displayName = null
        }
        this.items = items;
    }
}

console.log(util.inspect(new VDir(process.argv[2]), { depth: 3 }))
