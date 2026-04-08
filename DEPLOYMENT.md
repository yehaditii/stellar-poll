# Deployment Guide - StellarPoll

## Vercel Deployment

### Prerequisites
- GitHub repository pushed (✓ complete)
- Vercel account created
- Project built successfully (✓ complete)

### Step 1: Connect GitHub to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Log in" or "Sign up"
3. Choose "GitHub" as your provider
4. Authorize Vercel to access your GitHub account

### Step 2: Import Project

1. Click "Add New" → "Project"
2. Select repository: `stellar-poll`
3. Framework: `Vite` (auto-detected)
4. Root directory: `./`

### Step 3: Configure Build Settings

- **Build command**: `npm run build` (pre-configured)
- **Output directory**: `dist` (auto-detected)
- **Install command**: `npm install` (auto)

### Step 4: Environment Variables

No environment variables required - all config is in `src/constants.js`

### Step 5: Deploy

1. Click "Deploy"
2. Wait for build to complete (2-3 minutes)
3. Get production URL

### Step 6: Verify Deployment

After deployment completes:
1. Open the provided URL in browser
2. Test wallet connection
3. Cast a test vote
4. Verify transaction on Stellar Explorer

## Build Verification

### Local Build Test
```bash
npm run build
npm run preview
```

Visit `http://localhost:5173/` to test production build

### Build Output
```
dist/
├── index.html              # Main entry point
├── assets/
│   ├── index-[hash].css   # Styles
│   └── index-[hash].js    # React + App bundle
```

## Deployment Checklist

- [ ] GitHub repository is public
- [ ] All commits are pushed
- [ ] README.md is complete
- [ ] No API keys in code
- [ ] No debug logs in console
- [ ] Build succeeds: `npm run build`
- [ ] Preview works: `npm run preview`
- [ ] Vercel deployment succeeds
- [ ] Live URL is accessible
- [ ] Wallet connection works
- [ ] Vote functionality works
- [ ] All error handling displays correctly

## Production URLs

### GitHub Repository
```
https://github.com/yehaditii/stellar-poll
```

### Live Deployment
```
https://stellar-poll.vercel.app/
```

(Add actual URL after deployment)

## Monitoring

After deployment, monitor:
1. **Performance**: Check Lighthouse scores
2. **Errors**: Monitor browser console in deployed site
3. **Wallet Connectivity**: Test with multiple wallets
4. **Contract Calls**: Verify voting works on mainnet

## Rollback Procedure

If deployment has issues:
1. Go to Vercel dashboard
2. Select deployment to rollback to
3. Click "Promote to Production"
4. Confirm action

## Performance Optimization

Current Vite build already includes:
- Code splitting
- Tree shaking
- Minification
- Compression

Build size: **~1.3 MB** (acceptable for dApp)

## Post-Deployment

1. Update README.md with deployment URL
2. Test all features on live site
3. Commit final changes
4. Share deployment link for review

---

**Deployment Status**: Ready for Vercel
**Last Updated**: April 8, 2026
