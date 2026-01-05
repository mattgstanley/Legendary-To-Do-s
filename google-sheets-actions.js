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

  if (keyContent.trim().startsWith('{')) {
    try {
      const keyData = JSON.parse(keyContent);
      return new google.auth.GoogleAuth({
        credentials: keyData,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
    } catch (e) {
      throw new Error(`Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY as JSON: ${e.message}`);
    }
  }

  const fs = require('fs');
  const path = require('path');
  let filePath = keyContent.trim();
  
  if (filePath.startsWith('./')) {
    filePath = filePath.substring(2);
  }
  
  const fullPath = path.resolve(process.cwd(), filePath);
  if (fs.existsSync(fullPath)) {
    return new google.auth.GoogleAuth({
      keyFile: fullPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  }

  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    throw new Error(`GOOGLE_SERVICE_ACCOUNT_KEY is set to a file path, but file paths don't work on serverless platforms. Paste the entire JSON content as a string.`);
  }

  return new google.auth.GoogleAuth({
    keyFile: filePath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function addTaskToSheets(taskData) {
  if (!SPREADSHEET_ID) {
    throw new Error('GOOGLE_SHEET_ID environment variable is not set');
  }

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
    await ensureProjectTabExists(auth, taskData.project);

    const appendRow = async (range) => {
      await sheets.spreadsheets.values.append({
        auth,
        spreadsheetId: SPREADSHEET_ID,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [row] },
      });
    };

    await Promise.all([
      appendRow(`${MASTER_TAB_NAME}!A:N`),
      appendRow(`${taskData.project}!A:N`),
    ]);

    await Promise.all([
      applyRowFormatting(auth, MASTER_TAB_NAME),
      applyRowFormatting(auth, taskData.project),
    ]);

    return { success: true, taskId: timestamp };
  } catch (error) {
    if (error.message.includes('Requested entity was not found')) {
      throw new Error(`Google Sheet not found. Check: 1) Sheet ID is correct (current: ${SPREADSHEET_ID}), 2) Sheet is shared with service account email, 3) Sheet exists. Original error: ${error.message}`);
    }
    throw error;
  }
}

async function ensureContractorsTabExists(auth) {
  const sheetsClient = sheets.spreadsheets;
  
  try {
    const spreadsheet = await sheetsClient.get({ auth, spreadsheetId: SPREADSHEET_ID });
    const existingTabs = spreadsheet.data.sheets.map(s => s.properties.title);
    
    if (existingTabs.includes(CONTRACTORS_TAB_NAME)) {
      const response = await sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: SPREADSHEET_ID,
        range: `${CONTRACTORS_TAB_NAME}!A1:D1`,
      });
      
      if (!response.data.values || response.data.values.length === 0) {
        const headers = ['Contractor Name', 'Email', 'Phone', 'Trade'];
        await sheets.spreadsheets.values.update({
          auth,
          spreadsheetId: SPREADSHEET_ID,
          range: `${CONTRACTORS_TAB_NAME}!A1:D1`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [headers] },
        });
      }
      return;
    }

    await sheetsClient.batchUpdate({
      auth,
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        requests: [{ addSheet: { properties: { title: CONTRACTORS_TAB_NAME } } }],
      },
    });

    const headers = ['Contractor Name', 'Email', 'Phone', 'Trade'];
    await sheets.spreadsheets.values.update({
      auth,
      spreadsheetId: SPREADSHEET_ID,
      range: `${CONTRACTORS_TAB_NAME}!A1:D1`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [headers] },
    });

    const updatedSpreadsheet = await sheetsClient.get({ auth, spreadsheetId: SPREADSHEET_ID });
    const sheetId = updatedSpreadsheet.data.sheets.find(s => s.properties.title === CONTRACTORS_TAB_NAME).properties.sheetId;
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
  } catch (error) {
    console.error('Error ensuring Contractors tab exists:', error);
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
        range: `${projectName}!A1:N1`,
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
    range: `${sheetName}!A1:N1`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [headers] },
  });
}

async function setupSheetFormatting(auth, sheetName) {
  const sheetsClient = sheets.spreadsheets;
  const spreadsheet = await sheetsClient.get({ auth, spreadsheetId: SPREADSHEET_ID });
  const sheetId = spreadsheet.data.sheets.find(s => s.properties.title === sheetName).properties.sheetId;
  
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
  
  await sheetsClient.batchUpdate({
    auth,
    spreadsheetId: SPREADSHEET_ID,
    resource: { requests },
  });
  
  const valuesResponse = await sheets.spreadsheets.values.get({
    auth,
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
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
      range: `${sheetName}!B2:B${rowCount}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: formulas },
    });
  }
}

async function applyRowFormatting(auth, projectName) {
  try {
    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: SPREADSHEET_ID,
      range: `${projectName}!A:A`,
    });
    
    const rowCount = (response.data.values || []).length;
    if (rowCount < 2) return; // No data rows yet
    
    const lastRow = rowCount;
    const formula = `=IF(A${lastRow}="","",ROUNDDOWN((TODAY()-DATEVALUE(LEFT(A${lastRow},10))),0))`;
    await sheets.spreadsheets.values.update({
      auth,
      spreadsheetId: SPREADSHEET_ID,
      range: `${projectName}!B${lastRow}`,
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
      range: `${MASTER_TAB_NAME}!A:N`,
    });

    const rows = response.data.values || [];
    if (rows.length === 0) return [];

    const headers = rows[0];
    let tasks = rows.slice(1).map(row => {
      const task = {};
      headers.forEach((header, index) => {
        task[header.toLowerCase().replace(/\s+/g, '')] = row[index] || '';
      });
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

async function initializeMasterTab() {
  const auth = await getSheetsClient();
  const sheetsClient = sheets.spreadsheets;
  
  try {
    // Ensure Contractors tab exists first
    await ensureContractorsTabExists(auth);
    
    const spreadsheet = await sheetsClient.get({ auth, spreadsheetId: SPREADSHEET_ID });
    const existingTabs = spreadsheet.data.sheets.map(s => s.properties.title);
    
    if (!existingTabs.includes(MASTER_TAB_NAME)) {
      // Create Master Tasks tab
      await sheetsClient.batchUpdate({
        auth,
        spreadsheetId: SPREADSHEET_ID,
        resource: {
          requests: [{ addSheet: { properties: { title: MASTER_TAB_NAME } } }],
        },
      });
    }
    
    // Setup headers and formatting for Master Tasks tab
    await setupSheetHeaders(auth, MASTER_TAB_NAME);
    await setupSheetFormatting(auth, MASTER_TAB_NAME);
    
    return { success: true, message: 'Master tab and Contractors tab initialized successfully' };
  } catch (error) {
    console.error('Error initializing Master tab:', error);
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
      range: `${CONTRACTORS_TAB_NAME}!A:B`, // Get Name (A) and Email (B) columns
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
      range: `${CONTRACTORS_TAB_NAME}!A:D`,
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
      range: `${MASTER_TAB_NAME}!A:N`,
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
      range: `${MASTER_TAB_NAME}!A${taskRowIndex}:N${taskRowIndex}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [taskRow] },
    });

    if (projectName) {
      const projectResponse = await sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: SPREADSHEET_ID,
        range: `${projectName}!A:N`,
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
          range: `${projectName}!A${projectRowIndex}:N${projectRowIndex}`,
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

module.exports = {
  addTaskToSheets,
  getTasks,
  getSubcontractorTasks,
  createProjectTab,
  initializeMasterTab,
  ensureContractorsTabExists,
  addContractor,
  getContractorEmails,
  updateTask,
};


