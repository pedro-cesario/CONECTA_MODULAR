const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../core/auth/authMiddleware');
const ehrController = require('./ehrController');

router.get('/template/:id', requireAuth, ehrController.getTemplateStructure);
router.post('/registro', requireAuth, ehrController.saveEHRRegistro);

module.exports = router;
