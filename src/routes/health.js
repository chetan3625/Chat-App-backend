const express = require('express');

const router = express.Router();

router.get('/', (_, res) => {
  res.json({
    status: 'ok',
    service: 'chetanu-backend',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
