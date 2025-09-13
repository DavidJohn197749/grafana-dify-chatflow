# Windows Development Setup

This document explains how to run the Grafana Dify Chatflow plugin on Windows.

## Problem

On Windows, the original Docker setup may fail with the error:
```
exec /entrypoint.sh: no such file or directory
```

This happens because Windows uses CRLF line endings, while Linux containers expect LF line endings.

## Solution

We've created Windows-specific Docker files that handle line ending conversion automatically.

## Files Created

- `.config/Dockerfile.windows` - Windows-specific Dockerfile with line ending fix
- `docker-compose.windows.yaml` - Windows-specific docker-compose configuration
- `docker-compose-windows.bat` - Convenient batch script to start the service

## Usage

### Option 1: Using the batch script (Recommended)
```cmd
docker-compose-windows.bat
```

### Option 2: Using docker-compose directly
```cmd
docker compose -f docker-compose.windows.yaml up --build
```

### Option 3: Build only
```cmd
docker compose -f docker-compose.windows.yaml build --no-cache
```

## What's Different

The Windows-specific Dockerfile includes this line:
```dockerfile
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh
```

This command:
1. Removes Windows carriage return characters (`\r`) from the entrypoint script
2. Makes the script executable
3. Ensures proper Unix line endings for Linux containers

## Original Files

The original files remain unchanged and work perfectly on Linux:
- `.config/Dockerfile` - Original Linux-compatible Dockerfile
- `docker-compose.yaml` - Original docker-compose configuration

## Access

Once running, Grafana will be available at: http://localhost:3000
