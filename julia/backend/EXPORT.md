# Exporting to On-Prem Server

Follow these steps to deploy this backend on your local server.

## Option 1: Git-based Deployment (Recommended)
This is the easiest way to keep your server up to date.

1. **Clone the repository** on the target server:
   ```bash
   git clone <your-repo-url>
   cd backend
   ```
2. **Launch with Docker Compose**:
   ```bash
   docker compose up -d
   ```

## Option 2: Image-based Deployment (Offline)
Use this if the target server has no internet access.

1. **Save the Docker image** on your development machine:
   ```bash
   docker save backend-api > backend-api.tar
   ```
2. **Transfer the files** (`backend-api.tar`, `docker-compose.yml`) to the server.
3. **Load the image** on the server:
   ```bash
   docker load < backend-api.tar
   ```
4. **Update `docker-compose.yml`** to use the loaded image instead of `build: .`:
   ```yaml
   services:
     api:
       image: backend-api:latest
       # ... rest of config
   ```
5. **Start service**:
   ```bash
   docker compose up -d
   ```

## Configuration
- Ensure port `3000` is open on the server firewall.
- You can change the database password in `docker-compose.yml` before deploying.
