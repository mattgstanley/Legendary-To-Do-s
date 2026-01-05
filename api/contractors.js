const { addContractor: addNewContractor } = require('../index');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'POST') {
      if (!req.body.name) {
        return res.status(400).json({ success: false, error: 'Contractor name is required' });
      }
      return res.json(await addNewContractor(req.body));
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in contractors API:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

