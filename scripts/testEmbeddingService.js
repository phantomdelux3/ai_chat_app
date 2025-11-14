const sentenceTransformerService = require('../services/sentenceTransformerService');

const testEmbeddingService = async () => {
  console.log('Testing connection to Sentence Transformer service...');
  
  try {
    // Test health check
    console.log('1. Testing health check...');
    const health = await sentenceTransformerService.healthCheck();
    console.log('Health check:', health);
    
    // Test single embedding
    console.log('2. Testing single embedding...');
    const testText = "I need home decor items for my living room";
    const embedding = await sentenceTransformerService.getEmbedding(testText);
    console.log('Single embedding dimensions:', embedding.length);
    console.log('First 5 values:', embedding.slice(0, 5));
    
    // Test batch embeddings
    console.log('3. Testing batch embeddings...');
    const testTexts = [
      "home decor for living room",
      "gift for mother birthday",
      "tech gadgets for brother"
    ];
    const batchEmbeddings = await sentenceTransformerService.getBatchEmbeddings(testTexts);
    console.log('Batch embeddings count:', batchEmbeddings.length);
    console.log('Each embedding dimensions:', batchEmbeddings[0].length);
    
    console.log('✅ All embedding service tests passed!');
    
  } catch (error) {
    console.error('❌ Embedding service test failed:', error.message);
  }
};

testEmbeddingService();