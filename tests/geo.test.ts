import test from "node:test";
import assert from "node:assert/strict";

import { clampBbox, computeQuantiles, createCsvFromFeatures, geometryToBbox } from "../lib/geo.js";

test("computeQuantiles generates thresholds", () => {
  const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const quantiles = computeQuantiles(values, 5);
  assert.equal(quantiles.thresholds.length, 4);
  assert.ok(quantiles.thresholds[0] >= 10);
  assert.ok(quantiles.thresholds[quantiles.thresholds.length - 1] <= 100);
});

test("clampBbox keeps coordinates inside world", () => {
  const clamped = clampBbox([
    [-200, -95],
    [200, 95],
  ]);
  assert.equal(clamped, "-180,-90,180,90");
});

test("createCsvFromFeatures serialises properties", () => {
  const csv = createCsvFromFeatures({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [0, 0] },
        properties: { foo: "bar", value: 10 },
      },
    ],
  });
  assert.ok(csv.includes("foo"));
  assert.ok(csv.includes("bar"));
});

test("geometryToBbox computes extent", () => {
  const bbox = geometryToBbox({
    type: "Polygon",
    coordinates: [
      [
        [1, 1],
        [2, 1],
        [2, 2],
        [1, 2],
        [1, 1],
      ],
    ],
  });
  assert.deepEqual(bbox, [
    [1, 1],
    [2, 2],
  ]);
});
