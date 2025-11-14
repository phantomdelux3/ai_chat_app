const axios = require('axios');

class SentenceTransformerService {
  constructor() {
    // Update to match your Python service port 5001
    this.baseURL = process.env.SENTENCE_TRANSFORMER_URL || 'http://localhost:5001';
    this.timeout = 10000; // 10 second timeout
  }

  async getEmbedding(text) {
    try {
      console.log('Getting embedding for text:', text.substring(0, 50) + '...');
      
      // Your Python service uses /embed endpoint, not /encode
      const response = await axios.post(`${this.baseURL}/embed`, {
        text: text
      }, {
        timeout: this.timeout
      });

      console.log('Embedding received, dimensions:', response.data.dimensions);
      return response.data.embedding;
    } catch (error) {
      console.error('Sentence Transformer connection error:', error.message);
      
      if (error.code === 'ECONNREFUSED') {
        console.error('Cannot connect to embedding service at:', this.baseURL);
        console.error('Make sure your Python Flask service is running on port 5001');
      }
      
      // Use fallback embedding
      return this.generateFallbackEmbedding(text);
    }
  }

  async getBatchEmbeddings(texts) {
    try {
      console.log('Getting batch embeddings for', texts.length, 'texts');
      
      const response = await axios.post(`${this.baseURL}/embed/batch`, {
        texts: texts
      }, {
        timeout: this.timeout
      });

      console.log('Batch embeddings received, count:', response.data.count);
      return response.data.embeddings;
    } catch (error) {
      console.error('Batch embedding error:', error.message);
      return texts.map(text => this.generateFallbackEmbedding(text));
    }
  }

  generateFallbackEmbedding(text) {
    // Create a simple deterministic embedding based on text content
    const embedding = Array(384).fill(0);
    const words = text.toLowerCase().split(/\s+/);
    
    words.forEach(word => {
      // Simple hash to distribute values
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = ((hash << 5) - hash) + word.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
      }
      
      // Distribute the influence across the embedding dimensions
      for (let i = 0; i < 384; i++) {
        const seed = (hash * (i + 1)) % 384;
        embedding[seed] += (Math.sin(hash + i) * 0.1);
      }
    });
    
    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      for (let i = 0; i < 384; i++) {
        embedding[i] /= norm;
      }
    }
    
    console.log('Using fallback embedding for:', text.substring(0, 30));
    return embedding;
  }

  // Health check for the Python service
  async healthCheck() {
    try {
      const response = await axios.get(`${this.baseURL}/health`, {
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      console.error('Health check failed:', error.message);
      return { status: 'unhealthy', error: error.message };
    }
  }
}

module.exports = new SentenceTransformerService();