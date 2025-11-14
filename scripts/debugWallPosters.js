const qdrantService = require('../services/qdrantService');
const sentenceTransformerService = require('../services/sentenceTransformerService');
const PriceParser = require('../utils/priceParser');

const debugWallPosters = async () => {
  console.log('=== DEBUGGING WALL POSTERS ISSUE ===\n');
  
  try {
    const testMessage = "please give me wall posters for decorating my room";
    
    // Test 1: Get embedding
    console.log('1. Getting embedding for message...');
    const embedding = await sentenceTransformerService.getEmbedding(testMessage);
    console.log('Embedding dimensions:', embedding.length);
    
    // Test 2: Search WITHOUT any filters
    console.log('\n2. Searching WITHOUT any filters:');
    const resultsNoFilter = await qdrantService.searchProducts(embedding, {}, 10);
    console.log(`Found ${resultsNoFilter.length} products without filter`);
    
    if (resultsNoFilter.length > 0) {
      console.log('First 3 products without filter:');
      resultsNoFilter.slice(0, 3).forEach((result, index) => {
        console.log(`${index + 1}. ${result.payload.title}`);
        console.log(`   Interests: ${result.payload.interests}`);
        console.log(`   Category: ${result.payload.category}`);
        console.log(`   Price: ${result.payload.price_numeric}`);
        console.log(`   Score: ${result.score}`);
      });
    }
    
    // Test 3: Test with home decor interest filter
    console.log('\n3. Testing with home decor interest filter:');
    const interestFilter = {
      must: [
        {
          should: [
            {
              key: 'interests',
              match: { value: 'home decor & improvement' }
            }
          ],
          minimum_should_match: 1
        }
      ]
    };
    
    console.log('Interest filter:', JSON.stringify(interestFilter, null, 2));
    const resultsWithInterest = await qdrantService.searchProducts(embedding, interestFilter, 10);
    console.log(`Found ${resultsWithInterest.length} products with interest filter`);
    
    // Test 4: Test what interests actually exist in the products
    console.log('\n4. Checking available interests in products:');
    const allInterests = new Set();
    resultsNoFilter.forEach(result => {
      if (result.payload.interests && Array.isArray(result.payload.interests)) {
        result.payload.interests.forEach(interest => allInterests.add(interest));
      }
    });
    console.log('Available interests in database:', Array.from(allInterests));
    
    // Test 5: Test the exact filter that should be applied
    console.log('\n5. Testing the exact filter structure:');
    const exactFilter = {
      must: [
        {
          should: [
            {
              key: 'interests',
              match: { value: 'home decor & improvement' }
            },
            {
              key: 'interests', 
              match: { value: 'art and design' }
            }
          ],
          minimum_should_match: 1
        }
      ]
    };
    
    console.log('Exact filter:', JSON.stringify(exactFilter, null, 2));
    const resultsExact = await qdrantService.searchProducts(embedding, exactFilter, 10);
    console.log(`Found ${resultsExact.length} products with exact filter`);
    
    if (resultsExact.length > 0) {
      console.log('Products found with exact filter:');
      resultsExact.forEach((result, index) => {
        console.log(`${index + 1}. ${result.payload.title}`);
        console.log(`   Interests: ${result.payload.interests}`);
      });
    }
    
  } catch (error) {
    console.error('Debug failed:', error);
  }
};

debugWallPosters();