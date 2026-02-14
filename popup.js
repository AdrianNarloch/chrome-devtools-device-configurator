import { devices } from "./devices.js";

const listEl = document.getElementById("device-list");
const formEl = document.getElementById("device-form");
const statusEl = document.getElementById("status");

const nameEl = document.getElementById("device-name");
const widthEl = document.getElementById("device-width");
const heightEl = document.getElementById("device-height");
const scaleEl = document.getElementById("device-scale");
const mobileEl = document.getElementById("device-mobile");
const uaEl = document.getElementById("device-ua");
const resetBtn = document.getElementById("reset");

let selectedDevice = devices[0];

function setStatus(message, state = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${state}`.trim();
}

function renderList() {
  listEl.innerHTML = "";
  devices.forEach((device, index) => {
    const item = document.createElement("label");
    item.className = `device-item ${device.id === selectedDevice.id ? "active" : ""}`;

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "device";
    radio.checked = device.id === selectedDevice.id;
    radio.addEventListener("change", () => {
      selectedDevice = device;
      renderList();
      fillForm(device);
    });

    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = device.name;
    const meta = document.createElement("span");
    meta.textContent = `${device.width}×${device.height} · ${device.deviceScaleFactor}x`;

    info.appendChild(title);
    info.appendChild(meta);

    item.appendChild(radio);
    item.appendChild(info);
    listEl.appendChild(item);

    if (index === 0 && !selectedDevice) {
      selectedDevice = device;
    }
  });
}

function fillForm(device) {
  nameEl.value = device.name;
  widthEl.value = device.width;
  heightEl.value = device.height;
  scaleEl.value = device.deviceScaleFactor;
  mobileEl.value = device.mobile ? "true" : "false";
  uaEl.value = device.userAgent || "";
}

async function sendMessage(payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: false, error: "No response from background" });
    });
  });
}

formEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Applying device emulation...");

  const payload = {
    type: "applyDevice",
    device: {
      name: nameEl.value.trim(),
      width: Number(widthEl.value),
      height: Number(heightEl.value),
      deviceScaleFactor: Number(scaleEl.value),
      mobile: mobileEl.value === "true",
      userAgent: uaEl.value.trim()
    }
  };

  const response = await sendMessage(payload);
  if (response.ok) {
    setStatus("Emulation applied to active tab.", "ok");
  } else {
    setStatus(response.error || "Failed to apply device.", "error");
  }
});

resetBtn.addEventListener("click", async () => {
  setStatus("Resetting emulation...");
  const response = await sendMessage({ type: "clearDevice" });
  if (response.ok) {
    setStatus("Emulation cleared.", "ok");
  } else {
    setStatus(response.error || "Failed to reset emulation.", "error");
  }
});

renderList();
fillForm(selectedDevice);
