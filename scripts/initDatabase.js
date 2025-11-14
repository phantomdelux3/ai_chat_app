const { Client } = require('pg');
require('dotenv').config();

const initDatabase = async () => {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'postgres'
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    // Check if database exists
    const dbCheck = await client.query(`
      SELECT 1 FROM pg_database WHERE datname = '${process.env.DB_NAME}'
    `);

    if (dbCheck.rows.length === 0) {
      await client.query(`CREATE DATABASE ${process.env.DB_NAME}`);
      console.log(`Database ${process.env.DB_NAME} created successfully`);
    } else {
      console.log(`Database ${process.env.DB_NAME} already exists`);
    }

    await client.end();

    // Connect to the target database
    const dbClient = new Client({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    await dbClient.connect();

    // Drop tables if they exist (for clean setup)
    await dbClient.query(`
      DROP TABLE IF EXISTS feedback CASCADE;
      DROP TABLE IF EXISTS product_recommendations CASCADE;
      DROP TABLE IF EXISTS user_preferences CASCADE;
      DROP TABLE IF EXISTS messages CASCADE;
      DROP TABLE IF EXISTS sessions CASCADE;
    `);

    // Create tables
    await dbClient.query(`
      CREATE TABLE sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await dbClient.query(`
      CREATE TABLE messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await dbClient.query(`
      CREATE TABLE product_recommendations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
        message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
        product_id VARCHAR(255) NOT NULL,
        product_title TEXT NOT NULL,
        product_price DECIMAL(10,2),
        product_url TEXT,
        product_image TEXT,
        rank INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await dbClient.query(`
      CREATE TABLE user_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
        occasion VARCHAR(100),
        persona VARCHAR(100),
        age_range VARCHAR(50),
        gender VARCHAR(50),
        interests TEXT[],
        price_min DECIMAL(10,2),
        price_max DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(session_id)  -- ADD THIS UNIQUE CONSTRAINT
      );
    `);

    await dbClient.query(`
      CREATE TABLE feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
        product_recommendation_id UUID REFERENCES product_recommendations(id) ON DELETE CASCADE,
        rating VARCHAR(50) NOT NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes
    await dbClient.query(`
      CREATE INDEX idx_messages_session_id ON messages(session_id);
      CREATE INDEX idx_messages_created_at ON messages(created_at);
      CREATE INDEX idx_product_recommendations_session_id ON product_recommendations(session_id);
      CREATE INDEX idx_product_recommendations_message_id ON product_recommendations(message_id);
      CREATE INDEX idx_feedback_product_recommendation_id ON feedback(product_recommendation_id);
      CREATE INDEX idx_user_preferences_session_id ON user_preferences(session_id);
    `);

    console.log('All tables created successfully');
    await dbClient.end();
    
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
};

initDatabase();