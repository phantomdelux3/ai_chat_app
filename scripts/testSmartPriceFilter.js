const qdrantService = require('../services/qdrantService');
const sentenceTransformerService = require('../services/sentenceTransformerService');
const PriceParser = require('../utils/priceParser');

const testSmartPriceFilter = async () => {
  console.log('=== TESTING SMART PRICE FILTERING ===\n');
  
  try {
    const testCases = [
      "wall posters under 2000",
      "bed sheets under 1000", 
      "gadgets around 5000",
      "home decor items under 1500"
    ];

    for (const testCase of testCases) {
      console.log(`\n🔍 Testing: "${testCase}"`);
      
      const embedding = await sentenceTransformerService.getEmbedding(testCase);
      const priceStrategy = PriceParser.extractPriceRangeWithStrategy(testCase);
      
      if (!priceStrategy) {
        console.log('No price strategy found');
        continue;
      }

      console.log('Price strategy:', JSON.stringify(priceStrategy, null, 2));

      // Test each bracket
      for (const bracket of priceStrategy.smartRanges) {
        const filter = {
          must: [
            {
              key: 'price_numeric',
              range: {
                gte: Math.floor(bracket.min),
                lte: Math.ceil(bracket.max)
              }
            }
          ]
        };

        const results = await qdrantService.searchProducts(embedding, filter, 5);
        console.log(`Bracket ${bracket.label} (${Math.floor(bracket.min)}-${Math.ceil(bracket.max)}): ${results.length} products`);
        
        if (results.length > 0) {
          results.slice(0, 2).forEach(result => {
            console.log(`   - ${result.payload.title} (₹${result.payload.price_numeric})`);
          });
        }
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
};

testSmartPriceFilter();