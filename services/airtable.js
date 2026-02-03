// services/airtable.js
// Airtable implementation of the data service

const Airtable = require('airtable');

// Lazy initialization - only create base when first used
let _base = null;
function getBase() {
  if (!_base) {
    if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
      throw new Error('Airtable credentials not configured. Set AIRTABLE_API_KEY and AIRTABLE_BASE_ID.');
    }
    _base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
      process.env.AIRTABLE_BASE_ID
    );
  }
  return _base;
}

// Helper to get base - use this instead of direct `base` reference
const base = (tableName) => getBase()(tableName);

// ─────────────────────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────────────────────

async function getUserByPhone(phoneNumber) {
  const records = await base('Users')
    .select({
      filterByFormula: `{Mobile} = "${phoneNumber}"`,
      maxRecords: 1,
    })
    .all();

  if (records.length > 0) {
    return formatRecord(records[0]);
  }
  return null;
}

async function createUser(data) {
  const created = await base('Users').create([
    { fields: { Mobile: data.mobile } },
  ]);
  return formatRecord(created[0]);
}

async function updateUser(id, data) {
  const fields = {};
  if (data.name !== undefined) fields.Name = data.name;
  if (data.todayTime !== undefined) fields.TodayTime = data.todayTime;
  if (data.goals !== undefined) fields.Goals = data.goals;

  const updated = await base('Users').update([{ id, fields }]);
  return formatRecord(updated[0]);
}

// ─────────────────────────────────────────────────────────────────────────────
// IDEAS
// ─────────────────────────────────────────────────────────────────────────────

async function getIdeas(userId) {
  const records = await base('Ideas')
    .select({
      filterByFormula: `{UserID} = "${userId}"`,
      sort: [{ field: 'Order', direction: 'asc' }],
    })
    .all();

  return records.map(formatRecord);
}

async function getIdeaByCustomId(customIdeaId) {
  const records = await base('Ideas')
    .select({
      filterByFormula: `{IdeaID} = "${customIdeaId}"`,
      maxRecords: 1,
    })
    .all();

  if (records.length > 0) {
    return formatRecord(records[0]);
  }
  return null;
}

async function createIdea(data) {
  const created = await base('Ideas').create(
    [
      {
        fields: {
          IdeaTitle: data.ideaTitle,
          IdeaSummary: data.ideaSummary || '',
          UserMobile: data.userMobile || '',
          UserID: data.userId,
        },
      },
    ],
    { typecast: true }
  );
  return formatRecord(created[0]);
}

async function updateIdea(id, data) {
  const fields = {};
  if (data.ideaTitle !== undefined) fields.IdeaTitle = data.ideaTitle;
  if (data.ideaSummary !== undefined) fields.IdeaSummary = data.ideaSummary;
  if (data.order !== undefined) fields.Order = data.order;

  const updated = await base('Ideas').update([{ id, fields }]);
  return formatRecord(updated[0]);
}

async function updateIdeasOrder(updates) {
  // updates is array of { id, order }
  const chunkSize = 10;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize).map((u) => ({
      id: u.id,
      fields: { Order: u.order },
    }));
    await base('Ideas').update(chunk);
  }
}

async function deleteIdea(id) {
  await base('Ideas').destroy([id]);
}

// ─────────────────────────────────────────────────────────────────────────────
// TASKS
// ─────────────────────────────────────────────────────────────────────────────

async function getTasks(userId, filters = {}) {
  let formula = `{UserID} = "${userId}"`;

  if (filters.ideaId) {
    formula = `AND(${formula}, {IdeaID} = "${filters.ideaId}")`;
  }
  if (filters.focus) {
    formula = `AND(${formula}, {Focus} = "${filters.focus}")`;
  }

  const records = await base('Tasks')
    .select({
      filterByFormula: formula,
      sort: [{ field: filters.sortField || 'Order', direction: 'asc' }],
    })
    .all();

  return records.map(formatRecord);
}

