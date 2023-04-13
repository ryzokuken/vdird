import { invoke } from "@tauri-apps/api/tauri";
import VDir from "/src/vdir.ts";
import util from "util";

const start = "2000-01-01";
const end = "2030-01-01";

let greetInputEl: HTMLInputElement | null;
let greetMsgEl: HTMLElement | null;

async function greet() {
  const vdir = await new VDir("/path/to/vdird/fixtures");
  if (greetMsgEl && greetInputEl) {
    greetMsgEl.textContent = JSON.stringify(vdir.all());
    // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
    //greetMsgEl.textContent = await invoke("greet", {
    //  name: greetInputEl.value,
    //});
  }
}

window.addEventListener("DOMContentLoaded", () => {
  greetInputEl = document.querySelector("#greet-input");
  greetMsgEl = document.querySelector("#greet-msg");
  document
    .querySelector("#greet-button")
    ?.addEventListener("click", () => greet());
});
