const { google } = require('googleapis');
const sheets = google.sheets('v4');

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const MASTER_TAB_NAME = 'Master Tasks';
const CONTRACTORS_TAB_NAME = 'Contractors';

async function getSheetsClient() {
  const keyContent = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  
  if (!keyContent) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set');
  }

  const trimmedContent = keyContent.trim();
  const preview = trimmedContent.length > 100 
    ? trimmedContent.substring(0, 100) + '...' 
    : trimmedContent;
  
  console.log(`GOOGLE_SERVICE_ACCOUNT_KEY detected (preview): ${preview.substring(0, 50)}...`);

  let auth;
  const fs = require('fs');
  const path = require('path');
  
  // First, try to see if it's a file path
  // Check for common file extensions or path-like patterns (but not if it's clearly JSON)
  const looksLikeFilePath = (trimmedContent.includes('.json') || 
                             trimmedContent.includes('/') || 
                             trimmedContent.includes('\\')) &&
                             !trimmedContent.startsWith('{') &&
                             !trimmedContent.startsWith('[');
  
  if (looksLikeFilePath) {
    // Try as file path first
    let filePath = trimmedContent;
    
    if (filePath.startsWith('./')) {
      filePath = filePath.substring(2);
    }
    
    const fullPath = path.resolve(process.cwd(), filePath);
    
    if (fs.existsSync(fullPath)) {
      console.log(`Using service account key file: ${fullPath}`);
      try {
        auth = new google.auth.GoogleAuth({
          keyFile: fullPath,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        
        // Test authentication
        const client = await auth.getClient();
        const projectId = await auth.getProjectId();
        console.log(`Authenticated successfully with project: ${projectId}`);
        return auth;
      } catch (error) {
        throw new Error(`Failed to load service account from file ${fullPath}: ${error.message}`);
      }
    } else {
      // It looks like a file path but file doesn't exist
      throw new Error(`Service account key file not found at: ${fullPath}. Please check the file path or use the full JSON content instead.`);
    }
  }
  
  // If not a file path, try as JSON string
  if (trimmedContent.startsWith('{') || trimmedContent.startsWith('[')) {
    try {
      // Remove surrounding quotes if present (common in .env files)
      let jsonContent = trimmedContent;
      if ((jsonContent.startsWith('"') && jsonContent.endsWith('"')) ||
          (jsonContent.startsWith("'") && jsonContent.endsWith("'"))) {
        jsonContent = jsonContent.slice(1, -1);
        // Unescape if needed
        jsonContent = jsonContent.replace(/\\"/g, '"').replace(/\\'/g, "'");
      }
      
      const keyData = JSON.parse(jsonContent);
      
      // Validate required fields
      if (!keyData.client_email) {
        throw new Error('Service account JSON is missing client_email field');
      }
      if (!keyData.private_key) {
        throw new Error('Service account JSON is missing private_key field');
      }
      
      console.log(`Using service account: ${keyData.client_email}`);
      
      auth = new google.auth.GoogleAuth({
        credentials: keyData,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
    } catch (e) {
      if (e.message.includes('client_email') || e.message.includes('private_key')) {
        throw e;
      }
      // Show more helpful error
      const errorMsg = `Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY as JSON: ${e.message}. `;
      const suggestion = trimmedContent.startsWith('{') 
        ? 'The value appears to be JSON but is invalid. Please check: 1) Is it valid JSON? 2) If using a file path, ensure the file exists. 3) If pasting JSON, ensure it\'s the complete JSON content without extra characters.'
        : 'If you intended to use a file path, ensure the file exists. If you intended to use JSON, ensure it starts with { and is valid JSON.';
      throw new Error(errorMsg + suggestion);
    }
  } else {
    throw new Error(`GOOGLE_SERVICE_ACCOUNT_KEY format not recognized. It should be either: 1) A file path to a .json file (e.g., "./legendary-home-481509-7918c12b8c1c.json"), or 2) A JSON string starting with {. Current value preview: ${preview}`);
  }
  
  // Test authentication by getting credentials
  try {
    const client = await auth.getClient();
    const projectId = await auth.getProjectId();
    console.log(`Authenticated successfully with project: ${projectId}`);
    return auth;
  } catch (error) {
    console.error('Authentication failed:', error.message);
    throw new Error(`Failed to authenticate with Google Sheets API: ${error.message}. Please check your service account credentials.`);
  }
}

async function addTaskToSheets(taskData) {
  if (!SPREADSHEET_ID) {
    throw new Error('GOOGLE_SHEET_ID environment variable is not set');
  }

  console.log('Adding task to sheets:', {
    project: taskData.project,
    taskTitle: taskData.taskTitle,
    trade: taskData.trade,
    assignedTo: taskData.assignedTo,
    priority: taskData.priority || 'Medium'
  });

  const auth = await getSheetsClient();
  const timestamp = new Date().toISOString();
  const row = [
    timestamp,
    '',
    taskData.project || '',
    taskData.area || '',
    taskData.trade || '',
    taskData.taskTitle || '',
    taskData.taskDetails || '',
    taskData.assignedTo || '',
    taskData.priority || 'Medium',
    taskData.dueDate || '',
    taskData.photoNeeded ? 'Yes' : 'No',
    'Open',
    '',
    '',
  ];

  try {
    console.log(`Ensuring project tab exists: ${taskData.project}`);
    await ensureProjectTabExists(auth, taskData.project);
    console.log('Project tab ensured');

    const appendRow = async (range) => {
      await sheets.spreadsheets.values.append({
        auth,
        spreadsheetId: SPREADSHEET_ID,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [row] },
      });
    };

    console.log('Appending task rows to sheets...');
    await Promise.all([
      appendRow(`'${MASTER_TAB_NAME}'!A:N`),
      appendRow(`'${taskData.project}'!A:N`),
    ]);
    console.log('Task rows appended successfully');

    console.log('Applying row formatting...');
    await Promise.all([
      applyRowFormatting(auth, MASTER_TAB_NAME),
      applyRowFormatting(auth, taskData.project),
    ]);
    console.log('Formatting applied');

    console.log(`Task created successfully with ID: ${timestamp}`);
    return { success: true, taskId: timestamp };
  } catch (error) {
    if (error.message.includes('Requested entity was not found')) {
      throw new Error(`Google Sheet not found. Check: 1) Sheet ID is correct (current: ${SPREADSHEET_ID}), 2) Sheet is shared with service account email, 3) Sheet exists. Original error: ${error.message}`);
    }
    throw error;
  }
}

async function ensureContractorsTabExists(auth) {
  const startTime = Date.now();
  const sheetsClient = sheets.spreadsheets;
  
  try {
    console.log(`[${Date.now() - startTime}ms] Checking if Contractors tab exists...`);
    const spreadsheet = await sheetsClient.get({ auth, spreadsheetId: SPREADSHEET_ID });
    const existingTabs = spreadsheet.data.sheets.map(s => s.properties.title);
    console.log(`[${Date.now() - startTime}ms] Existing tabs:`, existingTabs);
    
    if (existingTabs.includes(CONTRACTORS_TAB_NAME)) {
      console.log(`[${Date.now() - startTime}ms] Contractors tab exists, checking headers...`);
      try {
        const response = await sheets.spreadsheets.values.get({
          auth,
          spreadsheetId: SPREADSHEET_ID,
          range: `'${CONTRACTORS_TAB_NAME}'!A1:D1`,
        });
        
        if (!response.data.values || response.data.values.length === 0) {
          console.log(`[${Date.now() - startTime}ms] Adding headers to Contractors tab...`);
          const headers = ['Contractor Name', 'Email', 'Phone', 'Trade'];
          await sheets.spreadsheets.values.update({
            auth,
            spreadsheetId: SPREADSHEET_ID,
            range: `'${CONTRACTORS_TAB_NAME}'!A1:D1`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [headers] },
          });
          console.log(`[${Date.now() - startTime}ms] Headers added`);
        } else {
          console.log(`[${Date.now() - startTime}ms] Headers already exist`);
        }
      } catch (rangeError) {
        console.error(`[${Date.now() - startTime}ms] Error checking/updating headers:`, rangeError.message);
        // Continue anyway - headers might already be there
      }
      console.log(`[${Date.now() - startTime}ms] Contractors tab setup complete`);
      return;
    }

    console.log(`[${Date.now() - startTime}ms] Creating Contractors tab...`);
    await sheetsClient.batchUpdate({
      auth,
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        requests: [{ addSheet: { properties: { title: CONTRACTORS_TAB_NAME } } }],
      },
    });
    console.log(`[${Date.now() - startTime}ms] Contractors tab created`);

    console.log(`[${Date.now() - startTime}ms] Adding headers to new Contractors tab...`);
    const headers = ['Contractor Name', 'Email', 'Phone', 'Trade'];
    await sheets.spreadsheets.values.update({
      auth,
      spreadsheetId: SPREADSHEET_ID,
      range: `'${CONTRACTORS_TAB_NAME}'!A1:D1`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [headers] },
    });
    console.log(`[${Date.now() - startTime}ms] Headers added`);

    // Try to apply formatting, but don't fail if it doesn't work
    try {
      console.log(`[${Date.now() - startTime}ms] Applying formatting to Contractors tab...`);
      const updatedSpreadsheet = await sheetsClient.get({ auth, spreadsheetId: SPREADSHEET_ID });
      const sheet = updatedSpreadsheet.data.sheets.find(s => s.properties.title === CONTRACTORS_TAB_NAME);
      
      if (!sheet) {
        console.warn(`[${Date.now() - startTime}ms] Contractors tab was created but cannot be found for formatting`);
      } else {
        const sheetId = sheet.properties.sheetId;
        await sheetsClient.batchUpdate({
          auth,
          spreadsheetId: SPREADSHEET_ID,
          resource: {
            requests: [{
              repeatCell: {
                range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.2, green: 0.4, blue: 0.6 },
                    textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
                  },
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat)',
              },
            }],
          },
        });
        console.log(`[${Date.now() - startTime}ms] Formatting applied`);
      }
    } catch (formatError) {
      console.warn(`[${Date.now() - startTime}ms] Warning: Could not apply formatting to Contractors tab:`, formatError.message);
      // Continue - formatting is optional
    }
    console.log(`[${Date.now() - startTime}ms] Contractors tab setup complete`);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[${totalTime}ms] Error ensuring Contractors tab exists:`, error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    throw error; // Re-throw to prevent silent failures
  }
}

async function ensureProjectTabExists(auth, projectName) {
  const sheetsClient = sheets.spreadsheets;
  
  try {
    await ensureContractorsTabExists(auth);
    
    const spreadsheet = await sheetsClient.get({ auth, spreadsheetId: SPREADSHEET_ID });
    const existingTabs = spreadsheet.data.sheets.map(s => s.properties.title);
    
    if (existingTabs.includes(projectName)) {
      const response = await sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: SPREADSHEET_ID,
        range: `'${projectName}'!A1:N1`,
      });
      
      if (!response.data.values || response.data.values[0]?.length < 14) {
        await setupSheetHeaders(auth, projectName);
      }
      return;
    }

    await sheetsClient.batchUpdate({
      auth,
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        requests: [{ addSheet: { properties: { title: projectName } } }],
      },
    });

    await setupSheetHeaders(auth, projectName);
    await setupSheetFormatting(auth, projectName);
  } catch (error) {
    if (error.message.includes('Requested entity was not found')) {
      throw new Error(`Google Sheet not found. Check: 1) Sheet ID is correct (${SPREADSHEET_ID}), 2) Sheet is shared with service account email, 3) Sheet exists. Original error: ${error.message}`);
    }
    throw error;
  }
}

async function setupSheetHeaders(auth, sheetName) {
  const headers = ['Timestamp', 'Days Old', 'Project', 'Area', 'Trade', 'Task Title', 'Task Details', 'Assigned To', 'Priority', 'Due Date', 'Photo Needed', 'Status', 'Photo URL', 'Notes'];
  await sheets.spreadsheets.values.update({
    auth,
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A1:N1`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [headers] },
  });
}

