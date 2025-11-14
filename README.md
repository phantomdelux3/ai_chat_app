# AI Chat Server

AI-powered chat server with semantic search and product recommendations using OpenAI, Qdrant vector database, PostgreSQL, Redis, and Sentence Transformers.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Architecture](#architecture)
- [Installation](#installation)
  - [1. Docker Setup (Redis & Qdrant)](#1-docker-setup-redis--qdrant)
  - [2. Sentence Transformer Service (Python)](#2-sentence-transformer-service-python)
  - [3. PostgreSQL Database Setup](#3-postgresql-database-setup)
  - [4. Node.js Server Setup](#4-nodejs-server-setup)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Endpoints](#api-endpoints)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)

## Features

- 🤖 AI-powered chat interface using OpenAI GPT-3.5-turbo
- 🔍 Semantic product search using Qdrant vector database
- 💾 PostgreSQL for persistent data storage
- ⚡ Redis for session caching and performance optimization
- 🧠 Sentence Transformers for text embeddings (384 dimensions)
- 🎯 Smart product recommendations with price filtering
- 📊 User preference extraction and context management
- 💬 Session-based conversation management

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v14 or higher) and npm
- **Python** (v3.8 or higher) and pip
- **Docker** and Docker Compose
- **PostgreSQL** (v12 or higher)
- **OpenAI API Key** (get one from [OpenAI](https://platform.openai.com/))

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│      Node.js Express Server         │
│  (Port 3000)                        │
└──────┬──────────────────┬───────────┘
       │                  │
       ▼                  ▼
┌─────────────┐    ┌──────────────┐
│  PostgreSQL │    │    Redis     │
│  (Database) │    │   (Cache)    │
└─────────────┘    └──────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Python Flask Service               │
│  (Port 5001)                        │
│  - Sentence Transformers            │
│  - Embedding Generation             │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│      Qdrant Vector Database         │
│  (Port 6333)                        │
│  - Product Embeddings               │
│  - Semantic Search                  │
└─────────────────────────────────────┘
```

## Installation

### 1. Docker Setup (Redis & Qdrant)

First, set up Redis and Qdrant using Docker. Qdrant should already contain your product data.

#### Create Docker Compose File

Create a `docker-compose.yml` file in the project root:

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    container_name: ai-chat-redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes
    restart: unless-stopped
    networks:
      - ai-chat-network

  qdrant:
    image: qdrant/qdrant:latest
    container_name: ai-chat-qdrant
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant-data:/qdrant/storage
      - ./qdrant-data:/qdrant/storage  # Mount your existing data here
    restart: unless-stopped
    networks:
      - ai-chat-network

networks:
  ai-chat-network:
    driver: bridge

volumes:
  redis-data:
  qdrant-data:
```

#### Start Docker Containers

```bash
# Start Redis and Qdrant
docker-compose up -d

# Verify containers are running
docker ps

# Check Redis connection
docker exec -it ai-chat-redis redis-cli ping
# Should return: PONG

# Check Qdrant health
curl http://localhost:6333/health
# Should return: {"status":"ok"}
```

**Note:** If you have existing Qdrant data, ensure it's mounted correctly in the volume. The Qdrant collection should be named `products` (or update `QDRANT_COLLECTION` in your `.env` file).

### 2. Sentence Transformer Service (Python)

The Python service provides embeddings using the `all-MiniLM-L6-v2` model (384 dimensions).

#### Install Python Dependencies

```bash
# Navigate to the sentence transformer directory
cd sentenceTransformer

# Create a virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install flask sentence-transformers
```

#### Create requirements.txt (Optional but recommended)

Create `sentenceTransformer/requirements.txt`:

```txt
flask==3.0.0
sentence-transformers==2.2.2
```

Then install:

```bash
pip install -r requirements.txt
```

#### Start the Python Service

```bash
# Make sure you're in the sentenceTransformer directory
cd sentenceTransformer

# Run the Flask service
python embedding_service.py
```

The service will:
- Download the `all-MiniLM-L6-v2` model on first run (this may take a few minutes)
- Start on `http://localhost:5001`
- Provide endpoints:
  - `GET /health` - Health check
  - `POST /embed` - Generate embedding for single text
  - `POST /embed/batch` - Generate embeddings for multiple texts

**Verify the service is running:**
```bash
curl http://localhost:5001/health
# Should return: {"status":"healthy","model":"all-MiniLM-L6-v2","dimensions":384}
```

**Note:** Keep this service running in a separate terminal. For production, consider using a process manager like `pm2` or `supervisor`.

### 3. PostgreSQL Database Setup

#### Install PostgreSQL

**Windows:**
- Download from [PostgreSQL Downloads](https://www.postgresql.org/download/windows/)
- Install using the installer
- Remember the password you set for the `postgres` user

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**macOS:**
```bash
brew install postgresql
brew services start postgresql
```

#### Create Database and User

```bash
# Connect to PostgreSQL
# On Windows, use pgAdmin or psql from Command Prompt
# On Linux/Mac:
sudo -u postgres psql

# In PostgreSQL shell, run:
CREATE DATABASE ai_chat_db;
CREATE USER ai_chat_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE ai_chat_db TO ai_chat_user;
\q
```

#### Initialize Database Schema

The project includes a script to automatically create all necessary tables:

```bash
# Make sure you're in the project root
cd /path/to/ai-chat-server

# Set environment variables (or use .env file - see Configuration section)
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=ai_chat_db
export DB_USER=ai_chat_user
export DB_PASSWORD=your_secure_password

# Run initialization script
npm run init-db
```

This will create the following tables:
- `sessions` - Chat sessions
- `messages` - Conversation messages
- `product_recommendations` - Recommended products
- `user_preferences` - User preferences and context
- `feedback` - User feedback on recommendations

### 4. Node.js Server Setup

#### Install Node.js Dependencies

```bash
# Make sure you're in the project root
cd /path/to/ai-chat-server

# Install dependencies
npm install
```

This will install:
- Express.js - Web framework
- PostgreSQL client (pg)
- Redis client
- Qdrant client
- OpenAI API client (axios)
- Other dependencies

#### Environment Configuration

Create a `.env` file in the project root:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# PostgreSQL Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_chat_db
DB_USER=ai_chat_user
DB_PASSWORD=your_secure_password

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Qdrant Configuration
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=products

# Sentence Transformer Service
SENTENCE_TRANSFORMER_URL=http://localhost:5001

# OpenAI API
OPENAI_API_KEY=your_openai_api_key_here
```

**Important:** Replace all placeholder values with your actual credentials.

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | 3000 | No |
| `NODE_ENV` | Environment mode | development | No |
| `DB_HOST` | PostgreSQL host | localhost | Yes |
| `DB_PORT` | PostgreSQL port | 5432 | Yes |
| `DB_NAME` | Database name | - | Yes |
| `DB_USER` | Database user | - | Yes |
| `DB_PASSWORD` | Database password | - | Yes |
| `REDIS_URL` | Redis connection URL | redis://localhost:6379 | Yes |
| `QDRANT_URL` | Qdrant server URL | http://localhost:6333 | Yes |
| `QDRANT_COLLECTION` | Qdrant collection name | products | Yes |
| `SENTENCE_TRANSFORMER_URL` | Python service URL | http://localhost:5001 | Yes |
| `OPENAI_API_KEY` | OpenAI API key | - | Yes |

## Running the Application

### Start All Services

You need to run multiple services. Open separate terminal windows/tabs:

#### Terminal 1: Redis & Qdrant (Docker)
```bash
docker-compose up
```

#### Terminal 2: Python Sentence Transformer Service
```bash
cd sentenceTransformer
source venv/bin/activate  # On Windows: venv\Scripts\activate
python embedding_service.py
```

#### Terminal 3: Node.js Server
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

### Verify All Services

```bash
# Check Node.js server
curl http://localhost:3000/health
# Expected: {"status":"OK","timestamp":"..."}

# Check Python service
curl http://localhost:5001/health
# Expected: {"status":"healthy","model":"all-MiniLM-L6-v2","dimensions":384}

# Check Redis
docker exec -it ai-chat-redis redis-cli ping
# Expected: PONG

# Check Qdrant
curl http://localhost:6333/health
# Expected: {"status":"ok"}

# Check PostgreSQL
psql -h localhost -U ai_chat_user -d ai_chat_db -c "SELECT 1;"
# Expected: 1 row returned
```

## API Endpoints

### Chat Endpoints

#### POST `/api/chat/message`
Send a chat message and get AI response with product recommendations.

**Request:**
```json
{
  "sessionId": "optional-session-id",
  "message": "I want aesthetic posters for my room"
}
```

**Response:**
```json
{
  "sessionId": "uuid",
  "assistantResponse": "I found some great aesthetic posters...",
  "products": [
    {
      "id": "product-id",
      "title": "Product Title",
      "price": 999.99,
      "url": "https://...",
      "image": "https://...",
      "score": 0.95
    }
  ],
  "preferences": {
    "product_type": "wall posters",
    "search_query": "aesthetic wall posters room decor",
    "interests": ["home decor"]
  }
}
```

#### POST `/api/chat/session`
Create a new chat session.

**Request:**
```json
{
  "userId": "optional-user-id"
}
```

#### GET `/api/chat/session/:sessionId`
Get session details.

#### GET `/api/chat/session/:sessionId/stats`
Get session statistics and cache info.

#### DELETE `/api/chat/session/:sessionId/cache`
Clear session cache.

### Feedback Endpoints

#### POST `/api/feedback`
Submit feedback on product recommendations.

**Request:**
```json
{
  "sessionId": "uuid",
  "productRecommendationId": "uuid",
  "rating": "positive|negative|neutral",
  "reason": "Optional reason"
}
```

### Session Endpoints

#### GET `/api/sessions`
Get all sessions (with optional filters).

#### DELETE `/api/sessions/:sessionId`
Delete a session.

### Health Check

#### GET `/health`
Server health check endpoint.

## Project Structure

```
ai-chat-server/
├── config/
│   ├── database.js          # PostgreSQL connection pool
│   └── redis.js             # Redis client configuration
├── routes/
│   ├── chat.js              # Chat message endpoints
│   ├── feedback.js          # Feedback endpoints
│   └── sessions.js          # Session management endpoints
├── services/
│   ├── databaseService.js   # Database operations
│   ├── openaiService.js     # OpenAI API integration
│   ├── productService.js    # Product recommendation logic
│   ├── qdrantService.js     # Qdrant vector search
│   ├── sentenceTransformerService.js  # Embedding service client
│   └── sessionService.js    # Session management with Redis
├── sentenceTransformer/
│   └── embedding_service.py # Python Flask service for embeddings
├── scripts/
│   ├── initDatabase.js      # Database initialization script
│   └── ...                  # Other utility scripts
├── utils/
│   └── priceParser.js       # Price extraction utilities
├── server.js                # Express server entry point
├── package.json             # Node.js dependencies
├── docker-compose.yml       # Docker configuration (create this)
└── .env                     # Environment variables (create this)
```

## Troubleshooting

### Common Issues

#### 1. Python Service Not Starting
**Problem:** `ModuleNotFoundError` or import errors

**Solution:**
```bash
# Ensure virtual environment is activated
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# Reinstall dependencies
pip install --upgrade flask sentence-transformers
```

#### 2. Qdrant Connection Failed
**Problem:** Cannot connect to Qdrant

**Solution:**
```bash
# Check if Qdrant container is running
docker ps | grep qdrant

# Check Qdrant logs
docker logs ai-chat-qdrant

# Restart Qdrant
docker-compose restart qdrant

# Verify collection exists
curl http://localhost:6333/collections/products
```

#### 3. Redis Connection Failed
**Problem:** Redis connection error

**Solution:**
```bash
# Check if Redis container is running
docker ps | grep redis

# Test Redis connection
docker exec -it ai-chat-redis redis-cli ping

# Restart Redis
docker-compose restart redis
```

#### 4. PostgreSQL Connection Failed
**Problem:** Database connection error

**Solution:**
```bash
# Verify PostgreSQL is running
# Windows: Check Services
# Linux: sudo systemctl status postgresql
# Mac: brew services list

# Test connection
psql -h localhost -U ai_chat_user -d ai_chat_db

# Check credentials in .env file
```

#### 5. OpenAI API Errors
**Problem:** OpenAI API key invalid or rate limited

**Solution:**
- Verify your API key in `.env` file
- Check your OpenAI account has credits
- Verify API key format: `sk-...`
- Check rate limits in OpenAI dashboard

#### 6. Embedding Service Timeout
**Problem:** Timeout when getting embeddings

**Solution:**
- Ensure Python service is running on port 5001
- Check `SENTENCE_TRANSFORMER_URL` in `.env`
- First run may be slow (model download)
- Increase timeout in `sentenceTransformerService.js` if needed

#### 7. Database Schema Errors
**Problem:** Tables not found or migration errors

**Solution:**
```bash
# Reinitialize database
npm run init-db

# Or manually run SQL from scripts/initDatabase.js
```

### Debug Mode

Enable detailed logging by setting:
```env
NODE_ENV=development
```

Check logs in:
- Node.js server: Console output
- Python service: Console output
- Docker containers: `docker logs <container-name>`

### Performance Optimization

1. **Redis Caching:** Already implemented for sessions
2. **Connection Pooling:** PostgreSQL pool configured in `config/database.js`
3. **Batch Embeddings:** Use `/embed/batch` for multiple texts
4. **Qdrant Indexing:** Ensure Qdrant collection has proper indexes

## Additional Notes

- The Qdrant collection should already contain product data with embeddings
- The embedding model (`all-MiniLM-L6-v2`) generates 384-dimensional vectors
- Session data is cached in Redis for 1 hour by default
- Product recommendations use semantic search combined with price filtering
- The system extracts user preferences using OpenAI and maintains conversation context

## License

[Add your license information here]

## Support

For issues and questions, please [create an issue](https://github.com/your-repo/issues) or contact the development team.

