import Airtable from "airtable";

// Configure Airtable using environment variables
const airtableBase = new Airtable({ apiKey: process.env.REACT_APP_AIRTABLE_API_KEY }).base(
  process.env.REACT_APP_AIRTABLE_BASE_ID
);

export default airtableBase;