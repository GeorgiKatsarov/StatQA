import test from "node:test";
import assert from "node:assert/strict";
import { normalizeUrl } from "../utils/normalizeUrl.js";

test("normalizeUrl adds https and strips fragments", () => {
  const result = normalizeUrl("example.com/path#section");
  assert.equal(result, "https://example.com/path");
});

test("normalizeUrl removes default ports and trailing slashes", () => {
  const result = normalizeUrl("https://example.com:443/docs/");
  assert.equal(result, "https://example.com/docs");
});

