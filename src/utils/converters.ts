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
 * Reverse geocoding using LocationIQ API to convert coordinates to location
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<{ city: string; state: string; state_code: string; country: string; country_code: string } | null> {
  const { LOCATION_IQ_API_KEY } = await import('./constants.js');
  
  if (!LOCATION_IQ_API_KEY) {
    console.warn('LOCATION_IQ_API_KEY not configured');
    return null;
  }

  try {
    const url = `https://us1.locationiq.com/v1/reverse?key=${LOCATION_IQ_API_KEY}&lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`LocationIQ API error: ${response.status}`);
      return null;
    }

    const data = await response.json() as { address?: any };
    
    const address = data.address || {};
    
    return {
      city: address.city || address.town || address.village || address.county || 'Unknown',
      state: address.state || address.region || 'Unknown',
      state_code: address.state || address.region || 'unknown',
      country: address.country || 'Unknown',
      country_code: address.country_code || 'unknown',
    };
    
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}