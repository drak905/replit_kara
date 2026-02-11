# Deploy to Railway

This guide will help you deploy the Karaoke Queue app to Railway.

## Prerequisites

- A [Railway](https://railway.app) account
- A [Google Cloud](https://console.cloud.google.com) project with YouTube Data API v3 enabled

## Steps

### 1. Create a Railway Project

```bash
# Install Railway CLI (optional, you can also use the web UI)
npm install -g @railway/cli

# Login to Railway
railway login

# Create a new project
railway init
```

Or use the Railway Dashboard:
1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Connect your repository

### 2. Provision PostgreSQL Database

In your Railway project dashboard:
1. Click "New" → "Database" → "Add PostgreSQL"
2. Railway will automatically set the `DATABASE_URL` environment variable

### 3. Set Environment Variables

In your Railway project dashboard, go to the "Variables" tab and add:

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_API_KEY` | YouTube Data API v3 key | **Yes** |
| `SESSION_SECRET` | Random string for session encryption | **Yes** |
| `GOOGLE_API_KEY_2` | Secondary YouTube API key | No |
| `GOOGLE_API_KEY_3` | Tertiary YouTube API key | No |

**Getting a YouTube API Key:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **YouTube Data API v3**
4. Go to Credentials → Create Credentials → API Key
5. Copy the key and add it to Railway as `GOOGLE_API_KEY`

**Generating SESSION_SECRET:**
```bash
# Run this in your terminal to generate a random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Deploy

Railway will automatically deploy when you push to your connected branch. For manual deploy:

```bash
railway up
```

Or click "Deploy" in the Railway dashboard.

### 5. Verify Deployment

1. Wait for the deployment to complete
2. Railway will provide a public URL
3. Open the URL and test:
   - TV interface: `https://your-app.railway.app/tv`
   - Mobile interface: `https://your-app.railway.app/mobile`

## Troubleshooting

### Database Connection Issues

If you see database connection errors:
1. Check that PostgreSQL is provisioned
2. Verify `DATABASE_URL` is set in Railway variables
3. Check the Railway logs for specific error messages

### Build Failures

If the build fails:
1. Check Railway logs for build errors
2. Ensure all environment variables are set
3. Make sure `npm run build` works locally first

### API Key Issues

If YouTube search doesn't work:
1. Verify `GOOGLE_API_KEY` is set correctly
2. Check that YouTube Data API v3 is enabled in Google Cloud Console
3. Check API quota usage in Google Cloud Console

## Configuration Files

- `railway.toml` - Railway deployment configuration
- `nixpacks.toml` - Build configuration using Nixpacks
- `.env.example` - Example environment variables

## Custom Domain (Optional)

To use a custom domain:
1. Go to your service in Railway dashboard
2. Click "Settings" → "Domains"
3. Add your custom domain and follow the DNS instructions
