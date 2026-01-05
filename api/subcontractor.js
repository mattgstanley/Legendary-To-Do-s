const { getSubcontractorTaskList } = require('../index');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const assignedTo = req.query.assignedTo || req.query.assignedto;
    if (!assignedTo) return res.status(400).json({ success: false, error: 'assignedTo is required' });
    return res.json(await getSubcontractorTaskList(assignedTo));
  } catch (error) {
    console.error('Error in subcontractor API:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

