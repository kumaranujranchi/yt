# Railway Deployment Guide

This guide will help you deploy the YouTube Downloader application to Railway.

## Prerequisites

1. Railway account (https://railway.app)
2. GitHub repository with your code
3. Basic understanding of environment variables

## Step 1: Set up Railway

### 1.1 Create a New Project
1. Go to https://railway.app
2. Click "New Project"
3. Choose "Deploy from GitHub repo"
4. Select your repository

### 1.2 Add PostgreSQL Database
1. In your Railway project dashboard, click "New"
2. Select "Database" → "PostgreSQL"
3. Wait for the database to provision
4. Once ready, click on the PostgreSQL service
5. Go to the "Variables" tab and copy the `DATABASE_URL`

### 1.3 Configure Environment Variables
1. Go back to your main service (the app)
2. Click on "Variables"
3. Add the following variables:
   - `DATABASE_URL`: Paste the value from your PostgreSQL service
   - `NODE_ENV`: `production`
   - Railway will automatically set `PORT`

## Step 2: Deploy the Application

Railway will automatically detect the railway.json file and use Docker deployment.

### 2.1 Manual Redeploy (if needed)
1. Go to your service dashboard
2. Click "Deploy" → "Redeploy" if the automatic deployment didn't trigger

### 2.2 Monitor Deployment
1. Click on "Deploys" tab to see deployment logs
2. Check for any errors in the build process
3. Once deployment is complete, the status should show "Success"

## Step 3: Verify Deployment

### 3.1 Health Check
Once deployment is complete, test the health endpoint:
```bash
curl https://your-app-url.railway.app/api/health
```

You should get a response like:
```json
{"status":"ok"}
```

### 3.2 Test the Application
Open your browser and navigate to your Railway app URL to test the full functionality.

## Troubleshooting

### Common Issues

#### 502 Bad Gateway
- Check if the `DATABASE_URL` is correctly set
- Verify the database service is running
- Check deployment logs in Railway dashboard

#### Database Connection Issues
- Ensure the PostgreSQL service is properly linked
- Check if the `DATABASE_URL` format is correct
- Verify database permissions

#### Build Failures
- Check the build logs in Railway dashboard
- Ensure all dependencies are listed in package.json
- Verify the Dockerfile is correct

### Checking Logs
1. Go to your Railway project dashboard
2. Click on your service
3. Go to "Logs" tab to see real-time logs
4. Look for any error messages

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `NODE_ENV` | Set to `production` | Yes |
| `PORT` | Port number (set by Railway) | No |

## Database Setup

The application uses Drizzle ORM with PostgreSQL. Railway will automatically:
1. Create the database
2. Set up the connection
3. Run migrations (if any)

## Support

If you encounter issues:
1. Check Railway documentation: https://docs.railway.app
2. Review the application logs
3. Ensure all environment variables are correctly set