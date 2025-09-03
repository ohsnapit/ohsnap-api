/**
 * Convert hex string to base64
 */
export function hexToBase64(hex: string): string {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  return Buffer.from(cleanHex, 'hex').toString('base64');
}

/**
 * Simple base58 encoding function (Bitcoin alphabet)
 */
function base58Encode(buffer: Buffer): string {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  
  if (buffer.length === 0) return '';
  
  // Convert to big integer
  let num = BigInt('0x' + buffer.toString('hex'));
  
  // Handle zero case
  if (num === 0n) return ALPHABET[0] || '1';
  
  // Convert to base58
  let result = '';
  while (num > 0) {
    const remainder = num % 58n;
    result = (ALPHABET[Number(remainder)] || '1') + result;
    num = num / 58n;
  }
  
  // Add leading zeros
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
    result = (ALPHABET[0] || '1') + result;
  }
  
  return result;
}

/**
 * Convert hex string to base58 (for Solana addresses)
 */
export function hexToBase58(hex: string): string {
  const buffer = Buffer.from(hex, 'hex');
  return base58Encode(buffer);
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
 * Parse location from various formats
 */
export function parseGeoLocation(value: string): { latitude: number; longitude: number } | null {
  if (!value) return null;
  
  // Handle geo: format (latitude,longitude)
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

/**
 * Parse location text into address components
 */
export function parseLocationText(value: string): { city: string; state: string; state_code: string; country: string; country_code: string } | null {
  if (!value || value.trim() === '') return null;
  
  // Simple text parsing - could be enhanced with a geocoding service
  const parts = value.split(',').map(s => s.trim());
  
  if (parts.length >= 2) {
    const city = parts[0] || 'Unknown';
    const country = parts[parts.length - 1] || 'Unknown';
    const state = parts.length > 2 ? parts[1] || 'Unknown' : 'Unknown';
    
    return {
      city,
      state,
      state_code: (state || 'unknown').toLowerCase().replace(' ', ''),
      country,
      country_code: (country || 'unknown').toLowerCase().replace(' ', ''),
    };
  }
  
  // Single location name
  return {
    city: value,
    state: 'Unknown',
    state_code: 'unknown',
    country: 'Unknown',
    country_code: 'unknown',
  };
}