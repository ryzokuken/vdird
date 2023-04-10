import { Temporal } from "@js-temporal/polyfill"


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

export default class Item {
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
