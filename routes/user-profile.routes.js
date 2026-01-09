// ============================================
// FILE: routes/user-profile.routes.js
// User Profile Routes - Cover Image & Avatar Upload
// VERSION: 1.0 - January 9, 2026
// ============================================

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Auth middleware
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ ok: false, error: 'No token provided' });
  }
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'cybev-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ ok: false, error: 'Invalid token' });
  }
};

// Get User model
const getUser = () => {
  return mongoose.models.User || require('../models/user.model');
};

// ==========================================
// GET /api/users/username/:username - Get user by username
// ==========================================
router.get('/username/:username', async (req, res) => {
  try {
    const User = getUser();
    const { username } = req.params;

    const user = await User.findOne({ 
      username: username.toLowerCase() 
    }).select('-password -resetPasswordToken -emailVerificationToken -twoFactorSecret -backupCodes');

    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    res.json({ ok: true, user });
  } catch (error) {
    console.error('Get user by username error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==========================================
// POST /api/users/upload-cover - Upload cover image
// ==========================================
router.post('/upload-cover', verifyToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No image provided' });
    }

    const User = getUser();
    let coverImageUrl;

    // Check if Cloudinary is configured
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
      // Configure Cloudinary if not already done
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
      });

      // Upload to Cloudinary
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'cybev/covers',
            transformation: [
              { width: 1500, height: 500, crop: 'fill', gravity: 'center' },
              { quality: 'auto', fetch_format: 'auto' }
            ]
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(req.file.buffer);
      });

      coverImageUrl = result.secure_url;
    } else {
      // Fallback: Store as base64 data URL (not recommended for production)
      const base64 = req.file.buffer.toString('base64');
      const mimeType = req.file.mimetype;
      coverImageUrl = `data:${mimeType};base64,${base64}`;
      console.log('⚠️ Cloudinary not configured - storing as base64');
    }

    // Update user's cover image
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { coverImage: coverImageUrl },
      { new: true }
    ).select('-password -resetPasswordToken -emailVerificationToken -twoFactorSecret -backupCodes');

    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    res.json({ 
      ok: true, 
      coverImage: coverImageUrl,
      user 
    });

  } catch (error) {
    console.error('Upload cover image error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==========================================
// POST /api/users/upload-avatar - Upload avatar image
// ==========================================
router.post('/upload-avatar', verifyToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No image provided' });
    }

    const User = getUser();
    let avatarUrl;

    // Check if Cloudinary is configured
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
      });

      // Upload to Cloudinary
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'cybev/avatars',
            transformation: [
              { width: 400, height: 400, crop: 'fill', gravity: 'face' },
              { quality: 'auto', fetch_format: 'auto' }
            ]
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(req.file.buffer);
      });

      avatarUrl = result.secure_url;
    } else {
      // Fallback: Store as base64
      const base64 = req.file.buffer.toString('base64');
      const mimeType = req.file.mimetype;
      avatarUrl = `data:${mimeType};base64,${base64}`;
    }

    // Update user's avatar
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { avatar: avatarUrl },
      { new: true }
    ).select('-password -resetPasswordToken -emailVerificationToken -twoFactorSecret -backupCodes');

    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    res.json({ 
      ok: true, 
      avatar: avatarUrl,
      user 
    });

  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==========================================
// PUT /api/users/profile - Update profile info
// ==========================================
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const User = getUser();
    const { name, bio, location, website } = req.body;

    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (bio !== undefined) updateFields.bio = bio;
    if (location !== undefined) updateFields.location = location;
    if (website !== undefined) updateFields.website = website;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateFields,
      { new: true }
    ).select('-password -resetPasswordToken -emailVerificationToken -twoFactorSecret -backupCodes');

    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    res.json({ ok: true, user });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==========================================
// DELETE /api/users/cover - Remove cover image
// ==========================================
router.delete('/cover', verifyToken, async (req, res) => {
  try {
    const User = getUser();

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { coverImage: '' },
      { new: true }
    ).select('-password -resetPasswordToken -emailVerificationToken -twoFactorSecret -backupCodes');

    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    res.json({ ok: true, message: 'Cover image removed', user });

  } catch (error) {
    console.error('Remove cover image error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;
