const qdrantService = require('../services/qdrantService');
const sentenceTransformerService = require('../services/sentenceTransformerService');

const testQdrantSchema = async () => {
  console.log('Testing Qdrant schema compatibility...');
  
  try {
    // Test collection exists
    const collectionExists = await qdrantService.checkCollectionExists();
    console.log('Collection exists:', collectionExists);
    
    if (collectionExists) {
      const collectionInfo = await qdrantService.getCollectionInfo();
      console.log('Collection info:', {
        name: collectionInfo.name,
        vectors: collectionInfo.vectors
      });
    }
    
    // Test search with home decor
    const embedding = await sentenceTransformerService.getEmbedding("home decor bed sheets");
    
    // Test with different filters
    const testFilters = [
      {},
      { 
        must: [
          {
            key: "interests",
            match: { value: "home decor & improvement" }
          }
        ]
      },
      {
        must: [
          {
            should: [
              {
                key: "interests",
                match: { value: "home decor & improvement" }
              },
              {
                key: "interests", 
                match: { value: "art and design" }
              }
            ]
          }
        ]
      }
    ];
    
    for (let i = 0; i < testFilters.length; i++) {
      console.log(`\n=== Test ${i + 1} ===`);
      console.log('Filter:', JSON.stringify(testFilters[i]));
      
      const results = await qdrantService.searchProducts(embedding, testFilters[i], 3);
      console.log(`Found ${results.length} results`);
      
      if (results.length > 0) {
        console.log('First result:');
        console.log('- Title:', results[0].payload.title);
        console.log('- Interests:', results[0].payload.interests);
        console.log('- Price:', results[0].payload.price_numeric);
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
};

testQdrantSchema();