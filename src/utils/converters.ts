/**
 * Convert hex string to base64
 */
export function hexToBase64(hex: string): string {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  return Buffer.from(cleanHex, 'hex').toString('base64');
}

/**
 * Convert base64 string to hex
 */
export function base64ToHex(base64: string): string {
  return '0x' + Buffer.from(base64, 'base64').toString('hex');
}

/**
 * Convert Farcaster timestamp to ISO string
 */
export function farcasterTimestampToISO(timestamp: number): string {
  // Farcaster epoch starts at Jan 1, 2021 00:00:00 UTC
  const farcasterEpochStart = new Date('2021-01-01T00:00:00.000Z').getTime();
  const actualTimestamp = farcasterEpochStart + (timestamp * 1000);
  return new Date(actualTimestamp).toISOString();
}

/**
 * Parse geo coordinates from location string
 */
export function parseGeoLocation(value: string): { latitude: number; longitude: number } | null {
  if (value.startsWith('geo:')) {
    const coords = value.slice(4).split(',');
    if (coords.length === 2 && coords[0] && coords[1]) {
      const lat = parseFloat(coords[0]);
      const lng = parseFloat(coords[1]);
      
      // Check if parsing was successful (not NaN)
      if (!isNaN(lat) && !isNaN(lng)) {
        return {
          latitude: lat,
          longitude: lng
        };
      }
    }
  }
  return null;
}