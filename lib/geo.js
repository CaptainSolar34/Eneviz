function toFeatureCollection(records, mapper) {
  const features = [];
  for (const record of records) {
    const feature = mapper(record);
    if (feature) {
      features.push(feature);
    }
  }
  return {
    type: "FeatureCollection",
    features,
  };
}

function extentFromBboxString(bbox) {
  const parts = bbox.split(",").map((value) => Number.parseFloat(value.trim()));
  if (parts.length !== 4 || parts.some((value) => Number.isNaN(value))) {
    throw new Error("bbox invalide");
  }
  const [minLon, minLat, maxLon, maxLat] = parts;
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ];
}

function createCsvFromFeatures(features) {
  if (features.features.length === 0) {
    return "";
  }
  const headers = new Set();
  for (const feature of features.features) {
    const props = feature.properties ?? {};
    for (const key of Object.keys(props)) {
      headers.add(key);
    }
  }
  const headerList = Array.from(headers);
  const lines = [headerList.join(",")];
  for (const feature of features.features) {
    const props = feature.properties ?? {};
    const row = headerList.map((key) => {
      const value = props[key];
      if (value === undefined || value === null) return "";
      const stringValue = `${value}`.replace(/"/g, '""');
      if (stringValue.includes(",") || stringValue.includes("\n")) {
        return `"${stringValue}"`;
      }
      return stringValue;
    });
    lines.push(row.join(","));
  }
  return lines.join("\n");
}

function computeQuantiles(values, steps = 5) {
  if (values.length === 0) {
    return {
      thresholds: [],
      colors: [],
    };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const thresholds = [];
  for (let i = 1; i < steps; i += 1) {
    const position = (sorted.length - 1) * (i / steps);
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    const weight = position - lower;
    const value = sorted[lower] * (1 - weight) + sorted[upper] * weight;
    thresholds.push(value);
  }
  const colors = ["#f1f5f9", "#cfe1ff", "#9cc3ff", "#5f9bff", "#1f64d4"];
  return {
    thresholds,
    colors,
  };
}

function colorForValue(value, quantile) {
  if (quantile.thresholds.length === 0) {
    return "#d1d5db";
  }
  const { thresholds, colors } = quantile;
  for (let i = 0; i < thresholds.length; i += 1) {
    if (value <= thresholds[i]) {
      return colors[i];
    }
  }
  return colors[colors.length - 1] ?? "#1f2937";
}

function clampBbox(bbox) {
  const [[minLon, minLat], [maxLon, maxLat]] = bbox;
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  return [
    clamp(minLon, -180, 180),
    clamp(minLat, -90, 90),
    clamp(maxLon, -180, 180),
    clamp(maxLat, -90, 90),
  ].join(",");
}

function geometryToBbox(geometry) {
  if (!geometry) return null;
  const coords = extractCoordinates(geometry);
  if (!coords.length) return null;
  let minLon = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  for (const [lon, lat] of coords) {
    minLon = Math.min(minLon, lon);
    minLat = Math.min(minLat, lat);
    maxLon = Math.max(maxLon, lon);
    maxLat = Math.max(maxLat, lat);
  }
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ];
}

function extractCoordinates(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    if (typeof input[0] === "number" && typeof input[1] === "number") {
      return [[input[0], input[1]]];
    }
    return input.flatMap((item) => extractCoordinates(item));
  }
  if (typeof input === "object" && "coordinates" in input) {
    return extractCoordinates(input.coordinates);
  }
  return [];
}

export {
  toFeatureCollection,
  extentFromBboxString,
  createCsvFromFeatures,
  computeQuantiles,
  colorForValue,
  clampBbox,
  geometryToBbox,
};
