import fs from "fs"
import path from "path"
import util from "util"

import ical from "node-ical"

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
        this.items = items.map((item) => {
            if (path.extname(item) === ".ics")
                return new ICalendar(path.join(this.path, item))
            else throw Error(`unrecognized file extension for ${item}`)
        })
    }
}

class ICalendar {
    constructor(itemPath) {
        if (!fs.statSync(itemPath).isFile()) throw Error()
        this.path = itemPath
        const parsed = ical.sync.parseICS(fs.readFileSync(this.path).toString())
        this.objects = []
        for (const id in parsed) {
            const obj = parsed[id]
            switch (obj.type) {
                case "VTODO":
                    this.objects.push(new Task(obj))
                    break
                case "VTIMEZONE":
                    this.objects.push(new TimeZone(obj))
                    break
                case "VEVENT":
                    this.objects.push(new Event(obj))
                    break
                default:
                    throw Error(`unrecognized object of type ${obj.type}`)
            }
        }
    }
}

class Event {
    constructor(data) {
        this.raw = data;
    }
}


class Task {
    constructor(data) {
        this.raw = data;
    }
}


class TimeZone {
    constructor(data) {
        this.raw = data;
    }
}

console.log(util.inspect(new VDir(process.argv[2]), { depth: 6 }))
