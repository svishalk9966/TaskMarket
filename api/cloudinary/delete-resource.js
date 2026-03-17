import { v2 as cloudinary } from 'cloudinary';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    res.status(500).json({ error: 'Cloudinary server credentials are not configured.' });
    return;
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });

  try {
    const { publicIds } = req.body || {};

    if (!Array.isArray(publicIds) || publicIds.length === 0) {
      res.status(400).json({ error: 'publicIds array is required.' });
      return;
    }

    if (publicIds.length > 100) {
      res.status(400).json({ error: 'Cannot delete more than 100 files at once.' });
      return;
    }

    const results = {};
    const errors = [];

    for (const publicId of publicIds) {
      try {
        let result = await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
        if (result.result === 'not found') {
          result = await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
        }
        if (result.result === 'not found') {
          result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
        }
        results[publicId] = result.result;
      } catch (err) {
        errors.push({ publicId, error: err.message });
        results[publicId] = 'error';
      }
    }

    res.status(200).json({
      results,
      errors,
      deleted: Object.keys(results).filter((key) => results[key] === 'ok').length,
    });
  } catch (error) {
    console.error('Cloudinary delete-resource failed:', error);
    res.status(500).json({ error: error.message || 'Failed to delete Cloudinary resources.' });
  }
}
