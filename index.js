if (require.main === module && !process.env.VERCEL) {
  try {
    require('dotenv').config();
  } catch (e) {}
}

const { addTaskToSheets, getTasks, getSubcontractorTasks, createProjectTab, initializeMasterTab, addContractor, updateTask, testConnection, verifyCredentials } = require('./google-sheets-actions');
const EmailAutomation = require('./email-automation');

async function processTaskInput(taskData) {
  try {
    const result = await addTaskToSheets(taskData);
    return { success: true, task: result };
  } catch (error) {
    console.error('Error processing task:', error);
    return { success: false, error: error.message };
  }
}

async function processMultipleTasks(tasksArray) {
  const results = [];
  for (const task of tasksArray) {
    try {
      const result = await addTaskToSheets(task);
      results.push(result);
    } catch (error) {
      console.error('Error processing task:', error);
      results.push({ success: false, error: error.message });
    }
  }
  return { 
    success: true, 
    tasksCreated: results.length,
    tasks: results 
  };
}

async function getFilteredTasks(filters = {}) {
  try {
    const tasks = await getTasks(filters);
    return { success: true, count: tasks.length, tasks };
  } catch (error) {
    console.error('Error getting tasks:', error);
    return { success: false, error: error.message };
  }
}

async function getSubcontractorTaskList(assignedTo) {
  try {
    const tasks = await getSubcontractorTasks(assignedTo);
    return { success: true, subcontractor: assignedTo, count: tasks.length, tasks };
  } catch (error) {
    console.error('Error getting subcontractor tasks:', error);
    return { success: false, error: error.message };
  }
}

async function createNewProjectTab(projectName) {
  try {
    const result = await createProjectTab(projectName);
    return { success: true, ...result };
  } catch (error) {
    console.error('Error creating project tab:', error);
    return { success: false, error: error.message };
  }
}

async function addNewContractor(contractorData) {
  try {
    const result = await addContractor(contractorData);
    return { success: true, ...result };
  } catch (error) {
    console.error('Error adding contractor:', error);
    return { success: false, error: error.message };
  }
}

async function sendWeeklyEmails(config) {
  try {
    const emailAutomation = new EmailAutomation(config);
    const results = await emailAutomation.sendWeeklyEmails();
    return {
      success: true,
      emailsSent: results.filter(r => r.success).length,
      results
    };
  } catch (error) {
    console.error('Error sending weekly emails:', error);
    return { success: false, error: error.message };
  }
}

