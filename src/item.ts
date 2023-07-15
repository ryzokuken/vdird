import { Temporal } from "@js-temporal/polyfill";
import ICAL from "ical.js";

function processDate(prop: ICAL.Property): DateTime {
  const type = prop.type;
  const value = prop.getFirstValue();
  switch (prop.type) {
    case "date":
      return new DateTime(Temporal.PlainDate.from(value));
    case "date-time":
      const tz = (prop.getParameter("tzid") as string) || "Etc/UTC";
      try {
        return new DateTime(
          Temporal.PlainDateTime.from(value).toZonedDateTime(tz)
        );
      } catch {
        return new DateTime(
          Temporal.Instant.from(value).toZonedDateTimeISO(tz)
        );
      }
    default:
      // TODO: When you're cleaning this mess, check all the possible types.
      throw Error(`invalid type: ${type}`);
  }
}

type DTType = Temporal.PlainDate | Temporal.ZonedDateTime;

class DateTime {
  #dateTime: DTType;

  constructor(item: DTType) {
    this.#dateTime = item;
  }

  getInstant(): Temporal.Instant {
    let value: any = this.#dateTime;
    try {
      value = (value as Temporal.ZonedDateTime).toInstant();
    } catch {
      value = value
        .toZonedDateTime({
          plainTime: "00:00",
          timeZone: Temporal.Now.timeZoneId,
        })
        .toInstant();
    }
    return value;
  }

  toJSON() {
    return this.#dateTime.toString();
  }
}

export default class Item {
  uid: string;
  summary: string;
  // FIXME: There's no brand checks in Temporal. This is terrible.
  start: DateTime;
  end: DateTime;
  raw: object;

  constructor(props: ICAL.Property[]) {
    this.raw = props;
    props.forEach((prop) => {
      switch (prop.name) {
        case "uid":
          this.uid = prop.getFirstValue();
          break;
        case "summary":
          this.summary = prop.getFirstValue();
          break;
        case "dtstart":
          this.start = processDate(prop);
          break;
        case "dtend":
          this.end = processDate(prop);
          break;
      }
    });
  }

  overlaps(start: string, end: string): boolean {
    if (this.start === undefined || this.end === undefined) return false;
    let st = this.start.getInstant();
    let en = this.end.getInstant();
    const x =
      Temporal.Instant.compare(en, start) === 1 ||
      Temporal.Instant.compare(st, end) === -1;
    console.log(Temporal.Instant.compare(st, end));
    return x;
  }
}
