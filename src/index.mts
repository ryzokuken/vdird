import fs from "fs"
import nodePath from "path"

import ICAL from "ical.js"
import { Temporal } from "@js-temporal/polyfill"

class Registry {
    data: Map<string, Item>

    constructor() {
        this.data = new Map()
    }

    insert(item: Item) {
        if (item.uid === undefined) throw Error("event has no uid")
        this.data.set(item.uid, item)
    }
}

class VDir {
    eventRegistry: Registry
    taskRegistry: Registry
    path: string
    collections: Collection[]

    constructor(path: string) {
        if (!fs.statSync(path).isDirectory()) throw Error() // TODO: add a better error code
        this.eventRegistry = new Registry()
        this.taskRegistry = new Registry()
        this.path = path
        this.collections = fs
            .readdirSync(this.path)
            .map(
                (collection) =>
                    new Collection(
                        collection,
                        nodePath.join(this.path, collection),
                        this.eventRegistry,
                        this.taskRegistry
                    )
            )
    }
}

class Collection {
    id: string
    path: string
    color?: string
    displayName?: string

    constructor(id: string, path: string, eventRegistry: Registry, taskRegistry: Registry) {
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
            this.color = undefined
        }
        if (items.includes("displayname")) {
            this.displayName = fs
                .readFileSync(nodePath.join(this.path, "displayname"))
                .toString()
            items = items.filter((item) => item != "displayname")
        } else {
            this.displayName = undefined
        }
        items.forEach((item) => {
            const filePath = nodePath.join(this.path, item)
            if (!fs.statSync(filePath).isFile()) throw Error() // TODO: add a better error code
            if (nodePath.extname(item) === ".ics") {
                processComponent(
                    ICAL.parse(fs.readFileSync(filePath).toString()),
                    eventRegistry,
                    taskRegistry
                )
            } else throw Error(`unrecognized file extension for ${item}`)
        })
    }
}

function processComponent(component: any, eventRegistry: Registry, taskRegistry: Registry) {
    const [name, properties, subcomponents] = component
    switch (name) {
        case "vcalendar":
            subcomponents.forEach((component) =>
                processComponent(component, eventRegistry, taskRegistry)
            )
            break
        case "vevent":
            eventRegistry.insert(new Item(properties))
            break
        case "vtodo":
            taskRegistry.insert(new Item(properties))
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

function processDate(date) {
    const [name, params, type, value] = date
    switch (type) {
        case "date":
            return Temporal.PlainDate.from(value)
        case "date-time":
            const tz = params.tzid || "Etc/UTC"
            try {
                return Temporal.PlainDateTime.from(value).toZonedDateTime(tz)
            } catch {
                return Temporal.Instant.from(value).toZonedDateTimeISO(tz)
            }
        default:
            throw Error(`invalid type: ${type}`)
    }
}

class Item {
    uid: string
    start: Temporal.ZonedDateTime
    end: Temporal.ZonedDateTime
    raw: object

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

const vdir = new VDir(process.argv[2])
console.log((await import("util")).inspect(vdir, { depth: 5 }))