async function updateTaskInSheets(taskId, updateData) {
  try {
    const result = await updateTask(taskId, updateData);
    return { success: true, ...result };
  } catch (error) {
    console.error('Error updating task:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  processTaskInput,
  processMultipleTasks,
  getFilteredTasks,
  getSubcontractorTaskList,
  createNewProjectTab,
  sendWeeklyEmails,
  addTaskToSheets,
  getTasks,
  getSubcontractorTasks,
  createProjectTab,
  initializeMasterTab,
  addContractor: addNewContractor,
  updateTaskInSheets,
  testConnection,
  verifyCredentials
};

if (require.main === module) {
  const express = require('express');
  const path = require('path');
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());
  
  // Request timeout middleware (30 seconds)
  app.use((req, res, next) => {
    res.setTimeout(30000, () => {
      if (!res.headersSent) {
        res.status(504).json({ success: false, error: 'Request timeout' });
      }
    });
    next();
  });

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  // Serve static files from public directory
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Hi, it works!', timestamp: new Date().toISOString() });
  });

  // Load API handlers
  const healthHandler = require('./api/health');
  const initializeHandler = require('./api/initialize');
  const contractorsHandler = require('./api/contractors');
  const tasksHandler = require('./api/tasks');
  const projectsHandler = require('./api/projects');
  const subcontractorHandler = require('./api/subcontractor');
  const weeklyEmailsHandler = require('./api/emails/weekly');

  // Helper function to wrap async handlers
  const asyncHandler = (handler) => {
    return async (req, res, next) => {
      try {
        await handler(req, res);
      } catch (err) {
        console.error(`Unhandled error in ${req.path}:`, err);
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: err.message });
        }
      }
    };
  };

  // Register API routes using handlers
  app.get('/api/health', asyncHandler(healthHandler));
  
  // Verify credentials endpoint - checks sheet ID and account key
  app.get('/api/verify-credentials', async (req, res) => {
    try {
      const diagnostics = await verifyCredentials();
      res.json(diagnostics);
    } catch (error) {
      console.error('Verify credentials error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });
  
  // Diagnostic endpoint to check environment variable setup
  app.get('/api/check-config', (req, res) => {
    const keyContent = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    const sheetId = process.env.GOOGLE_SHEET_ID;
    
    const diagnostics = {
      hasServiceAccountKey: !!keyContent,
      hasSheetId: !!sheetId,
      sheetId: sheetId || 'NOT SET',
      serviceAccountKeyType: keyContent 
        ? (keyContent.trim().startsWith('{') ? 'JSON string' : 
           keyContent.includes('.json') ? 'File path' : 
           'Unknown format')
        : 'NOT SET',
      serviceAccountKeyPreview: keyContent 
        ? (keyContent.length > 50 
           ? keyContent.substring(0, 50) + '...' 
           : keyContent.substring(0, 50))
        : 'NOT SET',
      serviceAccountKeyLength: keyContent ? keyContent.length : 0,
      recommendations: []
    };
    
    // Add recommendations
    if (!keyContent) {
      diagnostics.recommendations.push('Set GOOGLE_SERVICE_ACCOUNT_KEY to either: 1) File path (e.g., "./legendary-home-481509-7918c12b8c1c.json"), or 2) Full JSON content as string');
    } else if (keyContent.trim().startsWith('{')) {
      try {
        JSON.parse(keyContent);
        diagnostics.recommendations.push('JSON format detected - looks valid');
      } catch (e) {
        diagnostics.recommendations.push(`JSON format detected but INVALID: ${e.message}. Check if JSON is complete and properly formatted.`);
      }
    } else if (keyContent.includes('.json')) {
      const fs = require('fs');
      const path = require('path');
      let filePath = keyContent.trim();
      if (filePath.startsWith('./')) {
        filePath = filePath.substring(2);
      }
      const fullPath = path.resolve(process.cwd(), filePath);
      if (fs.existsSync(fullPath)) {
        diagnostics.recommendations.push(`File path detected and file exists: ${fullPath}`);
      } else {
        diagnostics.recommendations.push(`File path detected but file NOT FOUND: ${fullPath}. Check the path is correct.`);
      }
    }
    
    if (!sheetId) {
      diagnostics.recommendations.push('Set GOOGLE_SHEET_ID to your Google Sheet ID');
    }
    
    res.json(diagnostics);
  });
  
  // Test connection endpoint to diagnose Google Sheets connectivity
  app.get('/api/test-connection', async (req, res) => {
    try {
      const result = await testConnection();
      res.json(result);
    } catch (error) {
      console.error('Connection test error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });
  
  // Initialize endpoint needs longer timeout (60 seconds) due to multiple Google Sheets API calls
  app.post('/api/initialize', (req, res) => {
    res.setTimeout(60000, () => {
      if (!res.headersSent) {
        console.error('Initialize endpoint timed out after 60 seconds');
        res.status(504).json({ success: false, error: 'Request timeout - initialization takes longer than expected' });
      }
    });
    asyncHandler(initializeHandler)(req, res);
  });

  app.post('/api/contractors', asyncHandler(contractorsHandler));
  app.post('/api/tasks', asyncHandler(tasksHandler));
  app.put('/api/tasks', asyncHandler(tasksHandler));
  app.get('/api/tasks', asyncHandler(tasksHandler));
  app.delete('/api/tasks', asyncHandler(tasksHandler));
  
  app.get('/api/subcontractor/:assignedTo', (req, res, next) => {
    // Convert path parameter to query parameter for the handler
    req.query.assignedTo = req.params.assignedTo;
    asyncHandler(subcontractorHandler)(req, res, next);
  });
  
  app.post('/api/projects', asyncHandler(projectsHandler));
  app.post('/api/emails/weekly', asyncHandler(weeklyEmailsHandler));

  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && req.path !== '/health') {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
  });

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Frontend available at http://localhost:${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api`);
  });
}