async function setupSheetFormatting(auth, sheetName) {
  const startTime = Date.now();
  const sheetsClient = sheets.spreadsheets;
  console.log(`[${Date.now() - startTime}ms] Setting up formatting for sheet: ${sheetName}`);
  
  const spreadsheet = await sheetsClient.get({ auth, spreadsheetId: SPREADSHEET_ID });
  const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
  
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found in spreadsheet`);
  }
  
  const sheetId = sheet.properties.sheetId;
  console.log(`[${Date.now() - startTime}ms] Found sheet ID: ${sheetId}`);
  
  const requests = [];
  
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.2, green: 0.4, blue: 0.6 },
          textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat)',
    },
  });
  
  requests.push({
    setDataValidation: {
      range: {
        sheetId,
        startRowIndex: 1,
        endRowIndex: 1000,
        startColumnIndex: 11,
        endColumnIndex: 12,
      },
      rule: {
        condition: {
          type: 'ONE_OF_LIST',
          values: [
            { userEnteredValue: 'Open' },
            { userEnteredValue: 'In Progress' },
            { userEnteredValue: 'Closed' },
          ],
        },
        showCustomUi: true,
        strict: false,
      },
    },
  });
  
  requests.push({
    setDataValidation: {
      range: {
        sheetId,
        startRowIndex: 1,
        endRowIndex: 1000,
        startColumnIndex: 7, // Column H (Assigned To)
        endColumnIndex: 8,
      },
      rule: {
        condition: {
          type: 'ONE_OF_RANGE',
          values: [{
            userEnteredValue: `=${CONTRACTORS_TAB_NAME}!A2:A1000`,
          }],
        },
        showCustomUi: true,
        strict: false,
      },
    },
  });
  
  requests.push({
    addConditionalFormatRule: {
      rule: {
        ranges: [{
          sheetId,
          startRowIndex: 1,
          endRowIndex: 1000,
          startColumnIndex: 11, // Status column
          endColumnIndex: 12,
        }],
        booleanRule: {
          condition: {
            type: 'TEXT_EQ',
            values: [{ userEnteredValue: 'Closed' }],
          },
          format: {
            backgroundColor: { red: 0.85, green: 0.95, blue: 0.85 }, // Light green
          },
        },
      },
      index: 0,
    },
  });
  
  requests.push({
    addConditionalFormatRule: {
      rule: {
        ranges: [{
          sheetId,
          startRowIndex: 1,
          endRowIndex: 1000,
          startColumnIndex: 11, // Status column
          endColumnIndex: 12,
        }],
        booleanRule: {
          condition: {
            type: 'TEXT_EQ',
            values: [{ userEnteredValue: 'Open' }],
          },
          format: {
            backgroundColor: { red: 0.95, green: 0.85, blue: 0.85 }, // Light red
          },
        },
      },
      index: 1,
    },
  });
  
  // Sort by Days Old (oldest first) - this will be applied to the entire data range
  // Note: We'll set up a filter view for this instead of sorting the data directly
  // as sorting can interfere with new data additions
  
  console.log(`[${Date.now() - startTime}ms] Applying batch formatting updates (${requests.length} requests)...`);
  await sheetsClient.batchUpdate({
    auth,
    spreadsheetId: SPREADSHEET_ID,
    resource: { requests },
  });
  console.log(`[${Date.now() - startTime}ms] Batch formatting updates completed`);
  
  // Skip formula setup for now to speed up initialization - formulas can be added later
  // This is the slowest part and not critical for initial setup
  console.log(`[${Date.now() - startTime}ms] Formatting setup completed (formulas skipped for speed)`);
  
  // Uncomment below if you want to set up formulas (slower but adds "Days Old" calculation)
  /*
  const valuesResponse = await sheets.spreadsheets.values.get({
    auth,
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A:A`,
  });
  
  const rowCount = (valuesResponse.data.values || []).length;
  if (rowCount > 1) {
    const formulas = [];
    for (let i = 2; i <= rowCount; i++) {
      formulas.push([`=IF(A${i}="","",ROUNDDOWN((TODAY()-DATEVALUE(LEFT(A${i},10))),0))`]);
    }
    
    await sheets.spreadsheets.values.update({
      auth,
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!B2:B${rowCount}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: formulas },
    });
  }
  */
}

