import { Temporal } from "@js-temporal/polyfill";
// @deno-types="./ical.d.ts"
import ICAL from "ical.js";
import assert from "node:assert";

function processDateTime(
  value: string,
  tzid: string | undefined,
): Temporal.ZonedDateTime {
  // DATE-TIME properties can have three forms: local time, UTC time and local time with a timezone.
  // These three forms correspond to PlainDateTime, Instant and ZonedDateTime objects in Temporal.
  if (tzid !== undefined) {
    return Temporal.PlainDateTime.from(value).toZonedDateTime(tzid);
  }
  try {
    return Temporal.Instant.from(value).toZonedDateTimeISO("UTC");
  } catch {
    return Temporal.PlainDateTime.from(value)
      .toZonedDateTime(Temporal.Now.timeZoneId());
  }
}

function processDate(prop: ICAL.Property): Temporal.ZonedDateTime {
  const type = prop.type;
  const value = prop.toJSON()[3]; // FIXME: figure out wtaf is going on
  switch (prop.type) {
    case "date":
      // return new DateTime(Temporal.PlainDate.from(value));
      throw new Error("can't handle just dates");
    case "date-time": {
      const tz = prop.getParameter("tzid") as string | undefined;
      return processDateTime(value, tz);
    }
    default:
      // TODO: When you're cleaning this mess, check all the possible types.
      throw Error(`invalid type: ${type}`);
  }
}

// type DTType = Temporal.PlainDate | Temporal.ZonedDateTime;

// class DateTime {
//   #dateTime: DTType;

//   constructor(item: DTType) {
//     this.#dateTime = item;
//   }

//   getInstant(): Temporal.Instant {
//     let value: any = this.#dateTime;
//     try {
//       value = (value as Temporal.ZonedDateTime).toInstant();
//     } catch {
//       value = value
//         .toZonedDateTime({
//           plainTime: "00:00",
//           timeZone: Temporal.Now.timeZoneId,
//         })
//         .toInstant();
//     }
//     return value;
//   }

//   toJSON() {
//     return this.#dateTime.toString();
//   }
// }

export default class Item {
  uid!: string;
  summary!: string;
  // FIXME: There's no brand checks in Temporal. This is terrible.
  start?: Temporal.ZonedDateTime;
  end?: Temporal.ZonedDateTime;
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
    assert.notStrictEqual(this.uid, undefined, "must have a uid");
  }

  overlaps(start: string, end: string): boolean {
    if (this.start === undefined || this.end === undefined) return false;
    const st = this.start.toInstant();
    const en = this.end.toInstant();
    const x = Temporal.Instant.compare(en, start) === 1 ||
      Temporal.Instant.compare(st, end) === -1;
    console.log(Temporal.Instant.compare(st, end));
    return x;
  }
}
