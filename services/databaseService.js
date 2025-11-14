const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class DatabaseService {
  // Session management
  async createSession(userId = null) {
    const sessionId = uuidv4();
    const result = await pool.query(
      'INSERT INTO sessions (id, user_id) VALUES ($1, $2) RETURNING *',
      [sessionId, userId]
    );
    return result.rows[0];
  }

  async getSession(sessionId) {
    const result = await pool.query('SELECT * FROM sessions WHERE id = $1', [sessionId]);
    return result.rows[0];
  }

  // Message management
  async saveMessage(sessionId, role, content) {
    const messageId = uuidv4();
    const result = await pool.query(
      'INSERT INTO messages (id, session_id, role, content) VALUES ($1, $2, $3, $4) RETURNING *',
      [messageId, sessionId, role, content]
    );
    return result.rows[0];
  }

  async getSessionMessages(sessionId, limit = 50) {
    const result = await pool.query(
      'SELECT * FROM messages WHERE session_id = $1 ORDER BY created_at ASC LIMIT $2',
      [sessionId, limit]
    );
    return result.rows;
  }

  // Product recommendations
  async saveProductRecommendations(sessionId, messageId, products) {
    if (!products || products.length === 0) return;

    const values = products.map((product, index) => 
      `('${uuidv4()}', '${sessionId}', '${messageId}', '${product.id}', '${product.title.replace(/'/g, "''")}', ${product.price || 'NULL'}, '${product.url}', '${product.image}', ${index + 1})`
    ).join(',');

    if (values) {
      await pool.query(`
        INSERT INTO product_recommendations (id, session_id, message_id, product_id, product_title, product_price, product_url, product_image, rank)
        VALUES ${values}
      `);
    }
  }

  async getMessageRecommendations(messageId) {
    const result = await pool.query(
      `SELECT * FROM product_recommendations WHERE message_id = $1 ORDER BY rank ASC`,
      [messageId]
    );
    return result.rows;
  }

  // Feedback
  async saveFeedback(sessionId, productRecommendationId, rating, reason = null) {
    const result = await pool.query(
      'INSERT INTO feedback (session_id, product_recommendation_id, rating, reason) VALUES ($1, $2, $3, $4) RETURNING *',
      [sessionId, productRecommendationId, rating, reason]
    );
    return result.rows[0];
  }

  // User preferences
  async saveUserPreferences(sessionId, preferences) {
    // Parse price range to min and max
    let price_min = null;
    let price_max = null;
    
    if (preferences.price_range) {
      const priceRange = this.parsePriceRange(preferences.price_range);
      if (priceRange) {
        price_min = priceRange.min;
        price_max = priceRange.max;
      }
    }

    // Convert interests to array if it's a string
    let interestsArray = [];
    if (preferences.interests) {
      if (Array.isArray(preferences.interests)) {
        interestsArray = preferences.interests;
      } else if (typeof preferences.interests === 'string') {
        interestsArray = [preferences.interests];
      }
    }

    // Use UPSERT with the unique constraint
    const result = await pool.query(
      `INSERT INTO user_preferences 
       (session_id, occasion, persona, age_range, gender, interests, price_min, price_max) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (session_id) 
       DO UPDATE SET 
         occasion = EXCLUDED.occasion,
         persona = EXCLUDED.persona,
         age_range = EXCLUDED.age_range,
         gender = EXCLUDED.gender,
         interests = EXCLUDED.interests,
         price_min = EXCLUDED.price_min,
         price_max = EXCLUDED.price_max,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        sessionId,
        preferences.occasion,
        preferences.persona,
        preferences.age,
        preferences.gender,
        interestsArray,
        price_min,
        price_max
      ]
    );
    
    return result.rows[0];
  }

  parsePriceRange(priceRange) {
    if (!priceRange) return null;
    
    // Handle string ranges like "10-50", "50-100", etc.
    if (typeof priceRange === 'string') {
      if (priceRange.includes('-')) {
        const [min, max] = priceRange.split('-').map(Number);
        if (!isNaN(min) && !isNaN(max)) {
          return { min, max };
        }
      } else if (priceRange.endsWith('+')) {
        const min = Number(priceRange.replace('+', ''));
        if (!isNaN(min)) {
          return { min, max: 10000 };
        }
      }
      
      // Handle common price range strings
      const ranges = {
        '10-50': { min: 10, max: 50 },
        '50-100': { min: 50, max: 100 },
        '100-200': { min: 100, max: 200 },
        '200-500': { min: 200, max: 500 },
        '500+': { min: 500, max: 10000 },
        'under 50': { min: 0, max: 50 },
        '50 to 100': { min: 50, max: 100 },
        '100 to 200': { min: 100, max: 200 },
        'over 500': { min: 500, max: 10000 }
      };
      
      const normalizedRange = priceRange.toLowerCase().trim();
      return ranges[normalizedRange] || null;
    }
    
    // Handle object format
    if (typeof priceRange === 'object') {
      return {
        min: priceRange.min || priceRange.price_min || null,
        max: priceRange.max || priceRange.price_max || null
      };
    }
    
    return null;
  }

  async getUserPreferences(sessionId) {
    const result = await pool.query(
      'SELECT * FROM user_preferences WHERE session_id = $1',
      [sessionId]
    );
    return result.rows[0];
  }

  // Additional utility methods
  async getRecentSessions(userId, limit = 10) {
    const result = await pool.query(
      'SELECT * FROM sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );
    return result.rows;
  }

  async deleteSession(sessionId) {
    await pool.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
    return { message: 'Session deleted successfully' };
  }
}

module.exports = new DatabaseService();