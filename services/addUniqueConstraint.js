const { Client } = require('pg');
require('dotenv').config();

const addUniqueConstraint = async () => {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL database');

    // Add unique constraint to user_preferences table
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'user_preferences_session_id_key'
        ) THEN
          ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_session_id_key UNIQUE (session_id);
        END IF;
      END $$;
    `);

    console.log('Unique constraint added successfully');
    await client.end();
    
  } catch (error) {
    console.error('Error adding unique constraint:', error);
    process.exit(1);
  }
};

addUniqueConstraint();