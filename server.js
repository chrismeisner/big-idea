// server.js
// Express API server with data source switching

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Load data service (switches between Airtable and Postgres based on DATA_SOURCE env var)
const dataService = require('./services');

// ─────────────────────────────────────────────────────────────────────────────
// API ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    dataSource: process.env.DATA_SOURCE || 'airtable',
    timestamp: new Date().toISOString()
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────────────────────

// Get or create user by phone number
app.post('/api/users/auth', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ error: 'phoneNumber is required' });
    }

    let user = await dataService.getUserByPhone(phoneNumber);
    
    if (!user) {
      user = await dataService.createUser({ mobile: phoneNumber });
    }

    res.json(user);
  } catch (err) {
    console.error('[API] POST /api/users/auth error:', err);
    res.status(500).json({ error: 'Failed to authenticate user' });
  }
});

// Update user
app.patch('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await dataService.updateUser(id, req.body);
    res.json(user);
  } catch (err) {
    console.error('[API] PATCH /api/users/:id error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// IDEAS
// ─────────────────────────────────────────────────────────────────────────────

// Get all ideas for a user
app.get('/api/ideas', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const ideas = await dataService.getIdeas(userId);
    res.json({ records: ideas });
  } catch (err) {
    console.error('[API] GET /api/ideas error:', err);
    res.status(500).json({ error: 'Failed to fetch ideas' });
  }
});

// Get single idea by custom ID
app.get('/api/ideas/:customIdeaId', async (req, res) => {
  try {
    const { customIdeaId } = req.params;
    const idea = await dataService.getIdeaByCustomId(customIdeaId);
    
    if (!idea) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    res.json(idea);
  } catch (err) {
    console.error('[API] GET /api/ideas/:customIdeaId error:', err);
    res.status(500).json({ error: 'Failed to fetch idea' });
  }
});

// Create idea
app.post('/api/ideas', async (req, res) => {
  try {
    const idea = await dataService.createIdea(req.body);
    res.json(idea);
  } catch (err) {
    console.error('[API] POST /api/ideas error:', err);
    res.status(500).json({ error: 'Failed to create idea' });
  }
});

// Update idea
app.patch('/api/ideas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const idea = await dataService.updateIdea(id, req.body);
    res.json(idea);
  } catch (err) {
    console.error('[API] PATCH /api/ideas/:id error:', err);
    res.status(500).json({ error: 'Failed to update idea' });
  }
});

// Batch update ideas order
app.patch('/api/ideas/batch/order', async (req, res) => {
  try {
    const { updates } = req.body; // [{ id, order }, ...]
    await dataService.updateIdeasOrder(updates);
    res.json({ success: true });
  } catch (err) {
    console.error('[API] PATCH /api/ideas/batch/order error:', err);
    res.status(500).json({ error: 'Failed to update ideas order' });
  }
});

// Delete idea
app.delete('/api/ideas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await dataService.deleteIdea(id);
    res.json({ success: true });
  } catch (err) {
    console.error('[API] DELETE /api/ideas/:id error:', err);
    res.status(500).json({ error: 'Failed to delete idea' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TASKS
// ─────────────────────────────────────────────────────────────────────────────

// Get tasks for a user (with optional filters)
app.get('/api/tasks', async (req, res) => {
  try {
    const { userId, ideaId, focus, sortField } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const filters = {};
    if (ideaId) filters.ideaId = ideaId;
    if (focus) filters.focus = focus;
    if (sortField) filters.sortField = sortField;

    const tasks = await dataService.getTasks(userId, filters);
    res.json({ records: tasks });
  } catch (err) {
    console.error('[API] GET /api/tasks error:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Create task
app.post('/api/tasks', async (req, res) => {
  try {
    const task = await dataService.createTask(req.body);
    res.json(task);
  } catch (err) {
    console.error('[API] POST /api/tasks error:', err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update task
app.patch('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const task = await dataService.updateTask(id, req.body);
    res.json(task);
  } catch (err) {
    console.error('[API] PATCH /api/tasks/:id error:', err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Batch update tasks order
app.patch('/api/tasks/batch/order', async (req, res) => {
  try {
    const { updates, field } = req.body; // [{ id, order }, ...], field = 'Order' | 'SubOrder' | 'OrderToday'
    await dataService.updateTasksOrder(updates, field);
    res.json({ success: true });
  } catch (err) {
    console.error('[API] PATCH /api/tasks/batch/order error:', err);
    res.status(500).json({ error: 'Failed to update tasks order' });
  }
});

// Delete task
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await dataService.deleteTask(id);
    res.json({ success: true });
  } catch (err) {
    console.error('[API] DELETE /api/tasks/:id error:', err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// MILESTONES
// ─────────────────────────────────────────────────────────────────────────────

// Get all milestones for a user
app.get('/api/milestones', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const milestones = await dataService.getMilestones(userId);
    res.json({ records: milestones });
  } catch (err) {
    console.error('[API] GET /api/milestones error:', err);
    res.status(500).json({ error: 'Failed to fetch milestones' });
  }
});

// Get single milestone by custom ID
app.get('/api/milestones/:customMilestoneId', async (req, res) => {
  try {
    const { customMilestoneId } = req.params;
    const milestone = await dataService.getMilestoneByCustomId(customMilestoneId);
    
    if (!milestone) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    res.json(milestone);
  } catch (err) {
    console.error('[API] GET /api/milestones/:customMilestoneId error:', err);
    res.status(500).json({ error: 'Failed to fetch milestone' });
  }
});

// Create milestone
app.post('/api/milestones', async (req, res) => {
  try {
    const milestone = await dataService.createMilestone(req.body);
    res.json(milestone);
  } catch (err) {
    console.error('[API] POST /api/milestones error:', err);
    res.status(500).json({ error: 'Failed to create milestone' });
  }
});

// Update milestone
app.patch('/api/milestones/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const milestone = await dataService.updateMilestone(id, req.body);
    res.json(milestone);
  } catch (err) {
    console.error('[API] PATCH /api/milestones/:id error:', err);
    res.status(500).json({ error: 'Failed to update milestone' });
  }
});

// Delete milestone
app.delete('/api/milestones/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await dataService.deleteMilestone(id);
    res.json({ success: true });
  } catch (err) {
    console.error('[API] DELETE /api/milestones/:id error:', err);
    res.status(500).json({ error: 'Failed to delete milestone' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// STATIC FILES (Production)
// ─────────────────────────────────────────────────────────────────────────────

if (process.env.NODE_ENV === 'production') {
  // Serve static files from React build
  app.use(express.static(path.join(__dirname, 'build')));

  // For any route not matching API, serve index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Data source: ${process.env.DATA_SOURCE || 'airtable'}`);
  if (process.env.NODE_ENV === 'production') {
    console.log('Serving static files from build/');
  }
});
