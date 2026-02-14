async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function attachDebugger(tabId) {
  return new Promise((resolve, reject) => {
    chrome.debugger.attach({ tabId }, "1.3", () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

function detachDebugger(tabId) {
  return new Promise((resolve) => {
    chrome.debugger.detach({ tabId }, () => resolve());
  });
}

function sendCommand(tabId, method, params = {}) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

async function withDebugger(tabId, action) {
  await attachDebugger(tabId);
  try {
    return await action();
  } finally {
    await detachDebugger(tabId);
  }
}

async function applyDeviceToTab(tabId, device) {
  return withDebugger(tabId, async () => {
    await sendCommand(tabId, "Emulation.setDeviceMetricsOverride", {
      width: device.width,
      height: device.height,
      deviceScaleFactor: device.deviceScaleFactor,
      mobile: device.mobile
    });

    await sendCommand(tabId, "Emulation.setTouchEmulationEnabled", {
      enabled: true,
      configuration: device.mobile ? "mobile" : "desktop"
    });

    if (device.userAgent) {
      await sendCommand(tabId, "Emulation.setUserAgentOverride", {
        userAgent: device.userAgent
      });
    }
  });
}

async function clearDeviceOnTab(tabId) {
  return withDebugger(tabId, async () => {
    await sendCommand(tabId, "Emulation.clearDeviceMetricsOverride");
    await sendCommand(tabId, "Emulation.setTouchEmulationEnabled", {
      enabled: false
    });
    await sendCommand(tabId, "Emulation.setUserAgentOverride", {
      userAgent: ""
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") {
    sendResponse({ ok: false, error: "Unknown message." });
    return true;
  }

  (async () => {
    const tab = await getActiveTab();
    if (!tab || tab.id == null) {
      sendResponse({ ok: false, error: "No active tab found." });
      return;
    }

    if (message.type === "applyDevice") {
      const device = message.device;
      if (!device || !Number.isFinite(device.width) || !Number.isFinite(device.height)) {
        sendResponse({ ok: false, error: "Invalid device data." });
        return;
      }

      await applyDeviceToTab(tab.id, device);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "clearDevice") {
      await clearDeviceOnTab(tab.id);
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: false, error: "Unhandled message." });
  })().catch((error) => {
    sendResponse({ ok: false, error: error.message || "Unexpected error." });
  });

  return true;
});
