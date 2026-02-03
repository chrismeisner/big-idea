// services/postgres.js
// PostgreSQL implementation of the data service

const { Pool } = require('pg');
const { nanoid } = require('nanoid');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// ─────────────────────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────────────────────

async function getUserByPhone(phoneNumber) {
  const result = await pool.query(
    'SELECT * FROM users WHERE mobile = $1 LIMIT 1',
    [phoneNumber]
  );

  if (result.rows.length > 0) {
    return formatUser(result.rows[0]);
  }
  return null;
}

async function createUser(data) {
  const userId = nanoid(10);
  const result = await pool.query(
    `INSERT INTO users (user_id, mobile) VALUES ($1, $2) RETURNING *`,
    [userId, data.mobile]
  );
  return formatUser(result.rows[0]);
}

async function updateUser(id, data) {
  const sets = [];
  const values = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    sets.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.todayTime !== undefined) {
    sets.push(`today_time = $${paramIndex++}`);
    values.push(data.todayTime);
  }
  if (data.goals !== undefined) {
    sets.push(`goals = $${paramIndex++}`);
    values.push(data.goals);
  }

  if (sets.length === 0) return null;

  // Handle both numeric IDs and Airtable-style IDs (e.g., "rechJ0hdf3v9TwaXJ")
  // If the ID starts with "rec", it's an Airtable ID - extract the user_id part
  const isAirtableId = typeof id === 'string' && id.startsWith('rec');
  
  if (isAirtableId) {
    // Look up by user_id field instead (strip "rec" prefix to get actual user_id)
    const userId = id.replace(/^rec/, '');
    values.push(userId);
    const result = await pool.query(
      `UPDATE users SET ${sets.join(', ')} WHERE user_id = $${paramIndex} RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      throw new Error(`User not found with user_id: ${userId}`);
    }
    return formatUser(result.rows[0]);
  } else {
    values.push(id);
    const result = await pool.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      throw new Error(`User not found with id: ${id}`);
    }
    return formatUser(result.rows[0]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// IDEAS
// ─────────────────────────────────────────────────────────────────────────────

async function getIdeas(userId) {
  const result = await pool.query(
    'SELECT * FROM ideas WHERE user_id = $1 ORDER BY "order" ASC',
    [userId]
  );
  return result.rows.map(formatIdea);
}

async function getIdeaByCustomId(customIdeaId) {
  const result = await pool.query(
    'SELECT * FROM ideas WHERE idea_id = $1 LIMIT 1',
    [customIdeaId]
  );

  if (result.rows.length > 0) {
    return formatIdea(result.rows[0]);
  }
  return null;
}

async function createIdea(data) {
  const ideaId = nanoid(10);
  const result = await pool.query(
    `INSERT INTO ideas (idea_id, idea_title, idea_summary, user_mobile, user_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [ideaId, data.ideaTitle, data.ideaSummary || '', data.userMobile || '', data.userId]
  );
  return formatIdea(result.rows[0]);
}

async function updateIdea(id, data) {
  const sets = [];
  const values = [];
  let paramIndex = 1;

  if (data.ideaTitle !== undefined) {
    sets.push(`idea_title = $${paramIndex++}`);
    values.push(data.ideaTitle);
  }
  if (data.ideaSummary !== undefined) {
    sets.push(`idea_summary = $${paramIndex++}`);
    values.push(data.ideaSummary);
  }
  if (data.order !== undefined) {
    sets.push(`"order" = $${paramIndex++}`);
    values.push(data.order);
  }

  if (sets.length === 0) return null;

  values.push(id);
  const result = await pool.query(
    `UPDATE ideas SET ${sets.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return formatIdea(result.rows[0]);
}

async function updateIdeasOrder(updates) {
  // updates is array of { id, order }
  for (const u of updates) {
    await pool.query('UPDATE ideas SET "order" = $1 WHERE id = $2', [u.order, u.id]);
  }
}

async function deleteIdea(id) {
  await pool.query('DELETE FROM ideas WHERE id = $1', [id]);
}

// ─────────────────────────────────────────────────────────────────────────────
// TASKS
// ─────────────────────────────────────────────────────────────────────────────

async function getTasks(userId, filters = {}) {
  let query = 'SELECT * FROM tasks WHERE user_id = $1';
  const values = [userId];
  let paramIndex = 2;

  if (filters.ideaId) {
    query += ` AND idea_id = $${paramIndex++}`;
    values.push(filters.ideaId);
  }
  if (filters.focus) {
    query += ` AND focus = $${paramIndex++}`;
    values.push(filters.focus);
  }

  const sortField = filters.sortField === 'OrderToday' ? 'order_today' : '"order"';
  query += ` ORDER BY ${sortField} ASC`;

  const result = await pool.query(query, values);
  return result.rows.map(formatTask);
}

async function createTask(data) {
  const taskId = nanoid(10);
  const result = await pool.query(
    `INSERT INTO tasks (task_id, task_name, task_note, idea_id, user_id, parent_task, 
     "order", sub_order, completed, focus, milestone_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [
      taskId,
      data.taskName,
      data.taskNote || '',
      data.ideaId,
      data.userId,
      data.parentTask || '',
      data.order || 0,
      data.subOrder || 0,
      data.completed || false,
      data.focus || '',
      data.milestoneId || '',
    ]
  );
  return formatTask(result.rows[0]);
}

async function updateTask(id, data) {
  const sets = [];
  const values = [];
  let paramIndex = 1;

  if (data.taskName !== undefined) {
    sets.push(`task_name = $${paramIndex++}`);
    values.push(data.taskName);
  }
  if (data.taskNote !== undefined) {
    sets.push(`task_note = $${paramIndex++}`);
    values.push(data.taskNote);
  }
  if (data.order !== undefined) {
    sets.push(`"order" = $${paramIndex++}`);
    values.push(data.order);
  }
  if (data.subOrder !== undefined) {
    sets.push(`sub_order = $${paramIndex++}`);
    values.push(data.subOrder);
  }
  if (data.orderToday !== undefined) {
    sets.push(`order_today = $${paramIndex++}`);
    values.push(data.orderToday);
  }
  if (data.completed !== undefined) {
    sets.push(`completed = $${paramIndex++}`);
    values.push(data.completed);
  }
  if (data.completedTime !== undefined) {
    sets.push(`completed_time = $${paramIndex++}`);
    values.push(data.completedTime);
  }
  if (data.focus !== undefined) {
    sets.push(`focus = $${paramIndex++}`);
    values.push(data.focus);
  }
  if (data.milestoneId !== undefined) {
    sets.push(`milestone_id = $${paramIndex++}`);
    values.push(data.milestoneId);
  }
  if (data.parentTask !== undefined) {
    sets.push(`parent_task = $${paramIndex++}`);
    values.push(data.parentTask);
  }

  if (sets.length === 0) return null;

  values.push(id);
  const result = await pool.query(
    `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return formatTask(result.rows[0]);
}

async function updateTasksOrder(updates, field = 'Order') {
  const dbField = field === 'OrderToday' ? 'order_today' : field === 'SubOrder' ? 'sub_order' : '"order"';
  for (const u of updates) {
    await pool.query(`UPDATE tasks SET ${dbField} = $1 WHERE id = $2`, [u.order, u.id]);
  }
}

async function deleteTask(id) {
  await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
}

// ─────────────────────────────────────────────────────────────────────────────
// MILESTONES
// ─────────────────────────────────────────────────────────────────────────────

async function getMilestones(userId) {
  const result = await pool.query(
    'SELECT * FROM milestones WHERE user_id = $1 ORDER BY milestone_time ASC NULLS LAST',
    [userId]
  );
  return result.rows.map(formatMilestone);
}

async function getMilestoneByCustomId(customMilestoneId) {
  const result = await pool.query(
    'SELECT * FROM milestones WHERE milestone_id = $1 LIMIT 1',
    [customMilestoneId]
  );

  if (result.rows.length > 0) {
    return formatMilestone(result.rows[0]);
  }
  return null;
}

async function createMilestone(data) {
  const milestoneId = nanoid(10);
  const result = await pool.query(
    `INSERT INTO milestones (milestone_id, milestone_name, milestone_time, milestone_notes, user_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [
      milestoneId,
      data.milestoneName,
      data.milestoneTime || null,
      data.milestoneNotes || '',
      data.userId,
    ]
  );
  return formatMilestone(result.rows[0]);
}

async function updateMilestone(id, data) {
  const sets = [];
  const values = [];
  let paramIndex = 1;

  if (data.milestoneName !== undefined) {
    sets.push(`milestone_name = $${paramIndex++}`);
    values.push(data.milestoneName);
  }
  if (data.milestoneTime !== undefined) {
    sets.push(`milestone_time = $${paramIndex++}`);
    values.push(data.milestoneTime);
  }
  if (data.milestoneNotes !== undefined) {
    sets.push(`milestone_notes = $${paramIndex++}`);
    values.push(data.milestoneNotes);
  }

  if (sets.length === 0) return null;

  values.push(id);
  const result = await pool.query(
    `UPDATE milestones SET ${sets.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return formatMilestone(result.rows[0]);
}

async function deleteMilestone(id) {
  await pool.query('DELETE FROM milestones WHERE id = $1', [id]);
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATTERS - Convert snake_case DB rows to Airtable-like format
// ─────────────────────────────────────────────────────────────────────────────

function formatUser(row) {
  return {
    id: row.id.toString(),
    fields: {
      UserID: row.user_id,
      Mobile: row.mobile,
      Name: row.name,
      TodayTime: row.today_time,
      Goals: row.goals,
      IsAdmin: row.is_admin || false,
    },
  };
}

function formatIdea(row) {
  return {
    id: row.id.toString(),
    fields: {
      IdeaID: row.idea_id,
      IdeaTitle: row.idea_title,
      IdeaSummary: row.idea_summary,
      UserMobile: row.user_mobile,
      UserID: row.user_id,
      Order: row.order,
    },
  };
}

function formatTask(row) {
  return {
    id: row.id.toString(),
    fields: {
      TaskID: row.task_id,
      TaskName: row.task_name,
      TaskNote: row.task_note,
      IdeaID: row.idea_id,
      UserID: row.user_id,
      ParentTask: row.parent_task,
      Order: row.order,
      SubOrder: row.sub_order,
      OrderToday: row.order_today,
      Completed: row.completed,
      CompletedTime: row.completed_time ? row.completed_time.toISOString() : null,
      Focus: row.focus,
      MilestoneID: row.milestone_id,
    },
  };
}

function formatMilestone(row) {
  return {
    id: row.id.toString(),
    fields: {
      MilestoneID: row.milestone_id,
      MilestoneName: row.milestone_name,
      MilestoneTime: row.milestone_time ? row.milestone_time.toISOString() : null,
      MilestoneNotes: row.milestone_notes,
      UserID: row.user_id,
    },
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

  // Export pool for schema initialization
  pool,
};
