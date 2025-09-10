import { getFollowCounts } from './src/services/grpc.js';

async function testFollowerCounts() {
  try {
    console.log('Testing follower counts for FID 3...');
    
    console.time('getFollowCounts');
    const counts = await getFollowCounts(3);
    console.timeEnd('getFollowCounts');
    
    console.log('Results:', counts);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testFollowerCounts();