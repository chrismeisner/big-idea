// services/dataSourceManager.js
// Dynamic data source manager - allows runtime switching between Airtable and Postgres

let currentDataSource = process.env.DATA_SOURCE || 'airtable';
let airtableService = null;
let postgresService = null;

// Lazy load services to avoid initialization errors
function getAirtableService() {
  if (!airtableService) {
    airtableService = require('./airtable');
  }
  return airtableService;
}

function getPostgresService() {
  if (!postgresService) {
    postgresService = require('./postgres');
  }
  return postgresService;
}

// Get the current active service
function getService() {
  if (currentDataSource === 'postgres') {
    return getPostgresService();
  }
  return getAirtableService();
}

// Get current data source name
function getCurrentDataSource() {
  return currentDataSource;
}

// Switch data source (admin only)
function setDataSource(source) {
  if (source !== 'airtable' && source !== 'postgres') {
    throw new Error('Invalid data source. Must be "airtable" or "postgres".');
  }
  
  // Validate the service can be loaded before switching
  if (source === 'postgres') {
    getPostgresService(); // This will throw if not configured
  } else {
    getAirtableService(); // This will throw if not configured
  }
  
  currentDataSource = source;
  console.log(`[DataSource] Switched to ${source}`);
  return currentDataSource;
}

// Check if a data source is available/configured
function isDataSourceAvailable(source) {
  try {
    if (source === 'postgres') {
      return !!process.env.DATABASE_URL;
    } else {
      return !!(process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID);
    }
  } catch {
    return false;
  }
}

module.exports = {
  getService,
  getCurrentDataSource,
  setDataSource,
  isDataSourceAvailable,
};
