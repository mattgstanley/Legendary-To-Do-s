const { createNewProjectTab } = require('../index');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!req.body.projectName) return res.status(400).json({ success: false, error: 'projectName is required' });
    return res.json(await createNewProjectTab(req.body.projectName));
  } catch (error) {
    console.error('Error in projects API:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

