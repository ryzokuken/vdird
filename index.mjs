import fs from "fs"
import path from "path"
import util from "util"

import ical from "node-ical"
import { Temporal, toTemporalInstant } from "@js-temporal/polyfill"

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
            if (obj.uid && obj.uid !== id) console.warn("uid mismatch")
            this.objects.push(obj.uid)
            switch (obj.type) {
                case "VTODO":
                    taskRegistry.insert(new Task(obj))
                    break
                case "VTIMEZONE":
                    try {
                        Temporal.TimeZone.from(obj.tzid) // check if tzid is valid
                    } catch {
                        throw Error(`invalid tzid ${tzid}`)
                    }
                    break
                case "VEVENT":
                    eventRegistry.insert(new Event(obj))
                    break
                default:
                    throw Error(`unrecognized object of type ${obj.type}`)
            }
        }
    }
}

function processDate(date) {
    const { tz } = date
    return toTemporalInstant.call(date).toZonedDateTimeISO(tz || "Etc/UTC")
}

class Event {
    constructor(data) {
        this.raw = data
        this.uid = data.uid
        this.start = processDate(data.start)
        this.end = processDate(data.end)
    }
}

class Registry {
    constructor() {
        this.data = new Map()
    }

    insert(item) {
        if (item.uid === undefined) throw Error("event has no uid")
        this.data.set(item.uid, item)
    }
}

const eventRegistry = new Registry()
const taskRegistry = new Registry()
// const timeZoneRegistry = new Registry()

class Task {
    constructor(data) {
        this.raw = data
        this.uid = data.uid
    }
}

class TimeZone {
    constructor(data) {
        this.raw = data
    }
}

const vdir = new VDir(process.argv[2])
console.log(vdir)
console.log(eventRegistry)
console.log(taskRegistry)
// console.log(timeZoneRegistry)
