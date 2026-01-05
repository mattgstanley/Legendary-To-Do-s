const { processTaskInput, processMultipleTasks, getFilteredTasks, updateTaskInSheets } = require('../index');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'POST') {
      // Support both direct array format and wrapped format with 'tasks' property
      if (Array.isArray(req.body)) {
        return res.json(await processMultipleTasks(req.body));
      }
      // Support wrapped format: { tasks: [...] }
      if (req.body.tasks && Array.isArray(req.body.tasks)) {
        return res.json(await processMultipleTasks(req.body.tasks));
      }
      // Single task object (direct format)
      if (!req.body.project || !req.body.taskTitle) {
        return res.status(400).json({ success: false, error: 'Project and taskTitle are required' });
      }
      return res.json(await processTaskInput(req.body));
    }
    
    if (req.method === 'PUT') {
      if (!req.body.taskId) {
        return res.status(400).json({ success: false, error: 'taskId is required' });
      }
      return res.json(await updateTaskInSheets(req.body.taskId, req.body));
    }
    
    if (req.method === 'GET') {
      return res.json(await getFilteredTasks(req.query));
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in tasks API:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
