// Test script for image fallback logic
const { resolveBestPoster } = require('./lib/shikimori.ts');

async function testImageFallback() {
  console.log('Testing image fallback logic...');
  
  // Test case 1: Missing Shikimori image
  const missingImage = 'https://shikimori.one/system/animes/original/missing.jpg';
  const testId = '1';
  const testRomaji = 'Test Anime';
  const testRussian = 'Тест Аниме';
  
  try {
    const poster = await resolveBestPoster(missingImage, testRomaji, testRussian, testId);
    console.log('✅ Fallback poster generated:', poster.substring(0, 100) + '...');
    
    // Check if it's a generated SVG or from another source
    if (poster.startsWith('data:image/svg+xml')) {
      console.log('✅ Generated SVG fallback works');
    } else if (poster.startsWith('http')) {
      console.log('✅ External API fallback works:', poster.split('/')[2]);
    }
  } catch (error) {
    console.error('❌ Error in fallback logic:', error.message);
  }
}

testImageFallback();
