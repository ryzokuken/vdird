//import fs from "fs";
import {
  readDir,
  readTextFile,
  exists,
  BaseDirectory,
} from "@tauri-apps/api/fs";
import { join, normalize, extname, appDataDir } from "@tauri-apps/api/path";

import ICAL from "ical.js";
import { Temporal } from "@js-temporal/polyfill";

import Item from "./item.js";

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
    return (async () => {
      this.id = id;
      const exists_ch = await exists(path);
      if (!exists_ch) throw Error();
      this.path = path;
      let items = await readDir(this.path);
      if (items.some((i) => i.name == "color")) {
        const colorpath = await join(this.path, "color");
        this.color = (await readTextFile(colorpath)).toString();
        console.log("this.color = ", this.color);
        items = items.filter((item) => item.name != "color");
      } else {
        this.color = undefined;
      }
      if (items.some((i) => i.name == "displayname")) {
        const displayname = await join(this.path, "displayname");
        this.displayName = (await readTextFile(displayname)).toString();
        items = items.filter((item) => item.name != "displayname");
      } else {
        this.displayName = undefined;
      }
      await Promise.all(
        items.map((item) => {
          return (async (name, path) => {
            const exists_ch = await exists(path);
            if (!exists_ch) throw Error(); // TODO: add a better error code
            const ext = await extname(name);
            if (ext === "ics") {
              const f = await readTextFile(path);
              const jCalData = ICAL.parse(f.toString()) as Object[];
              const component = new ICAL.Component(jCalData);
              processComponent(component, eventRegistry, taskRegistry);
            } else
              throw Error(`unrecognized file extension for ${name}: ${ext}`);
          })(item.name, item.path);
        })
      );
      return this;
    })();
  }
}

export default class VDir {
  eventRegistry: Registry;
  taskRegistry: Registry;
  path: string;
  collections: Collection[];

  constructor(path: string) {
    return (async () => {
      path = await normalize(path);
      const exists_ch = await exists(path);
      if (!exists_ch) throw Error(); // TODO: add a better error code
      this.eventRegistry = new Registry();
      this.taskRegistry = new Registry();
      this.path = path;
      const stuff = await readDir(this.path);
      this.collections = await Promise.all(
        stuff.map(async (collection) => {
          const p = collection.path;
          return new Collection(
            collection,
            p,
            this.eventRegistry,
            this.taskRegistry
          );
        })
      );
      return this;
    })();
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
        Temporal.PlainDateTime.compare(sZDT, event.start) === -1 &&
        Temporal.PlainDateTime.compare(event.end, eZDT) === -1
    );
    const tasks = Array.from(this.taskRegistry.data.values()).filter(
      (task) =>
        Temporal.ZonedDateTime.compare(sZDT, task.start) === -1 &&
        Temporal.ZonedDateTime.compare(task.end, eZDT) === -1
    );
    return { events, tasks };
  }
}
