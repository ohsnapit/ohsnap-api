#!/usr/bin/env bun

const API_BASE = 'http://localhost:3001';
const FID = 3;
const HASH = '0x029f7cceef2f0078f34949d6e339070fc6eb47b4';

async function testCast() {
  try {
    console.log(`Testing cast API with FID: ${FID}, HASH: ${HASH}`);
    console.log('Making request...\n');
    
    const response = await fetch(`${API_BASE}/v1/cast?fid=${FID}&hash=${HASH}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log('Cast retrieved successfully!\n');
    console.log('Formatted Response:');
    console.log('═'.repeat(50));
    console.log(JSON.stringify(data, null, 2));
    
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

testCast();