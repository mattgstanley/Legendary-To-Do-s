const { initializeMasterTab } = require('../index');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'POST') {
      console.log('Initialize endpoint called');
      
      // Check environment variables before proceeding
      if (!process.env.GOOGLE_SHEET_ID) {
        console.error('GOOGLE_SHEET_ID is not set');
        return res.status(500).json({ 
          success: false, 
          error: 'GOOGLE_SHEET_ID environment variable is not set' 
        });
      }
      
      if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        console.error('GOOGLE_SERVICE_ACCOUNT_KEY is not set');
        return res.status(500).json({ 
          success: false, 
          error: 'GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set' 
        });
      }
      
      console.log('Environment variables check passed');
      const result = await initializeMasterTab();
      console.log('Initialize completed successfully');
      return res.json(result);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in initialize API:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

