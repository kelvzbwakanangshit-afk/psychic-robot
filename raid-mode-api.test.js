"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const startDashboardApi = require("../dashboard-api");

test("Raid Mode management API is key-protected and supports theme, image, activation, repair, and stop", async t => {
  const previousOrigin = process.env.ECLIPSE_DASHBOARD_ORIGIN;
  process.env.ECLIPSE_DASHBOARD_ORIGIN = "https://raid-dashboard.example";
  const calls = [];
  let image = Buffer.from("raid-image");
  const raidMode = {
    async getStatus() { return { available: true, ready: true, active: false, namespace: "test-bot" }; },
    async saveTheme(input) { calls.push(["theme", input]); return input; },
    async uploadImage(buffer, type, name) { image = buffer; calls.push(["upload", type, name]); return { imageName: name }; },
    async getImage() { return { buffer: image, contentType: "image/png" }; },
    async activate(input) { calls.push(["activate", input]); return { activated: input.threadIDs.length, results: [] }; },
    async repairGroup(id, reason) { calls.push(["repair", id, reason]); return { participants: 2 }; },
    async emergencyStop() { calls.push(["stop"]); return { stopped: 1 }; }
  };
  const server = startDashboardApi(0, () => ({}), {
    raidMode,
    licenseGuard: {
      dashboardAuthorized(req) { return req.headers["x-eclipse-dashboard-key"] === "raid-test-key"; }
    }
  });
  await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  t.after(() => {
    server.close();
    if (previousOrigin === undefined) delete process.env.ECLIPSE_DASHBOARD_ORIGIN;
    else process.env.ECLIPSE_DASHBOARD_ORIGIN = previousOrigin;
  });
  const base = "http://127.0.0.1:" + server.address().port;
  const headers = { Origin: "https://raid-dashboard.example", "X-ECLIPSE-DASHBOARD-KEY": "raid-test-key" };

  const blocked = await fetch(base + "/api/dashboard/raid/status", { headers: { Origin: headers.Origin } });
  assert.equal(blocked.status, 401);

  const status = await fetch(base + "/api/dashboard/raid/status", { headers });
  assert.equal(status.status, 200);
  assert.equal((await status.json()).raid.ready, true);

  const theme = await fetch(base + "/api/dashboard/raid/theme", {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ groupTitle: "Raid Group", nickname: "Raid Member" })
  });
  assert.equal(theme.status, 200);
  assert.deepEqual(calls[0], ["theme", { groupTitle: "Raid Group", nickname: "Raid Member" }]);

  const upload = await fetch(base + "/api/dashboard/raid/theme-image", {
    method: "POST", headers: { ...headers, "Content-Type": "image/png", "X-File-Name": "theme.png" },
    body: Buffer.from("new-image")
  });
  assert.equal(upload.status, 200);
  assert.deepEqual(calls[1], ["upload", "image/png", "theme.png"]);

  const imageResponse = await fetch(base + "/api/dashboard/raid/theme-image", { headers });
  assert.equal(imageResponse.status, 200);
  assert.equal(imageResponse.headers.get("content-type"), "image/png");
  assert.equal(await imageResponse.text(), "new-image");

  const activation = await fetch(base + "/api/dashboard/raid/activate", {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ threadIDs: ["123", "456"] })
  });
  assert.equal(activation.status, 200);
  assert.deepEqual(calls[2], ["activate", { threadIDs: ["123", "456"] }]);

  const repair = await fetch(base + "/api/dashboard/raid/repair", {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ threadID: "123" })
  });
  assert.equal(repair.status, 200);
  assert.deepEqual(calls[3], ["repair", "123", "manual-repair"]);

  const stop = await fetch(base + "/api/dashboard/raid/emergency-stop", {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: "{}"
  });
  assert.equal(stop.status, 200);
  assert.deepEqual(calls[4], ["stop"]);
});