async function createTask(data) {
  const fields = {
    TaskName: data.taskName,
    IdeaID: data.ideaId,
    UserID: data.userId,
  };

  if (data.taskNote !== undefined) fields.TaskNote = data.taskNote;
  if (data.parentTask !== undefined) fields.ParentTask = data.parentTask;
  if (data.order !== undefined) fields.Order = data.order;
  if (data.subOrder !== undefined) fields.SubOrder = data.subOrder;
  if (data.completed !== undefined) fields.Completed = data.completed;
  if (data.focus !== undefined) fields.Focus = data.focus;
  if (data.milestoneId !== undefined) fields.MilestoneID = data.milestoneId;

  const created = await base('Tasks').create([{ fields }], { typecast: true });
  return formatRecord(created[0]);
}

async function updateTask(id, data) {
  const fields = {};

  if (data.taskName !== undefined) fields.TaskName = data.taskName;
  if (data.taskNote !== undefined) fields.TaskNote = data.taskNote;
  if (data.order !== undefined) fields.Order = data.order;
  if (data.subOrder !== undefined) fields.SubOrder = data.subOrder;
  if (data.orderToday !== undefined) fields.OrderToday = data.orderToday;
  if (data.completed !== undefined) fields.Completed = data.completed;
  if (data.completedTime !== undefined) fields.CompletedTime = data.completedTime;
  if (data.focus !== undefined) fields.Focus = data.focus;
  if (data.milestoneId !== undefined) fields.MilestoneID = data.milestoneId;
  if (data.parentTask !== undefined) fields.ParentTask = data.parentTask;

  const updated = await base('Tasks').update([{ id, fields }]);
  return formatRecord(updated[0]);
}

async function updateTasksOrder(updates, field = 'Order') {
  const chunkSize = 10;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize).map((u) => ({
      id: u.id,
      fields: { [field]: u.order },
    }));
    await base('Tasks').update(chunk);
  }
}

async function deleteTask(id) {
  await base('Tasks').destroy([id]);
}

// ─────────────────────────────────────────────────────────────────────────────
// MILESTONES
// ─────────────────────────────────────────────────────────────────────────────

async function getMilestones(userId) {
  const records = await base('Milestones')
    .select({
      filterByFormula: `{UserID} = "${userId}"`,
      sort: [{ field: 'MilestoneTime', direction: 'asc' }],
    })
    .all();

  return records.map(formatRecord);
}

async function getMilestoneByCustomId(customMilestoneId) {
  const records = await base('Milestones')
    .select({
      filterByFormula: `{MilestoneID} = "${customMilestoneId}"`,
      maxRecords: 1,
    })
    .all();

  if (records.length > 0) {
    return formatRecord(records[0]);
  }
  return null;
}

async function createMilestone(data) {
  const fields = {
    MilestoneName: data.milestoneName,
    UserID: data.userId,
  };

  if (data.milestoneTime) fields.MilestoneTime = data.milestoneTime;
  if (data.milestoneNotes) fields.MilestoneNotes = data.milestoneNotes;

  const created = await base('Milestones').create([{ fields }], { typecast: true });
  return formatRecord(created[0]);
}

async function updateMilestone(id, data) {
  const fields = {};

  if (data.milestoneName !== undefined) fields.MilestoneName = data.milestoneName;
  if (data.milestoneTime !== undefined) fields.MilestoneTime = data.milestoneTime;
  if (data.milestoneNotes !== undefined) fields.MilestoneNotes = data.milestoneNotes;

  const updated = await base('Milestones').update([{ id, fields }]);
  return formatRecord(updated[0]);
}

async function deleteMilestone(id) {
  await base('Milestones').destroy([id]);
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatRecord(record) {
  return {
    id: record.id,
    fields: record.fields,
  };
}

module.exports = {
  // Users
  getUserByPhone,
  createUser,
  updateUser,

  // Ideas
  getIdeas,
  getIdeaByCustomId,
  createIdea,
  updateIdea,
  updateIdeasOrder,
  deleteIdea,

  // Tasks
  getTasks,
  createTask,
  updateTask,
  updateTasksOrder,
  deleteTask,

  // Milestones
  getMilestones,
  getMilestoneByCustomId,
  createMilestone,
  updateMilestone,
  deleteMilestone,
};
