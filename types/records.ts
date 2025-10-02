export type AddressRecord = {
  id: string;
  geometry: {
    type: string;
    coordinates: [number, number];
  } | null;
  fields: Record<string, unknown>;
};

export type IrisRecord = {
  id: string;
  geometry: {
    type: string;
    coordinates: unknown;
  } | null;
  fields: Record<string, unknown>;
};
