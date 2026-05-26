'use strict';

const crypto = require('crypto');

const parseFaceImage = (imageData) => {
  const match = String(imageData || '').match(/^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    const error = new Error('Face image must be a valid PNG, JPG, or WEBP data image.');
    error.statusCode = 400;
    throw error;
  }

  const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
    const error = new Error('Face image must be smaller than 5MB.');
    error.statusCode = 400;
    throw error;
  }

  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  return {
    buffer,
    extension,
    hash,
    biometricKey: `face:${hash}`,
  };
};

module.exports = { parseFaceImage };
