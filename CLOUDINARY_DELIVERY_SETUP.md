# Cloudinary delivery upload setup

This project now uses **Cloudinary only for the task delivery form** in `TaskWorkflowPanel`.

It affects only these two inputs:
- Preview video
- Attachment

Everything else in the project stays unchanged.

## 1. Create an unsigned upload preset

In Cloudinary:
1. Go to **Settings -> Upload**
2. Open **Upload presets**
3. Create a preset like `taskmarket_delivery_unsigned`
4. Set **Signing Mode** to **Unsigned**
5. Save it

## 2. Add env variables

Put these values in your `.env` file:

```env
VITE_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=taskmarket_delivery_unsigned
```

## 3. Restart the dev server

After changing `.env`, restart Vite:

```bash
npm run dev
```

## 4. What changed

Cloudinary is now used only inside:
- `src/lib/workflow.js`

The submit delivery flow still writes metadata and URLs to Firestore, but the actual uploaded files now go to Cloudinary instead of Firebase Storage.
