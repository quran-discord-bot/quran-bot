# Multi-Platform Docker Support

This project supports building Docker images for both `linux/amd64` and `linux/arm64` architectures, making it compatible with:

- **x86_64 devices**: Traditional servers, most cloud instances, Intel/AMD PCs
- **ARM64 devices**: Apple Silicon Macs (M1/M2/M3), Raspberry Pi 4+, AWS Graviton, cloud ARM instances

## How It Works

### GitHub Actions Workflow

The GitHub Actions workflow (`.github/workflows/docker-build.yml`) automatically:

1. **For pull requests and pushes to main**:

   - Builds a multi-platform image for both amd64 and arm64
   - Creates a single-platform amd64 image for testing
   - Tests the container startup
   - Uploads the test image as an artifact

2. **For tagged releases**:
   - Builds and pushes multi-platform images to GitHub Container Registry (GHCR)
   - Images are available at `ghcr.io/runsdev/discord-bot:latest` and `ghcr.io/runsdev/discord-bot:<tag>`

### Prisma Configuration

The `prisma/schema.prisma` includes binary targets for both architectures:

```prisma
generator client {
  provider      = "prisma-client-js"
  output        = "../generated/prisma"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x", "linux-musl-arm64-openssl-3.0.x"]
}
```

This ensures Prisma works correctly on both amd64 and arm64 Alpine Linux containers.

## Usage

### Pulling Multi-Platform Images

When you pull the image, Docker automatically selects the correct architecture:

```bash
# This will pull the correct architecture for your system
docker pull ghcr.io/runsdev/discord-bot:latest
```

### Running on Different Architectures

The same `docker-compose.yml` and commands work on both architectures:

```bash
# Works on both amd64 and arm64
docker-compose up -d
```

### Manual Building

To build locally for a specific platform:

```bash
# Build for current architecture
docker build -t discord-bot .

# Build for specific architecture
docker build --platform linux/amd64 -t discord-bot:amd64 .
docker build --platform linux/arm64 -t discord-bot:arm64 .

# Build for multiple platforms (requires buildx)
docker buildx build --platform linux/amd64,linux/arm64 -t discord-bot:multi .
```

## Architecture Notes

- **Alpine Linux**: Base image chosen for small size and good multi-arch support
- **Node.js 18**: LTS version with excellent multi-platform support
- **Canvas dependencies**: All required packages available for both architectures
- **Performance**: ARM64 may show different performance characteristics, especially for image processing tasks

## Troubleshooting

If you encounter architecture-specific issues:

1. Check which platform you're running:

   ```bash
   docker run --rm discord-bot:latest uname -m
   ```

2. Force a specific platform:

   ```bash
   docker run --platform linux/amd64 ghcr.io/runsdev/discord-bot:latest
   ```

3. For local development on ARM64 Macs, the image should work natively without emulation.
