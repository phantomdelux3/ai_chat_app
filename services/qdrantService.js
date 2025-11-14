const { QdrantClient } = require('@qdrant/js-client-rest');

class QdrantService {
  constructor() {
    this.client = new QdrantClient({
      url: process.env.QDRANT_URL
    });
    this.collectionName = process.env.QDRANT_COLLECTION || 'products';
  }

  async searchProducts(vector, filter = {}, limit = 5) {
    try {
      console.log(`Searching Qdrant collection: ${this.collectionName}`);
      console.log(`Filter: ${JSON.stringify(filter)}`);
      console.log(`Limit: ${limit}`);

      const searchResult = await this.client.search(this.collectionName, {
        vector,
        filter,
        limit,
        with_payload: true,
        with_vector: false
      });

      console.log(`Qdrant search returned ${searchResult.length} results`);
      
      // Log first result payload structure for debugging
      if (searchResult.length > 0) {
        console.log('First result payload keys:', Object.keys(searchResult[0].payload));
        console.log('First result title:', searchResult[0].payload.title);
      }

      return searchResult;
    } catch (error) {
      console.error('Qdrant search error:', error);
      throw error;
    }
  }

  async checkCollectionExists() {
    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(
        collection => collection.name === this.collectionName
      );
      console.log(`Collection ${this.collectionName} exists: ${exists}`);
      return exists;
    } catch (error) {
      console.error('Error checking collection:', error);
      return false;
    }
  }

  // Get collection info for debugging
  async getCollectionInfo() {
    try {
      const collection = await this.client.getCollection(this.collectionName);
      return collection;
    } catch (error) {
      console.error('Error getting collection info:', error);
      return null;
    }
  }
}

module.exports = new QdrantService();