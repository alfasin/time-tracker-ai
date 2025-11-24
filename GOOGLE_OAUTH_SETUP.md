# Google Calendar OAuth Setup Guide

This guide will help you set up Google OAuth credentials for the Google Calendar MCP server.

## Overview

The `@cocal/google-calendar-mcp` package requires OAuth 2.0 credentials to access your Google Calendar.

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Enter project name: "Time Tracker Sync" (or your preferred name)
4. Click **Create**

## Step 2: Enable Google Calendar API

1. In your project, go to **APIs & Services** → **Library**
2. Search for "Google Calendar API"
3. Click on it and press **Enable**

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** (unless you have a Google Workspace)
3. Click **Create**
4. Fill in required fields:
   - **App name**: Time Tracker Sync
   - **User support email**: Your email
   - **Developer contact**: Your email
5. Click **Save and Continue**
6. **Scopes**: Click **Add or Remove Scopes**
   - Search for "calendar"
   - Select: `https://www.googleapis.com/auth/calendar.readonly`
   - Or for full access: `https://www.googleapis.com/auth/calendar`
7. Click **Save and Continue**
8. **Test users**: Add your email (nir.alfasi@tikalk.com)
9. Click **Save and Continue**

## Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **OAuth client ID**
3. Application type: **Desktop app**
4. Name: "Time Tracker Sync Client"
5. Click **Create**
6. A dialog will show your credentials:
   - **Client ID**: Copy this
   - **Client Secret**: Copy this
7. Click **Download JSON** to save the credentials file

## Step 5: Set Up MCP Server Authentication

### Option A: Using the credentials file

1. Save the downloaded JSON file somewhere safe (e.g., `~/.config/google-calendar/credentials.json`)
2. Set environment variable:
   ```bash
   export GOOGLE_OAUTH_CREDENTIALS=~/.config/google-calendar/credentials.json
   ```

### Option B: Run authentication flow

```bash
# Run the auth command to authenticate
npx @cocal/google-calendar-mcp auth
```

This will:
1. Open a browser window
2. Ask you to log in to Google
3. Request permission to access your calendar
4. Save the authentication token locally

## Step 6: Verify Setup

Test that the MCP server can connect:

```bash
npx @cocal/google-calendar-mcp start
```

If successful, you'll see:
```
Google Calendar MCP Server starting...
Server ready
```

Press Ctrl+C to stop it.

## Step 7: Update Your .env File

If you're using environment variables, add to your `.env`:

```env
GOOGLE_OAUTH_CREDENTIALS=/path/to/your/credentials.json
# Or if using specific values:
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

## Troubleshooting

### "Access blocked: This app's request is invalid"

**Problem**: OAuth consent screen not properly configured

**Solution**:
1. Go back to OAuth consent screen
2. Ensure app is in "Testing" mode
3. Add your email as a test user
4. Publish the app (or keep in testing with yourself as test user)

### "Error: The API returned an error: Invalid credentials"

**Problem**: Credentials not found or expired

**Solution**:
1. Check that `GOOGLE_OAUTH_CREDENTIALS` points to valid file
2. Run `npx @cocal/google-calendar-mcp auth` again to re-authenticate
3. Check that Calendar API is enabled in your project

### "redirect_uri_mismatch"

**Problem**: Redirect URI not authorized

**Solution**:
1. Go to **APIs & Services** → **Credentials**
2. Click on your OAuth client
3. Add authorized redirect URIs:
   - `http://localhost`
   - `http://localhost:8000`
   - `urn:ietf:wg:oauth:2.0:oob` (for desktop apps)

## Security Notes

1. **Keep credentials secure**: Never commit credentials.json to git
2. **Use environment variables**: Store paths in .env (which is gitignored)
3. **Limit scopes**: Only request calendar.readonly if you don't need write access
4. **Rotate secrets**: If credentials are exposed, revoke and create new ones

## Next Steps

Once OAuth is set up, you can:

1. Test the connection: `cd time-tracker-sync && node dist/index.js test-connection`
2. Run your first sync: `npm run sync`

## Additional Resources

- [Google Calendar API Documentation](https://developers.google.com/calendar/api/guides/overview)
- [OAuth 2.0 for Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app)
- [@cocal/google-calendar-mcp on npm](https://www.npmjs.com/package/@cocal/google-calendar-mcp)
