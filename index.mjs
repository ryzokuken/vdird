import fs from "fs"
import nodePath from "path"

import ical from "node-ical"
import { Temporal, toTemporalInstant } from "@js-temporal/polyfill"

class VDir {
    /**
    @param {string} path
    */
    constructor(path) {
        if (!fs.statSync(path).isDirectory()) throw Error()
        this.path = path
        this.collections = fs
            .readdirSync(this.path)
            .map(
                (collection) =>
                    new Collection(
                        collection,
                        nodePath.join(this.path, collection)
                    )
            )
    }
}

class Collection {
    /**
     * @param {string} id
     * @param {string} path
     */
    constructor(id, path) {
        this.id = id
        if (!fs.statSync(path).isDirectory()) throw Error()
        this.path = path
        let items = fs.readdirSync(this.path)
        if (items.includes("color")) {
            this.color = fs
                .readFileSync(nodePath.join(this.path, "color"))
                .toString()
            items = items.filter((item) => item != "color")
        } else {
            this.color = null
        }
        if (items.includes("displayname")) {
            this.displayName = fs
                .readFileSync(nodePath.join(this.path, "displayname"))
                .toString()
            items = items.filter((item) => item != "displayname")
        } else {
            this.displayName = null
        }
        this.items = items.map((item) => {
            if (nodePath.extname(item) === ".ics")
                return new ICalendar(nodePath.join(this.path, item))
            else throw Error(`unrecognized file extension for ${item}`)
        })
    }
}

class ICalendar {
    /**
     * @param {string} path
     */
    constructor(path) {
        if (!fs.statSync(path).isFile()) throw Error()
        this.path = path
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
                        throw Error(`invalid tzid ${obj.tzid}`)
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

/**
 * @param {ical.DateWithTimeZone} date
 * @returns {Temporal.ZonedDateTime}
 */
function processDate(date) {
    const { tz } = date
    return toTemporalInstant.call(date).toZonedDateTimeISO(tz || "Etc/UTC")
}

class Event {
    /**
     * @param {ical.VEvent} data
     */
    constructor(data) {
        this.raw = data
        this.uid = data.uid
        this.start = processDate(data.start)
        this.end = processDate(data.end)
    }
}

class Task {
    constructor(data) {
        this.raw = data
        this.uid = data.uid
    }
}

/**
 * @template {{uid: string}} Item
 */
class Registry {
    constructor() {
        /**
         * @type {Map<string, Item>}
         */
        this.data = new Map()
    }

    /**
     * @param {Item} item
     */
    insert(item) {
        if (item.uid === undefined) throw Error("event has no uid")
        this.data.set(item.uid, item)
    }
}

const eventRegistry = new Registry()
const taskRegistry = new Registry()

const vdir = new VDir(process.argv[2])
console.log(vdir)
console.log(eventRegistry)
console.log(taskRegistry)
