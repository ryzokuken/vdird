import fs from "fs";
import nodePath from "path";

import ICAL from "ical.js";
import { Temporal } from "@js-temporal/polyfill";

import Item from "./item.mjs";

class Registry {
  data: Map<string, Item>;

  constructor() {
    this.data = new Map();
  }

  insert(item: Item) {
    if (item.uid === undefined) throw Error("event has no uid");
    this.data.set(item.uid, item);
  }
}

function processComponent(
  component: ICAL.Component,
  eventRegistry: Registry,
  taskRegistry: Registry
) {
  const name = component.name;
  const properties = component.getAllProperties();
  switch (name) {
    case "vcalendar":
      component
        .getAllSubcomponents()
        .forEach((c: ICAL.Component) =>
          processComponent(c, eventRegistry, taskRegistry)
        );
      break;
    case "vevent":
      eventRegistry.insert(new Item(properties));
      break;
    case "vtodo":
      taskRegistry.insert(new Item(properties));
      break;
    case "vtimezone":
      processTimeZone(properties);
      break;
    default:
      throw Error(`unexpected component: ${name}`);
  }
}

function processTimeZone(props: ICAL.Property[]) {
  props.forEach((prop) => {
    const value = prop.getFirstValue();
    if (prop.name === "tzid") {
      try {
        new Temporal.TimeZone(value);
      } catch {
        throw Error(`invalid tzid: ${value}`);
      }
    }
  });
}

class Collection {
  id: string;
  path: string;
  color?: string;
  displayName?: string;

  constructor(
    id: string,
    path: string,
    eventRegistry: Registry,
    taskRegistry: Registry
  ) {
    this.id = id;
    if (!fs.statSync(path).isDirectory()) throw Error();
    this.path = path;
    let items = fs.readdirSync(this.path);
    if (items.includes("color")) {
      this.color = fs
        .readFileSync(nodePath.join(this.path, "color"))
        .toString();
      items = items.filter((item) => item != "color");
    } else {
      this.color = undefined;
    }
    if (items.includes("displayname")) {
      this.displayName = fs
        .readFileSync(nodePath.join(this.path, "displayname"))
        .toString();
      items = items.filter((item) => item != "displayname");
    } else {
      this.displayName = undefined;
    }
    items.forEach((item) => {
      const filePath = nodePath.join(this.path, item);
      if (!fs.statSync(filePath).isFile()) throw Error(); // TODO: add a better error code
      if (nodePath.extname(item) === ".ics") {
        const jCalData = ICAL.parse(
          fs.readFileSync(filePath).toString()
        ) as Object[];
        const component = new ICAL.Component(jCalData);
        processComponent(component, eventRegistry, taskRegistry);
      } else throw Error(`unrecognized file extension for ${item}`);
    });
  }
}

export default class VDir {
  eventRegistry: Registry;
  taskRegistry: Registry;
  path: string;
  collections: Collection[];

  constructor(path: string) {
    if (!fs.statSync(path).isDirectory()) throw Error(); // TODO: add a better error code
    this.eventRegistry = new Registry();
    this.taskRegistry = new Registry();
    this.path = path;
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
      );
  }

  all() {
    return {
      events: Array.from(this.eventRegistry.data.values()),
      tasks: Array.from(this.taskRegistry.data.values()),
    };
  }

  between(start: string, end: string) {
    const sZDT = Temporal.PlainDateTime.from(start);
    const eZDT = Temporal.PlainDateTime.from(end);
    const events = Array.from(this.eventRegistry.data.values()).filter(
      (event) =>
        Temporal.PlainDateTime.compare(event.end, sZDT) === 1 ||
        Temporal.PlainDateTime.compare(event.start, eZDT) === -1
    );
    const tasks = Array.from(this.taskRegistry.data.values()).filter(
      (task) =>
        Temporal.ZonedDateTime.compare(task.end, sZDT) === 1 ||
        Temporal.ZonedDateTime.compare(task.start, eZDT) === -1
    );
    return { events, tasks };
  }
}
