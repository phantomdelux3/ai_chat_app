const qdrantService = require('../services/qdrantService');
const sentenceTransformerService = require('../services/sentenceTransformerService');
const PriceParser = require('../utils/priceParser');

const debugQdrantPrices = async () => {
  console.log('=== DEBUGGING QDRANT PRICES ===\n');
  
  try {
    // Test embedding for "wall posters"
    const embedding = await sentenceTransformerService.getEmbedding("wall posters for room decor");
    
    // Test 1: Search without any filters
    console.log('1. Searching WITHOUT filters:');
    const resultsNoFilter = await qdrantService.searchProducts(embedding, {}, 10);
    console.log(`Found ${resultsNoFilter.length} products without filter`);
    
    resultsNoFilter.forEach((result, index) => {
      const payload = result.payload;
      console.log(`${index + 1}. ${payload.title}`);
      console.log(`   Price: ${payload.price_numeric || payload.price_original}`);
      console.log(`   Price Range: ${payload.price_range}`);
      console.log(`   Category: ${payload.category}`);
      console.log(`   Interests: ${payload.interests}`);
      console.log('---');
    });

    // Test 2: Check what price_range values exist
    console.log('\n2. Checking available price_range values:');
    const priceRanges = new Set();
    const allPrices = [];
    
    resultsNoFilter.forEach(result => {
      if (result.payload.price_range) {
        priceRanges.add(result.payload.price_range);
      }
      if (result.payload.price_numeric) {
        allPrices.push(result.payload.price_numeric);
      }
    });
    
    console.log('Available price_range values:', Array.from(priceRanges));
    console.log('Price statistics:');
    console.log(`   Min: ${Math.min(...allPrices)}`);
    console.log(`   Max: ${Math.max(...allPrices)}`);
    console.log(`   Avg: ${(allPrices.reduce((a, b) => a + b, 0) / allPrices.length).toFixed(2)}`);

    // Test 3: Test with price filter "5000"
    console.log('\n3. Testing with price filter "5000":');
    const priceRange5000 = PriceParser.extractPriceRange('5000');
    console.log('PriceParser result for "5000":', priceRange5000);
    
    const filter5000 = {
      must: [
        {
          key: "price_range",
          match: { value: priceRange5000 }
        }
      ]
    };
    
    console.log('Filter for 5000:', JSON.stringify(filter5000, null, 2));
    
    const resultsWith5000Filter = await qdrantService.searchProducts(embedding, filter5000, 10);
    console.log(`Found ${resultsWith5000Filter.length} products with 5000 filter`);
    
    // Test 4: Test with different price ranges
    console.log('\n4. Testing different price ranges:');
    const testRanges = ['0-500', '0-1000', '1000-2000', '2000-5000', '5000-10000'];
    
    for (const range of testRanges) {
      const filter = {
        must: [
          {
            key: "price_range",
            match: { value: range }
          }
        ]
      };
      
      const results = await qdrantService.searchProducts(embedding, filter, 5);
      console.log(`Range "${range}": ${results.length} products`);
      
      if (results.length > 0) {
        results.forEach(result => {
          console.log(`   - ${result.payload.title} (${result.payload.price_numeric})`);
        });
      }
    }

  } catch (error) {
    console.error('Debug failed:', error);
  }
};

debugQdrantPrices();