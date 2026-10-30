import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  blockedMediaFilename,
  classifyInboxUpload,
  dangerousMediaBytes,
  safeMediaFilename,
} from "./inbox-media";

describe("inbox media policy", () => {
  it("rejects exe and rar names", () => {
    assert.equal(blockedMediaFilename("setup.EXE"), true);
    assert.equal(blockedMediaFilename("archive.RAR"), true);
    assert.equal(blockedMediaFilename("notes.pdf"), false);
    assert.equal(classifyInboxUpload("setup.exe", "application/octet-stream", 12).ok, false);
    assert.equal(classifyInboxUpload("pack.rar", "application/pdf", 12).ok, false);
  });

  it("rejects executable and rar bytes", () => {
    assert.equal(dangerousMediaBytes(Uint8Array.from([0x4d, 0x5a, 0x00])), true);
    assert.equal(dangerousMediaBytes(Uint8Array.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00])), true);
    assert.equal(dangerousMediaBytes(Uint8Array.from([0x25, 0x50, 0x44, 0x46])), false);
  });

  it("accepts a photo, voice, video, and pdf under the cap", () => {
    assert.equal(classifyInboxUpload("foto.jpg", "image/jpeg", 1000).ok, true);
    assert.equal(classifyInboxUpload("voice.ogg", "audio/ogg; codecs=opus", 1000).ok, true);
    assert.equal(classifyInboxUpload("clip.mp4", "video/mp4", 1000).ok, true);
    assert.equal(classifyInboxUpload("nota.pdf", "", 1000).ok, true);
    assert.equal(classifyInboxUpload("clip.mp4", "video/mp4", 16 * 1024 * 1024 + 1).ok, false);
  });

  it("strips a path from the stored filename", () => {
    assert.equal(safeMediaFilename("../secret/nota.pdf", "file"), "nota.pdf");
  });
});
