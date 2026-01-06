const { processTaskInput, processMultipleTasks, getFilteredTasks, updateTaskInSheets } = require('../index');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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
      // Validate required fields
      const missingFields = [];
      if (!req.body.project) missingFields.push('project');
      if (!req.body.taskTitle) missingFields.push('taskTitle');
      
      if (missingFields.length > 0) {
        return res.status(400).json({ 
          success: false, 
          error: `Missing required fields: ${missingFields.join(', ')}` 
        });
      }
      
      // Log task creation for debugging
      console.log('Creating task:', {
        project: req.body.project,
        taskTitle: req.body.taskTitle,
        trade: req.body.trade,
        assignedTo: req.body.assignedTo,
        priority: req.body.priority || 'Medium'
      });
      
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
    
    if (req.method === 'DELETE') {
      if (!req.body.taskId && !req.query.taskId) {
        return res.status(400).json({ success: false, error: 'taskId is required' });
      }
      const taskId = req.body.taskId || req.query.taskId;
      // Delete by setting status to 'Closed' (soft delete) or implement hard delete
      return res.json(await updateTaskInSheets(taskId, { status: 'Closed' }));
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in tasks API:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
