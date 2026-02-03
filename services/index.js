// services/index.js
// Data source switcher - toggles between Airtable and Postgres based on env var

const dataSource = process.env.DATA_SOURCE || 'airtable';

let service;

if (dataSource === 'postgres') {
  service = require('./postgres');
  console.log('[DataSource] Using PostgreSQL');
} else {
  service = require('./airtable');
  console.log('[DataSource] Using Airtable');
}

module.exports = service;