async function applyRowFormatting(auth, projectName) {
  try {
    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: SPREADSHEET_ID,
      range: `'${projectName}'!A:A`,
    });
    
    const rowCount = (response.data.values || []).length;
    if (rowCount < 2) return; // No data rows yet
    
    const lastRow = rowCount;
    const formula = `=IF(A${lastRow}="","",ROUNDDOWN((TODAY()-DATEVALUE(LEFT(A${lastRow},10))),0))`;
    await sheets.spreadsheets.values.update({
      auth,
      spreadsheetId: SPREADSHEET_ID,
      range: `'${projectName}'!B${lastRow}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [[formula]] },
    });
  } catch (error) {
    console.error('Error applying row formatting:', error);
  }
}

async function getTasks(filters = {}) {
  if (!SPREADSHEET_ID) {
    throw new Error('GOOGLE_SHEET_ID environment variable is not set');
  }

  const auth = await getSheetsClient();
  
  try {
    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: SPREADSHEET_ID,
      range: `'${MASTER_TAB_NAME}'!A:N`,
    });

    const rows = response.data.values || [];
    if (rows.length === 0) return [];

    const headers = rows[0];
    let tasks = rows.slice(1).map((row, rowIndex) => {
      const task = {};
      headers.forEach((header, index) => {
        const key = header.toLowerCase().replace(/\s+/g, '');
        task[key] = row[index] || '';
      });
      // Also add raw timestamp as taskId for easier access
      if (row[0]) {
        task.taskId = String(row[0]).trim();
        task.timestamp = String(row[0]).trim();
      }
      return task;
    });

    if (filters.project) tasks = tasks.filter(t => t.project?.toLowerCase().includes(filters.project.toLowerCase()));
    if (filters.trade) tasks = tasks.filter(t => t.trade?.toLowerCase().includes(filters.trade.toLowerCase()));
    if (filters.assignedTo) tasks = tasks.filter(t => t.assignedto?.toLowerCase().includes(filters.assignedTo.toLowerCase()));
    if (filters.status) tasks = tasks.filter(t => t.status?.toLowerCase() === filters.status.toLowerCase());

    return tasks;
  } catch (error) {
    if (error.message.includes('Requested entity was not found')) {
      throw new Error(`Google Sheet not found. Check: 1) Sheet ID is correct (current: ${SPREADSHEET_ID}), 2) Sheet is shared with service account email, 3) Sheet exists and is accessible. Original error: ${error.message}`);
    }
    throw error;
  }
}

async function getSubcontractorTasks(assignedTo) {
  return getTasks({ assignedTo, status: 'Open' });
}

async function createProjectTab(projectName) {
  const auth = await getSheetsClient();
  await ensureProjectTabExists(auth, projectName);
  return { success: true, message: `Project tab '${projectName}' created successfully` };
}

async function verifyCredentials() {
  const diagnostics = {
    hasSheetId: !!SPREADSHEET_ID,
    sheetId: SPREADSHEET_ID || 'NOT SET',
    sheetIdLength: SPREADSHEET_ID ? SPREADSHEET_ID.length : 0,
    hasServiceAccountKey: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
    serviceAccountKeyType: null,
    serviceAccountKeyPreview: null,
    serviceAccountEmail: null,
    projectId: null,
    authenticationStatus: 'not_attempted',
    errors: []
  };

  // Check service account key
  const keyContent = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (keyContent) {
    const trimmed = keyContent.trim();
    if (trimmed.startsWith('{')) {
      diagnostics.serviceAccountKeyType = 'JSON string';
      try {
        const keyData = JSON.parse(trimmed);
        diagnostics.serviceAccountEmail = keyData.client_email || 'NOT FOUND IN JSON';
        diagnostics.projectId = keyData.project_id || 'NOT FOUND IN JSON';
        diagnostics.serviceAccountKeyPreview = `JSON with email: ${keyData.client_email || 'unknown'}`;
      } catch (e) {
        diagnostics.serviceAccountKeyType = 'JSON string (INVALID)';
        diagnostics.errors.push(`Failed to parse JSON: ${e.message}`);
        diagnostics.serviceAccountKeyPreview = trimmed.substring(0, 50) + '...';
      }
    } else if (trimmed.includes('.json')) {
      diagnostics.serviceAccountKeyType = 'File path';
      const fs = require('fs');
      const path = require('path');
      let filePath = trimmed;
      if (filePath.startsWith('./')) {
        filePath = filePath.substring(2);
      }
      const fullPath = path.resolve(process.cwd(), filePath);
      if (fs.existsSync(fullPath)) {
        try {
          const keyData = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
          diagnostics.serviceAccountEmail = keyData.client_email || 'NOT FOUND IN FILE';
          diagnostics.projectId = keyData.project_id || 'NOT FOUND IN FILE';
          diagnostics.serviceAccountKeyPreview = `File: ${fullPath} (valid JSON)`;
        } catch (e) {
          diagnostics.errors.push(`Failed to read/parse file: ${e.message}`);
          diagnostics.serviceAccountKeyPreview = `File: ${fullPath} (INVALID JSON)`;
        }
      } else {
        diagnostics.errors.push(`File not found: ${fullPath}`);
        diagnostics.serviceAccountKeyPreview = `File path: ${trimmed} (NOT FOUND)`;
      }
    } else {
      diagnostics.serviceAccountKeyType = 'Unknown format';
      diagnostics.serviceAccountKeyPreview = trimmed.substring(0, 50) + '...';
      diagnostics.errors.push('Service account key format not recognized');
    }
  }

  // Try authentication
  if (diagnostics.hasServiceAccountKey && diagnostics.errors.length === 0) {
    try {
      console.log('Attempting authentication...');
      const auth = await getSheetsClient();
      diagnostics.authenticationStatus = 'success';
      console.log('Authentication successful');
    } catch (error) {
      diagnostics.authenticationStatus = 'failed';
      diagnostics.errors.push(`Authentication failed: ${error.message}`);
    }
  }

  return diagnostics;
}

async function testConnection() {
  if (!SPREADSHEET_ID) {
    throw new Error('GOOGLE_SHEET_ID environment variable is not set');
  }

  try {
    console.log('Testing Google Sheets connection...');
    const auth = await getSheetsClient();
    const sheetsClient = sheets.spreadsheets;
    
    console.log(`Attempting to access spreadsheet: ${SPREADSHEET_ID}`);
    const spreadsheet = await sheetsClient.get({ 
      auth, 
      spreadsheetId: SPREADSHEET_ID 
    });
    
    const title = spreadsheet.data.properties?.title || 'Unknown';
    const tabs = spreadsheet.data.sheets.map(s => s.properties.title);
    
    return {
      success: true,
      message: 'Successfully connected to Google Sheets',
      spreadsheetTitle: title,
      spreadsheetId: SPREADSHEET_ID,
      tabs: tabs,
      tabCount: tabs.length
    };
  } catch (error) {
    console.error('Connection test failed:', error);
    
    let errorMessage = error.message;
    let suggestions = [];
    
    if (error.message.includes('not found') || error.code === 404) {
      errorMessage = `Google Sheet not found with ID: ${SPREADSHEET_ID}`;
      suggestions = [
        'Verify the GOOGLE_SHEET_ID is correct',
        'Ensure the sheet exists and is accessible',
        'Share the sheet with your service account email (check logs for the email)'
      ];
    } else if (error.message.includes('permission') || error.code === 403) {
      errorMessage = 'Permission denied - service account does not have access';
      suggestions = [
        'Share the Google Sheet with your service account email',
        'Grant "Editor" permissions to the service account',
        'Check that the service account email matches the one in your credentials'
      ];
    } else if (error.message.includes('authentication') || error.message.includes('credentials')) {
      errorMessage = 'Authentication failed';
      suggestions = [
        'Verify GOOGLE_SERVICE_ACCOUNT_KEY is set correctly',
        'Check that the JSON credentials are valid',
        'Ensure the service account key file exists (if using file path)'
      ];
    }
    
    throw new Error(`${errorMessage}. ${suggestions.length > 0 ? 'Suggestions: ' + suggestions.join('; ') : ''} Original error: ${error.message}`);
  }
}

async function initializeMasterTab() {
  if (!SPREADSHEET_ID) {
    throw new Error('GOOGLE_SHEET_ID environment variable is not set');
  }

  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Starting initializeMasterTab...`);
  
  try {
    console.log(`[${Date.now() - startTime}ms] Getting authentication...`);
    const auth = await getSheetsClient();
    console.log(`[${Date.now() - startTime}ms] Authentication successful`);
    
    const sheetsClient = sheets.spreadsheets;
    
    // Ensure Contractors tab exists first
    console.log(`[${Date.now() - startTime}ms] Ensuring Contractors tab exists...`);
    await ensureContractorsTabExists(auth);
    console.log(`[${Date.now() - startTime}ms] Contractors tab ensured`);
    
    console.log(`[${Date.now() - startTime}ms] Getting spreadsheet info...`);
    const spreadsheet = await sheetsClient.get({ auth, spreadsheetId: SPREADSHEET_ID });
    const existingTabs = spreadsheet.data.sheets.map(s => s.properties.title);
    console.log(`[${Date.now() - startTime}ms] Existing tabs:`, existingTabs);
    
    if (!existingTabs.includes(MASTER_TAB_NAME)) {
      console.log(`[${Date.now() - startTime}ms] Creating Master Tasks tab...`);
      // Create Master Tasks tab
      await sheetsClient.batchUpdate({
        auth,
        spreadsheetId: SPREADSHEET_ID,
        resource: {
          requests: [{ addSheet: { properties: { title: MASTER_TAB_NAME } } }],
        },
      });
      console.log(`[${Date.now() - startTime}ms] Master Tasks tab created`);
    } else {
      console.log(`[${Date.now() - startTime}ms] Master Tasks tab already exists`);
    }
    
    // Setup headers and formatting for Master Tasks tab
    console.log(`[${Date.now() - startTime}ms] Setting up headers...`);
    await setupSheetHeaders(auth, MASTER_TAB_NAME);
    console.log(`[${Date.now() - startTime}ms] Headers set up`);
    
    console.log(`[${Date.now() - startTime}ms] Setting up formatting...`);
    await setupSheetFormatting(auth, MASTER_TAB_NAME);
    console.log(`[${Date.now() - startTime}ms] Formatting set up`);
    
    const totalTime = Date.now() - startTime;
    console.log(`[${totalTime}ms] Initialize completed successfully`);
    
    return { 
      success: true, 
      message: 'Master tab and Contractors tab initialized successfully',
      duration: `${totalTime}ms`
    };
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[${totalTime}ms] Error initializing Master tab:`, error);
    console.error('Error stack:', error.stack);
    
    // Provide helpful error messages
    if (error.message.includes('not found') || error.code === 404) {
      throw new Error(`Google Sheet not found. Check: 1) Sheet ID is correct (${SPREADSHEET_ID}), 2) Sheet is shared with service account, 3) Sheet exists. Original: ${error.message}`);
    } else if (error.message.includes('permission') || error.code === 403) {
      throw new Error(`Permission denied. Share the sheet with your service account email (check logs above) and grant Editor access. Original: ${error.message}`);
    } else if (error.message.includes('timeout') || totalTime > 55000) {
      throw new Error(`Operation timed out after ${totalTime}ms. This may indicate network issues or the Google Sheets API is slow. Try again or check your connection.`);
    }
    
    throw error;
  }
}

async function getContractorEmails() {
  if (!SPREADSHEET_ID) {
    throw new Error('GOOGLE_SHEET_ID environment variable is not set');
  }

  const auth = await getSheetsClient();
  
  try {
    await ensureContractorsTabExists(auth);
    
    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: SPREADSHEET_ID,
      range: `'${CONTRACTORS_TAB_NAME}'!A:B`, // Get Name (A) and Email (B) columns
    });

    const rows = response.data.values || [];
    if (rows.length < 2) {
      return {};
    }

    const contractorEmails = {};
    for (let i = 1; i < rows.length; i++) {
      const name = rows[i][0]?.trim();
      const email = rows[i][1]?.trim();
      
      if (name && email) {
        contractorEmails[name] = email;
      }
    }

    return contractorEmails;
  } catch (error) {
    console.error('Error getting contractor emails:', error);
    throw error;
  }
}

async function addContractor(contractorData) {
  const auth = await getSheetsClient();
  
  try {
    await ensureContractorsTabExists(auth);
    
    const row = [
      contractorData.name || '',
      contractorData.email || '',
      contractorData.phone || '',
      contractorData.trade || '',
    ];
    
    await sheets.spreadsheets.values.append({
      auth,
      spreadsheetId: SPREADSHEET_ID,
      range: `'${CONTRACTORS_TAB_NAME}'!A:D`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [row] },
    });
    
    return { success: true, message: `Contractor '${contractorData.name}' added successfully` };
  } catch (error) {
    console.error('Error adding contractor:', error);
    throw error;
  }
}

async function updateTask(taskId, updateData) {
  if (!SPREADSHEET_ID) {
    throw new Error('GOOGLE_SHEET_ID environment variable is not set');
  }

  const auth = await getSheetsClient();
  
  try {
    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: SPREADSHEET_ID,
      range: `'${MASTER_TAB_NAME}'!A:N`,
    });

    const rows = response.data.values || [];
    if (rows.length < 2) {
      throw new Error('No tasks found');
    }

    const headers = rows[0];
    let taskRowIndex = -1;
    let taskRow = null;
    let projectName = '';

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === taskId) {
        taskRowIndex = i + 1;
        taskRow = [...rows[i]];
        projectName = rows[i][2] || '';
        break;
      }
    }

    if (taskRowIndex === -1) {
      throw new Error(`Task with ID ${taskId} not found`);
    }

    if (updateData.area !== undefined) taskRow[3] = updateData.area;
    if (updateData.trade !== undefined) taskRow[4] = updateData.trade;
    if (updateData.taskTitle !== undefined) taskRow[5] = updateData.taskTitle;
    if (updateData.taskDetails !== undefined) taskRow[6] = updateData.taskDetails;
    if (updateData.assignedTo !== undefined) taskRow[7] = updateData.assignedTo;
    if (updateData.priority !== undefined) taskRow[8] = updateData.priority;
    if (updateData.dueDate !== undefined) taskRow[9] = updateData.dueDate;
    if (updateData.photoNeeded !== undefined) taskRow[10] = updateData.photoNeeded ? 'Yes' : 'No';
    if (updateData.status !== undefined) taskRow[11] = updateData.status;
    if (updateData.photoUrl !== undefined) taskRow[12] = updateData.photoUrl;
    if (updateData.notes !== undefined) taskRow[13] = updateData.notes;

    while (taskRow.length < 14) {
      taskRow.push('');
    }

    await sheets.spreadsheets.values.update({
      auth,
      spreadsheetId: SPREADSHEET_ID,
      range: `'${MASTER_TAB_NAME}'!A${taskRowIndex}:N${taskRowIndex}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [taskRow] },
    });

    if (projectName) {
      const projectResponse = await sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: SPREADSHEET_ID,
        range: `'${projectName}'!A:N`,
      });

      const projectRows = projectResponse.data.values || [];
      let projectRowIndex = -1;

      for (let i = 1; i < projectRows.length; i++) {
        if (projectRows[i][0] === taskId) {
          projectRowIndex = i + 1;
          break;
        }
      }

      if (projectRowIndex !== -1) {
        await sheets.spreadsheets.values.update({
          auth,
          spreadsheetId: SPREADSHEET_ID,
          range: `'${projectName}'!A${projectRowIndex}:N${projectRowIndex}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [taskRow] },
        });
      }
    }

    return { success: true, message: `Task updated successfully`, taskId };
  } catch (error) {
    if (error.message.includes('Requested entity was not found')) {
      throw new Error(`Google Sheet not found. Check: 1) Sheet ID is correct (current: ${SPREADSHEET_ID}), 2) Sheet is shared with service account email, 3) Sheet exists. Original error: ${error.message}`);
    }
    throw error;
  }
}

async function deleteTask(taskId) {
  if (!SPREADSHEET_ID) {
    throw new Error('GOOGLE_SHEET_ID environment variable is not set');
  }

  const auth = await getSheetsClient();
  
  try {
    // Get Master Tasks to find the task
    const masterResponse = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: SPREADSHEET_ID,
      range: `'${MASTER_TAB_NAME}'!A:N`,
    });

    const masterRows = masterResponse.data.values || [];
    if (masterRows.length < 2) {
      throw new Error('No tasks found');
    }

    // Find task in Master Tasks
    let masterRowIndex = -1;
    let projectName = '';
    const taskIdTrimmed = String(taskId).trim();

    for (let i = 1; i < masterRows.length; i++) {
      const rowTaskId = masterRows[i][0] ? String(masterRows[i][0]).trim() : '';
      // Try exact match first
      if (rowTaskId === taskIdTrimmed) {
        masterRowIndex = i + 1; // +1 because Sheets API is 1-indexed
        projectName = masterRows[i][2] || '';
        break;
      }
      // Also try matching if taskId is a substring (for partial matches)
      if (rowTaskId.includes(taskIdTrimmed) || taskIdTrimmed.includes(rowTaskId)) {
        // Only match if they're similar enough (same length or very close)
        if (Math.abs(rowTaskId.length - taskIdTrimmed.length) <= 5) {
          masterRowIndex = i + 1;
          projectName = masterRows[i][2] || '';
          break;
        }
      }
    }

    if (masterRowIndex === -1) {
      // Provide helpful error message
      const availableTaskIds = masterRows.slice(1, 6).map((row, idx) => 
        row[0] ? `Row ${idx + 2}: "${String(row[0]).substring(0, 30)}..."` : `Row ${idx + 2}: (empty)`
      ).join(', ');
      throw new Error(`Task with ID "${taskIdTrimmed}" not found. Available task IDs (first 5): ${availableTaskIds}`);
    }

    // Get sheet ID for Master Tasks tab
    const spreadsheet = await sheets.spreadsheets.get({
      auth,
      spreadsheetId: SPREADSHEET_ID,
    });
    
    // Find Master Tasks sheet (try exact match first, then case-insensitive)
    let masterSheetId = spreadsheet.data.sheets.find(
      s => s.properties.title === MASTER_TAB_NAME
    )?.properties.sheetId;

    if (!masterSheetId) {
      // Try case-insensitive match
      const caseInsensitiveMatch = spreadsheet.data.sheets.find(
        s => s.properties.title.trim().toLowerCase() === MASTER_TAB_NAME.trim().toLowerCase()
      );
      if (caseInsensitiveMatch) {
        masterSheetId = caseInsensitiveMatch.properties.sheetId;
      } else {
        // Log available sheets for debugging
        const availableSheets = spreadsheet.data.sheets.map(s => s.properties.title);
        throw new Error(`Master Tasks tab not found. Available sheets: ${availableSheets.join(', ')}`);
      }
    }

    const deleteRequests = [
      {
        deleteDimension: {
          range: {
            sheetId: masterSheetId,
            dimension: 'ROWS',
            startIndex: masterRowIndex - 1, // 0-indexed
            endIndex: masterRowIndex,
          },
        },
      },
    ];

    // If task has a project, also delete from project tab
    if (projectName) {
      const projectSheetId = spreadsheet.data.sheets.find(
        s => s.properties.title === projectName
      )?.properties.sheetId;

      if (projectSheetId) {
        // Find task in project tab
        const projectResponse = await sheets.spreadsheets.values.get({
          auth,
          spreadsheetId: SPREADSHEET_ID,
          range: `'${projectName}'!A:N`,
        });

        const projectRows = projectResponse.data.values || [];
        let projectRowIndex = -1;

        for (let i = 1; i < projectRows.length; i++) {
          const rowTaskId = projectRows[i][0] ? String(projectRows[i][0]).trim() : '';
          if (rowTaskId === taskIdTrimmed || rowTaskId.includes(taskIdTrimmed) || taskIdTrimmed.includes(rowTaskId)) {
            projectRowIndex = i + 1;
            break;
          }
        }

        if (projectRowIndex !== -1) {
          deleteRequests.push({
            deleteDimension: {
              range: {
                sheetId: projectSheetId,
                dimension: 'ROWS',
                startIndex: projectRowIndex - 1,
                endIndex: projectRowIndex,
              },
            },
          });
        }
      }
    }

    // Execute batch delete
    await sheets.spreadsheets.batchUpdate({
      auth,
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        requests: deleteRequests,
      },
    });

    return { 
      success: true, 
      message: `Task deleted successfully from ${projectName ? 'Master Tasks and ' + projectName : 'Master Tasks'}`, 
      taskId 
    };
  } catch (error) {
    console.error('Error in deleteTask:', error);
    if (error.message.includes('Requested entity was not found')) {
      throw new Error(`Google Sheet not found. Check: 1) Sheet ID is correct (current: ${SPREADSHEET_ID}), 2) Sheet is shared with service account email, 3) Sheet exists. Original error: ${error.message}`);
    }
    // Re-throw with more context
    throw new Error(`Failed to delete task: ${error.message}`);
  }
}

async function findTasksByName(taskName, limit = 10) {
  if (!SPREADSHEET_ID) {
    throw new Error('GOOGLE_SHEET_ID environment variable is not set');
  }

  const auth = await getSheetsClient();
  
  try {
    // Get all tasks
    const allTasks = await getTasks({});
    
    if (allTasks.length === 0) {
      return { matches: [], count: 0 };
    }

    const searchTerm = taskName.toLowerCase().trim();
    
    // Score tasks by how well they match
    const scoredTasks = allTasks.map(task => {
      const taskTitle = (task.tasktitle || task.taskTitle || '').toLowerCase();
      const taskDetails = (task.taskdetails || task.taskDetails || '').toLowerCase();
      const project = (task.project || '').toLowerCase();
      
      let score = 0;
      
      // Exact match gets highest score
      if (taskTitle === searchTerm) {
        score = 100;
      }
      // Starts with search term
      else if (taskTitle.startsWith(searchTerm)) {
        score = 80;
      }
      // Contains search term
      else if (taskTitle.includes(searchTerm)) {
        score = 60;
      }
      // Word match (each matching word adds points)
      else {
        const searchWords = searchTerm.split(/\s+/).filter(w => w.length > 2);
        const titleWords = taskTitle.split(/\s+/);
        searchWords.forEach(word => {
          if (titleWords.some(tw => tw.includes(word) || word.includes(tw))) {
            score += 10;
          }
        });
      }
      
      // Bonus for details match
      if (taskDetails.includes(searchTerm)) {
        score += 5;
      }
      
      // Bonus for project match
      if (project.includes(searchTerm)) {
        score += 3;
      }
      
      return {
        ...task,
        matchScore: score,
        taskId: task.taskId || task.timestamp || task.taskid || '',
        taskTitle: task.tasktitle || task.taskTitle || '',
        project: task.project || '',
      };
    })
    .filter(task => task.matchScore > 0) // Only include tasks with some match
    .sort((a, b) => b.matchScore - a.matchScore) // Sort by score descending
    .slice(0, limit); // Limit results

    return {
      matches: scoredTasks,
      count: scoredTasks.length,
      searchTerm: taskName,
    };
  } catch (error) {
    console.error('Error finding tasks by name:', error);
    throw new Error(`Failed to find tasks: ${error.message}`);
  }
}

async function deleteTasks(criteria) {
  if (!SPREADSHEET_ID) {
    throw new Error('GOOGLE_SHEET_ID environment variable is not set');
  }

  try {
    // If specific taskIds are provided, delete those directly
    if (criteria.taskIds && criteria.taskIds.length > 0) {
      const results = [];
      for (const taskId of criteria.taskIds) {
        try {
          const result = await deleteTask(taskId);
          results.push({ taskId, success: true, ...result });
        } catch (error) {
          results.push({ taskId, success: false, error: error.message });
        }
      }
      const successCount = results.filter(r => r.success).length;
      return {
        success: true,
        message: `Deleted ${successCount} of ${criteria.taskIds.length} tasks`,
        deletedCount: successCount,
        results,
      };
    }

    // Get all tasks matching filters
    const tasks = await getTasks(criteria.filters || {});
    
    if (tasks.length === 0) {
      return { success: true, message: 'No tasks found matching criteria', deletedCount: 0 };
    }

    // Handle "last N tasks" criteria
    let tasksToDelete = tasks;
    if (criteria.lastN) {
      // Sort by timestamp (newest first) and take last N
      tasksToDelete = tasks
        .sort((a, b) => {
          // Get timestamp from various possible field names
          const getTimestamp = (task) => {
            return task.timestamp || task.taskid || task.taskId || 
                   task['timestamp'] || task['taskid'] || task['taskid'] || '';
          };
          const dateA = new Date(getTimestamp(a) || 0);
          const dateB = new Date(getTimestamp(b) || 0);
          return dateB - dateA;
        })
        .slice(0, criteria.lastN);
    }

    // Delete each task
    const results = [];
    for (const task of tasksToDelete) {
      // Try various field names for taskId (timestamp is in first column)
      const taskId = task.timestamp || task.taskid || task.taskId || 
                     task['timestamp'] || task['taskid'] || 
                     (task['timestamp'] ? task['timestamp'] : '');
      
      if (taskId) {
        try {
          const result = await deleteTask(taskId);
          results.push({ taskId, success: true, ...result });
        } catch (error) {
          results.push({ taskId, success: false, error: error.message });
        }
      } else {
        results.push({ 
          task: task.taskTitle || 'Unknown', 
          success: false, 
          error: 'Task ID not found' 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    return {
      success: true,
      message: `Deleted ${successCount} of ${tasksToDelete.length} tasks`,
      deletedCount: successCount,
      results,
    };
  } catch (error) {
    throw error;
  }
}

module.exports = {
  addTaskToSheets,
  getTasks,
  getSubcontractorTasks,
  deleteTask,
  deleteTasks,
  createProjectTab,
  initializeMasterTab,
  ensureContractorsTabExists,
  addContractor,
  getContractorEmails,
  updateTask,
  findTasksByName,
  testConnection,
  verifyCredentials,
};


