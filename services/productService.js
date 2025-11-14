const qdrantService = require('./qdrantService');
const sentenceTransformerService = require('./sentenceTransformerService');
const PriceParser = require('../utils/priceParser');

class ProductService {
  async recommendProducts(userMessage, preferences, sessionId) {
    try {
      console.log('Starting AI-powered product recommendation');
      console.log('AI Preferences:', preferences);

      // Use AI-optimized search query or fallback to original message
      const searchQuery = preferences.search_query || userMessage;

      // Get embedding for the optimized query
      const embedding = await sentenceTransformerService.getEmbedding(searchQuery);
      console.log('Search query:', searchQuery);

      // Build smart filter based on AI suggestions
      const filter = this.buildSmartFilter(preferences, userMessage);

      console.log('Qdrant filter:', JSON.stringify(filter, null, 2));

      // Search in Qdrant
      const searchResults = await qdrantService.searchProducts(embedding, filter, 30);
      console.log('Semantic search results:', searchResults.length);

      // Apply relevance scoring
      const scoredResults = this.scoreResultsByRelevance(searchResults, preferences, userMessage);

      // Format products
      const products = scoredResults
        .filter(result => result.payload && result.payload.title)
        .map((result, index) => ({
          id: result.id || `product-${index}`,
          title: result.payload.title || 'Unknown Product',
          price: result.payload.price_numeric || result.payload.price_original || 0,
          discounted_price: result.payload.price_discounted || null,
          url: result.payload.product_url || '#',
          image: result.payload.image_url || '',
          description: result.payload.description || '',
          brand: result.payload.brand || '',
          category: result.payload.category || '',
          score: result.finalScore || result.score || 0,
          rank: index + 1
        }))
        .slice(0, 5);

      console.log('Final products:', products.length);
      return products;
    } catch (error) {
      console.error('Product recommendation error:', error);
      return [];
    }
  }
  async buildSmartFilter(preferences, userMessage, embedding) {
    console.log('=== BUILDING SMART FILTER ===');
    console.log('Preferences:', preferences);
    console.log('User message:', userMessage);

    // Extract price range with smart strategy
    const priceStrategy = this.extractPriceStrategy(preferences, userMessage);

    if (!priceStrategy) {
      console.log('No price strategy - building filter without price constraints');
      return this.buildContentFilter(preferences, userMessage);
    }

    console.log('Price strategy:', priceStrategy);

    // Try progressive price filtering
    const results = await this.tryProgressivePriceFiltering(priceStrategy, preferences, userMessage, embedding);

    if (results.filter) {
      console.log('Using progressive price filter');
      return results.filter;
    }

    

    // Fallback to content-only filter
    console.log('Falling back to content-only filter');
    return this.buildContentFilter(preferences, userMessage);
  }

  extractPriceStrategy(preferences, userMessage) {
    let priceRange = null;

    // First try preferences from OpenAI
    if (preferences.price_range && preferences.price_range !== 'null') {
      priceRange = PriceParser.extractPriceRange(preferences.price_range);
      console.log('Price range from preferences:', preferences.price_range, '->', priceRange);
    }

    // If still no price range, try extracting from user message directly
    if (!priceRange && userMessage) {
      priceRange = PriceParser.extractPriceRange(userMessage);
      console.log('Price range from user message:', priceRange);
    }

    if (!priceRange) return null;

    // Use smart price strategy
    return PriceParser.extractPriceRangeWithStrategy(userMessage);
  }

  async tryProgressivePriceFiltering(priceStrategy, preferences, userMessage, embedding) {
    const { baseRange, smartRanges } = priceStrategy;

    console.log('Trying progressive price filtering with ranges:', smartRanges);

    // Try each price bracket in priority order
    for (const priceBracket of smartRanges) {
      console.log(`Trying price bracket: ${priceBracket.min} - ${priceBracket.max} (${priceBracket.label})`);

      const filter = this.buildPriceBracketFilter(priceBracket, preferences, userMessage);

      const results = await qdrantService.searchProducts(embedding, filter, 10);
      console.log(`Found ${results.length} products in bracket ${priceBracket.label}`);

      // If we found enough products, use this bracket
      if (results.length >= 3) {
        console.log(`✅ Enough products found in ${priceBracket.label} bracket`);
        return { filter, results, bracket: priceBracket };
      }

      console.log(`❌ Not enough products in ${priceBracket.label} bracket, trying next...`);
    }

    // If no bracket has enough products, use the broadest filter
    console.log('No bracket has enough products, using broad price filter');
    const broadFilter = this.buildPriceBracketFilter(
      { min: 0, max: baseRange.max },
      preferences,
      userMessage
    );
    return { filter: broadFilter, results: [], bracket: null };
  }

    getQdrantInterests(interests) {
    const interestMap = {
      'home decor': 'home decor & improvement',
      'tech': 'electronics & gadgets',
      'electronics': 'electronics & gadgets',
      'art': 'art and design',
      'clothing': 'fashion & clothing',
      'fashion': 'fashion & clothing',
      'sports': 'sports & fitness',
      'fitness': 'sports & fitness',
      'books': 'books & reading',
      'music': 'music & entertainment',
      'travel': 'travel & adventure',
      'food': 'food & cooking',
      'drink': 'drink'
    };

    return interests
      .map(interest => interestMap[interest] || interest)
      .filter(interest => Object.values(interestMap).includes(interest));
  }

