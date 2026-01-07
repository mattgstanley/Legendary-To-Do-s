const { deleteTasksInSheets } = require('../../index');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Parse body if it's a string (Vercel sometimes doesn't auto-parse)
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ success: false, error: 'Invalid JSON in request body' });
      }
    }
    
    if (!body) {
      body = {};
    }

    return res.json(await deleteTasksInSheets(body));
  } catch (error) {
    console.error('Error in bulk delete API:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

