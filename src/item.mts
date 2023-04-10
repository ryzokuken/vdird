import { Temporal } from "@js-temporal/polyfill"

function processDate(prop) {
    const type = prop.type
    const value = prop.getFirstValue()
    switch (prop.type) {
        case "date":
            return Temporal.PlainDate.from(value)
        case "date-time":
            const tz = prop.getParameter("tzid") || "Etc/UTC"
            try {
                return Temporal.PlainDateTime.from(value).toZonedDateTime(tz)
            } catch {
                return Temporal.Instant.from(value).toZonedDateTimeISO(tz)
            }
        default:
            throw Error(`invalid type: ${type}`)
    }
}

export default class Item {
    uid: string
    start: Temporal.ZonedDateTime
    end: Temporal.ZonedDateTime
    raw: object

    constructor(props) {
        this.raw = props
        props.forEach((prop) => {
            prop.toString()
            switch (prop.name) {
                case "uid":
                    this.uid = prop.getFirstValue()
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