  scoreResultsByRelevance(results, preferences, userMessage) {
    const searchQuery = preferences.search_query || userMessage;
    const queryWords = searchQuery.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    
    return results
      .map(result => {
        let relevanceScore = result.score || 0;
        const payload = result.payload;
        const title = (payload.title || '').toLowerCase();
        const description = (payload.description || '').toLowerCase();
        const category = (payload.category || '').toLowerCase();

        // Boost exact matches in title
        queryWords.forEach(word => {
          if (title.includes(word)) relevanceScore *= 1.2;
          if (description.includes(word)) relevanceScore *= 1.1;
        });

        // Boost category matches
        if (preferences.filters && preferences.filters.some(filter => 
          category.includes(filter.toLowerCase())
        )) {
          relevanceScore *= 1.15;
        }

        // Boost price relevance (if user mentioned price)
        const userPrice = PriceParser.extractPriceRange(userMessage);
        if (userPrice && payload.price_numeric) {
          const priceDiff = Math.abs(payload.price_numeric - (userPrice.max / 2));
          const priceRelevance = Math.max(0, 1 - (priceDiff / userPrice.max));
          relevanceScore *= (0.8 + (priceRelevance * 0.4));
        }

        return {
          ...result,
          finalScore: relevanceScore
        };
      })
      .sort((a, b) => b.finalScore - a.finalScore);
  }

  buildPriceBracketFilter(priceBracket, preferences, userMessage) {
    const filter = { must: [] };

    // Add price filter as MUST condition (strict)
    filter.must.push({
      key: 'price_numeric',
      range: {
        gte: Math.floor(priceBracket.min),
        lte: Math.ceil(priceBracket.max)
      }
    });

    console.log(`✅ Added STRICT price filter: ${Math.floor(priceBracket.min)} - ${Math.ceil(priceBracket.max)}`);

    // Add interests as SHOULD conditions (optional)
    const interestsFilter = this.buildInterestsFilter(preferences, userMessage);
    if (interestsFilter.should && interestsFilter.should.length > 0) {
      filter.must.push(interestsFilter);
    }

    return filter;
  }

  buildContentFilter(preferences, userMessage) {
    const filter = { must: [] };

    // Only add interests filter, no price constraints
    const interestsFilter = this.buildInterestsFilter(preferences, userMessage);
    if (interestsFilter.should && interestsFilter.should.length > 0) {
      filter.must.push(interestsFilter);
    }

    console.log('✅ Built content-only filter (no price constraints)');
    return filter;
  }

  buildInterestsFilter(preferences, userMessage) {
    const interestsFilter = { should: [] };

    // Detect interests from message
    const detectedInterests = this.detectInterestsFromMessage(userMessage);
    console.log('Detected interests from message:', detectedInterests);

    // Combine with preferences from OpenAI
    const allInterests = [...new Set([
      ...(preferences.interests || []),
      ...detectedInterests
    ])].filter(interest => interest && interest !== 'null');

    console.log('All interests to filter:', allInterests);

    if (allInterests.length > 0) {
      const mappedInterests = this.mapInterestsToQdrant(allInterests);
      console.log('Mapped interests for Qdrant:', mappedInterests);

      // Add each interest as a should condition
      mappedInterests.forEach(interest => {
        interestsFilter.should.push({
          key: 'interests',
          match: { value: interest }
        });
      });

      console.log('✅ Added interest filters:', mappedInterests);
    }

    return interestsFilter;
  }

  detectInterestsFromMessage(message) {
    if (!message) return [];

    const lowerMessage = message.toLowerCase();
    const interests = [];

    const interestKeywords = {
      'home decor': ['wall', 'poster', 'decor', 'decorating', 'room', 'home', 'living room', 'bedroom', 'wall art', 'posters', 'sheet', 'bed', 'pillow', 'blanket', 'curtain', 'furniture'],
      'art': ['art', 'artistic', 'design', 'painting', 'drawing', 'creative'],
      'tech': ['tech', 'gadget', 'electronic', 'phone', 'laptop', 'headphone', 'camera', 'smart'],
      'clothing': ['shirt', 'dress', 'cloth', 'fashion', 'wear', 'outfit', 'apparel'],
      'sports': ['sport', 'fitness', 'gym', 'exercise', 'running', 'training'],
      'books': ['book', 'read', 'novel', 'literature'],
      'music': ['music', 'song', 'instrument', 'guitar', 'piano'],
      'travel': ['travel', 'luggage', 'bag', 'suitcase', 'backpack']
    };

    for (const [interest, keywords] of Object.entries(interestKeywords)) {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        interests.push(interest);
      }
    }

    return interests;
  }

  mapInterestsToQdrant(interests) {
    const interestMap = {
      'home decor': 'home decor & improvement',
      'tech': 'electronics & gadgets',
      'food': 'food & cooking',
      'drink': 'drink',
      'clothing': 'fashion & clothing',
      'sports': 'sports & fitness',
      'books': 'books & reading',
      'music': 'music & entertainment',
      'art': 'art and design',
      'travel': 'travel & adventure',
      'fitness': 'sports & fitness',
      'gaming': 'electronics & gadgets'
    };

    return interests.map(interest => {
      const simpleInterest = interest.toLowerCase().trim();
      return interestMap[simpleInterest] || simpleInterest;
    });
  }
}

module.exports = new ProductService();