# Discord Bot Docker Deployment Guide

## 🐳 Docker Setup

This Discord bot is fully containerized and ready for production deployment.

### Prerequisites

- Docker and Docker Compose installed
- Discord bot token and application credentials
- (Optional) Quran Foundation API key

### Quick Start

1. **Clone and configure:**
   ```bash
   # Copy environment template
   cp .env.example .env
   
   # Edit .env with your credentials
   nano .env
   ```

2. **Build and run:**
   ```bash
   # Using Docker Compose (recommended)
   docker-compose up -d
   
   # Or build and run manually
   docker build -t discord-bot .
   docker run -d --name discord-bot --env-file .env discord-bot
   ```

3. **View logs:**
   ```bash
   docker-compose logs -f discord-bot
   ```

### Environment Variables

Required variables in `.env`:

```env
# Discord Configuration
BOT_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_discord_client_id_here
GUILD_ID=your_discord_guild_id_here

# Database (defaults to file:./dev.db)
DATABASE_URL=file:./dev.db

# Quran Foundation API (optional)
QURAN_FOUNDATION_API_KEY=your_api_key_here
```

### Docker Features

#### ✅ Production Optimizations
- **Multi-stage build** for minimal image size
- **Alpine Linux** base for security and size
- **Non-root user** execution
- **Health checks** included
- **Resource limits** configured
- **Logging** rotation setup

#### ✅ Database Integration
- **Prisma ORM** with SQLite
- **Automatic migrations** on startup
- **Correct binary targets** for Alpine Linux
- **Persistent data** via volumes

#### ✅ Canvas Support
- **Native dependencies** pre-installed
- **Arabic font support** for Quran rendering
- **@napi-rs/canvas** fully working

### Database Management

The container automatically handles database setup:

1. **First run**: Creates database and runs all migrations
2. **Subsequent runs**: Updates schema if needed
3. **Data persistence**: Database stored in container filesystem

For production with persistent data:
```yaml
volumes:
  - ./data:/app/prisma
```

### Monitoring & Health

Built-in health check endpoint:
```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' discord-bot

# View health check logs
docker inspect discord-bot | grep -A 10 "Health"
```

### Troubleshooting

#### Common Issues

1. **"Module not found" errors:**
   - Ensure all dependencies are installed
   - Rebuild image: `docker-compose up --build`

2. **Prisma client errors:**
   - Fixed with `linux-musl-openssl-3.0.x` binary target
   - Container automatically generates correct client

3. **Permission errors:**
   - Container runs as `node` user
   - Ensure file permissions are correct

4. **Bot won't start:**
   - Check environment variables
   - Verify Discord token is valid
   - Review logs: `docker-compose logs discord-bot`

#### Debug Mode

Run with debug information:
```bash
docker run --rm -it --env-file .env discord-bot
```

### Production Deployment

#### Resource Requirements
- **Memory**: 128-256MB
- **CPU**: 0.1-0.5 cores
- **Storage**: ~500MB image + data

#### Scaling Options
- **Horizontal**: Multiple guild-specific bots
- **Vertical**: Increase resource limits
- **Load balancing**: Not needed for Discord bots

#### Security Considerations
- Store secrets in environment variables
- Use non-root container execution
- Regular image updates
- Network policies if needed

### Development

For development with live reload:
```bash
# Build development image
docker build -f Dockerfile.dev -t discord-bot:dev .

# Run with volume mounts
docker run -it --rm \
  --env-file .env \
  -v "$(pwd):/app" \
  discord-bot:dev
```

### Support

If you encounter issues:
1. Check the logs first: `docker-compose logs -f`
2. Verify environment variables are set correctly
3. Ensure Discord permissions are configured
4. Review the container health status

For additional help, check the main README or open an issue.
