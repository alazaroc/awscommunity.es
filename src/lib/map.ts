export interface MapCoordinates {
  latitude: number;
  longitude: number;
}

export interface MapPoint {
  x: number;
  y: number;
}

const MAINLAND = {
  minLongitude: -9.5,
  longitudeSpan: 14,
  maxLatitude: 44.2,
  latitudeSpan: 8.7,
  x: 155,
  y: 55,
  width: 370,
  height: 300,
};

const CANARY_INSET = {
  minLongitude: -18.3,
  longitudeSpan: 5.2,
  maxLatitude: 29.35,
  latitudeSpan: 1.8,
  x: 80,
  y: 406,
  width: 148,
  height: 58,
};

export function projectMapCoordinates(coordinates: MapCoordinates): MapPoint {
  const projection = coordinates.latitude < 30 ? CANARY_INSET : MAINLAND;

  return {
    x: projection.x + ((coordinates.longitude - projection.minLongitude) / projection.longitudeSpan) * projection.width,
    y: projection.y + ((projection.maxLatitude - coordinates.latitude) / projection.latitudeSpan) * projection.height,
  };
}
