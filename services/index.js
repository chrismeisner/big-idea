// services/index.js
// Data source switcher - toggles between Airtable and Postgres based on env var

const dataSource = process.env.DATA_SOURCE || 'airtable';

let service;

// Only require the service that's actually needed
if (dataSource === 'postgres') {
  console.log('[DataSource] Using PostgreSQL');
  service = require('./postgres');
} else {
  console.log('[DataSource] Using Airtable');
  service = require('./airtable');
}

module.exports = service;
