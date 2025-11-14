const qdrantService = require('../services/qdrantService');
const sentenceTransformerService = require('../services/sentenceTransformerService');
const PriceParser = require('../utils/priceParser');

class SimpleProductService {
  async recommendProducts(userMessage, preferences, sessionId) {
    try {
      console.log('Starting product recommendation with preferences:', preferences);

      // Get embedding for user message
      const embedding = await sentenceTransformerService.getEmbedding(userMessage);

      // Build SIMPLE Qdrant filter
      const filter = this.buildSimpleFilter(preferences, userMessage);

      console.log('Simple Qdrant filter:', JSON.stringify(filter, null, 2));

      // Search in Qdrant
      const searchResults = await qdrantService.searchProducts(embedding, filter, 20);
      console.log('Search results:', searchResults.length);

      // Format products
      const products = searchResults
        .filter(result => result.payload && result.payload.title)
        .map((result, index) => {
          const payload = result.payload;
          return {
            id: result.id || `product-${index}`,
            title: payload.title || 'Unknown Product',
            price: payload.price_numeric || payload.price_original || 0,
            discounted_price: payload.price_discounted || null,
            url: payload.product_url || '#',
            image: payload.image_url || '',
            description: payload.description || '',
            brand: payload.brand || '',
            category: payload.category || '',
            score: result.score || 0,
            rank: index + 1
          };
        })
        .slice(0, 5);

      console.log('Final products count:', products.length);
      return products;
    } catch (error) {
      console.error('Product recommendation error:', error);
      return [];
    }
  }

  buildSimpleFilter(preferences, userMessage) {
    console.log('=== BUILDING SIMPLE FILTER ===');
    
    let priceRange = null;

    // Extract price range
    if (preferences.price_range && preferences.price_range !== 'null') {
      priceRange = PriceParser.extractPriceRange(preferences.price_range);
    }

    if (!priceRange && userMessage) {
      priceRange = PriceParser.extractPriceRange(userMessage);
    }

    // Apply price filter if found
    if (priceRange && priceRange.min !== undefined && priceRange.max !== undefined) {
      console.log('Applying price filter:', `${priceRange.min} - ${priceRange.max}`);
      
      // Use the most reliable price field (price_numeric)
      return {
        must: [
          {
            key: 'price_numeric',
            range: {
              gte: priceRange.min,
              lte: priceRange.max
            }
          }
        ]
      };
    }

    console.log('No price filter applied - using semantic search only');
    return {};
  }
}

module.exports = new SimpleProductService();