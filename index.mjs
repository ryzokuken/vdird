import fs from "fs"
import nodePath from "path"

import ICAL from "ical.js"
import { Temporal } from "@js-temporal/polyfill"

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

function processComponent(component) {
    const [name, properties, subcomponents] = component
    switch (name) {
        case "vcalendar":
            subcomponents.forEach((subcomponent) =>
                processComponent(subcomponent)
            )
            break
        case "vevent":
            eventRegistry.insert(new Event(properties))
            break
        case "vtodo":
            taskRegistry.insert(new Task(properties))
            break
        case "vtimezone":
            processTimeZone(properties)
            break
        default:
            throw Error(`unexpected component: ${name}`)
    }
}

function processTimeZone(props) {
    props.forEach((prop) => {
        const [name, params, type, value] = prop
        if (name === "tzid") {
            try {
                new Temporal.TimeZone(value)
            } catch {
                throw Error(`invalid tzid: ${value}`)
            }
        }
    })
}

class ICalendar {
    /**
     * @param {string} path
     */
    constructor(path) {
        if (!fs.statSync(path).isFile()) throw Error()
        this.path = path
        const parsed = ICAL.parse(fs.readFileSync(this.path).toString())
        processComponent(parsed)
    }
}

/**
 * @param {ical.DateWithTimeZone} date
 * @returns {Temporal.ZonedDateTime}
 */
function processDate(date) {
    const [name, params, type, value] = date
    if (type !== "date-time") throw Error(`invalid type: ${type}`)
    const tz = params.tzid || "Etc/UTC"
    try {
        return Temporal.PlainDateTime.from(value).toZonedDateTime(tz)
    } catch {
        return Temporal.Instant.from(value).toZonedDateTimeISO(tz)
    }
}

class Event {
    /**
     * @param {ical.VEvent} data
     */
    constructor(props) {
        this.raw = props
        props.forEach((prop) => {
            const [name, params, type, value] = prop
            switch (name) {
                case "uid":
                    this.uid = value
                    break
                case "dtstart":
                    this.start = processDate(prop)
                case "dtend":
                    this.end = processDate(prop)
                    break
            }
        })
    }
}

class Task {
    constructor(props) {
        this.raw = props
        props.forEach((prop) => {
            const [name, params, type, value] = prop
            switch (name) {
                case "uid":
                    this.uid = value
                    break
                case "dtstart":
                    this.start = processDate(prop)
                case "dtend":
                    this.end = processDate(prop)
                    break
            }
        })
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
