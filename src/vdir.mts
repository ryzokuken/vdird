import fs from "fs";
import nodePath from "path";
import assert from "assert";

import ICAL from "ical.js";
import { Temporal } from "@js-temporal/polyfill";

import Item from "./item.mjs";

class Registry {
  data: Map<string, Item>;

  constructor() {
    this.data = new Map();
  }

  insert(item: Item) {
    assert(item.uid, 'item has no uid');
    this.data.set(item.uid, item);
  }
}

function processComponent(
  component: ICAL.Component,
  eventRegistry: Registry,
  taskRegistry: Registry
) {
  const properties = component.getAllProperties();
  switch (component.name) {
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
      throw Error(`unexpected component: ${component.toString()}`);
  }
}

function processTimeZone(props: ICAL.Property[]) {
  props.forEach((prop) => {
    const value = prop.getFirstValue();
    if (prop.name === "tzid") {
      assert.doesNotThrow(() => new Temporal.TimeZone(value), `invalid tzid: ${value}`)
    }
  });
}

function handleICS(content: string, eventRegistry: Registry, taskRegistry: Registry) {
  const jCalData = ICAL.parse(content);
  const component = new ICAL.Component(jCalData as object[]);
  assert.strictEqual(component.name, 'vcalendar', 'top level component must be "vcalendar"');
  component.getAllSubcomponents().forEach(component => processComponent(component, eventRegistry, taskRegistry));
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
    assert(fs.statSync(path).isDirectory(), `invalid directory: ${path}`);
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
      assert(fs.statSync(filePath).isFile(), `invalid file: ${filePath}`);
      assert.strictEqual(nodePath.extname(item), '.ics', `unrecognized file extension: ${item}`)
      handleICS(fs.readFileSync(filePath).toString(), eventRegistry, taskRegistry);
    });
  }
}

export default class VDir {
  path: string;
  eventRegistry: Registry;
  taskRegistry: Registry;
  collections: Collection[];

  constructor(path: string) {
    assert(fs.statSync(path).isDirectory(), `invalid directory: ${path}`);
    this.path = path;
    this.eventRegistry = new Registry();
    this.taskRegistry = new Registry();
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
    const events = Array.from(this.eventRegistry.data.values()).filter(
      (event) => event.overlaps(start, end)
    );
    const tasks = Array.from(this.taskRegistry.data.values()).filter((task) =>
      task.overlaps(start, end)
    );
    return { events, tasks };
  }
}
