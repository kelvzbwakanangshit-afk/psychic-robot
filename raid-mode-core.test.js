"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const {
  changeNickname, setRaidTitle, changeRaidGroupImage, isRaidMutationEvent
} = require("../raid-mode");

test("Raid Mode calls ws3-fca changeNickname with nickname, thread ID, then participant ID", async () => {
  const calls = [];
  const api = {
    changeNickname(nickname, threadID, participantID, callback) {
      calls.push([nickname, threadID, participantID]);
      callback(null);
    }
  };

  await changeNickname(api, "Raid Member", "group-123", "member-456");
  assert.deepEqual(calls, [["Raid Member", "group-123", "member-456"]]);
});

test("Raid Mode calls setTitle with title then thread ID", async () => {
  const calls = [];
  const api = {
    setTitle(title, threadID, callback) {
      calls.push([title, threadID]);
      callback(null);
    }
  };
  await setRaidTitle(api, "Raid Group", "group-123");
  assert.deepEqual(calls, [["Raid Group", "group-123"]]);
});

test("Raid Mode sends a readable image stream then thread ID to changeGroupImage", async () => {
  const calls = [];
  const api = {
    changeGroupImage(image, threadID, callback) {
      calls.push([image, threadID]);
      callback(null);
    }
  };
  const stream = Readable.from([Buffer.from("image")]);
  await changeRaidGroupImage(api, stream, "group-123");
  assert.equal(calls[0][0], stream);
  assert.equal(calls[0][1], "group-123");
});

test("Raid Mode recognizes ws3-fca group mutation event payloads", () => {
  const events = [
    { type: "event", threadID: "g1", logMessageType: "log:thread-name" },
    { type: "event", threadID: "g1", logMessageType: "log:user-nickname" },
    { type: "event", threadID: "g1", logMessageType: "log:subscribe" },
    { type: "event", threadID: "g1", logMessageType: "log:unsubscribe" },
    { type: "change_thread_image", threadID: "g1" },
    { type: "event", threadID: "g1", logMessageType: "log:thread-admins" }
  ];
  for (const event of events) assert.equal(isRaidMutationEvent(event), true, JSON.stringify(event));
});

test("Raid Mode ignores non-mutation events and events without a thread ID", () => {
  assert.equal(isRaidMutationEvent({ type: "message", threadID: "g1" }), false);
  assert.equal(isRaidMutationEvent({ type: "typ", threadID: "g1" }), false);
  assert.equal(isRaidMutationEvent({ type: "event", logMessageType: "log:thread-name" }), false);
});
