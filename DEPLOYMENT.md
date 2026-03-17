# Setup & Deployment

## Local setup
1. Extract the project.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and fill in Firebase + Razorpay values.
4. Start development with `npm run dev`.

## Production build
1. Run `npm install`.
2. Run `npm run build`.
3. Deploy the Vite frontend and the `api/` directory together on a platform that supports serverless functions, such as Vercel.

## Required environment variables
### Client (`VITE_*`)
- `VITE_APP_NAME`
- `VITE_APP_CURRENCY`
- `VITE_APP_LOCALE`
- `VITE_OWNER_EMAIL`
- `VITE_RAZORPAY_KEY_ID`
- `VITE_PLATFORM_FEE_PERCENT`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

### Server
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `PLATFORM_FEE_PERCENT`

## Firebase
- Apply the updated `firestore.rules`.
- Ensure the owner email configured in Firebase/Auth matches `VITE_OWNER_EMAIL` and the Firestore rules owner email constant.

## Important deployment note
The uploaded archive previously contained `node_modules` and `dist`. Remove both before committing or redeploying. Always install dependencies fresh in CI/CD.
