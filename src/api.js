// src/api.js
// Frontend API client - abstracts all backend calls

const API_BASE = process.env.REACT_APP_API_URL || '';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, config);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────────────────────

export async function authenticateUser(phoneNumber) {
  return request('/api/users/auth', {
    method: 'POST',
    body: { phoneNumber },
  });
}

export async function updateUser(id, data) {
  return request(`/api/users/${id}`, {
    method: 'PATCH',
    body: data,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// IDEAS
// ─────────────────────────────────────────────────────────────────────────────

export async function getIdeas(userId) {
  const params = new URLSearchParams({ userId });
  return request(`/api/ideas?${params}`);
}

export async function getIdeaByCustomId(customIdeaId) {
  return request(`/api/ideas/${customIdeaId}`);
}

export async function createIdea(data) {
  return request('/api/ideas', {
    method: 'POST',
    body: data,
  });
}

export async function updateIdea(id, data) {
  return request(`/api/ideas/${id}`, {
    method: 'PATCH',
    body: data,
  });
}

export async function updateIdeasOrder(updates) {
  return request('/api/ideas/batch/order', {
    method: 'PATCH',
    body: { updates },
  });
}

export async function deleteIdea(id) {
  return request(`/api/ideas/${id}`, {
    method: 'DELETE',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TASKS
// ─────────────────────────────────────────────────────────────────────────────

export async function getTasks(userId, filters = {}) {
  const params = new URLSearchParams({ userId });
  if (filters.ideaId) params.append('ideaId', filters.ideaId);
  if (filters.focus) params.append('focus', filters.focus);
  if (filters.sortField) params.append('sortField', filters.sortField);
  
  return request(`/api/tasks?${params}`);
}

export async function createTask(data) {
  return request('/api/tasks', {
    method: 'POST',
    body: data,
  });
}

export async function updateTask(id, data) {
  return request(`/api/tasks/${id}`, {
    method: 'PATCH',
    body: data,
  });
}

export async function updateTasksOrder(updates, field = 'Order') {
  return request('/api/tasks/batch/order', {
    method: 'PATCH',
    body: { updates, field },
  });
}

export async function deleteTask(id) {
  return request(`/api/tasks/${id}`, {
    method: 'DELETE',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MILESTONES
// ─────────────────────────────────────────────────────────────────────────────

export async function getMilestones(userId) {
  const params = new URLSearchParams({ userId });
  return request(`/api/milestones?${params}`);
}

export async function getMilestoneByCustomId(customMilestoneId) {
  return request(`/api/milestones/${customMilestoneId}`);
}

export async function createMilestone(data) {
  return request('/api/milestones', {
    method: 'POST',
    body: data,
  });
}

export async function updateMilestone(id, data) {
  return request(`/api/milestones/${id}`, {
    method: 'PATCH',
    body: data,
  });
}

export async function deleteMilestone(id) {
  return request(`/api/milestones/${id}`, {
    method: 'DELETE',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────────────────────────────────────

export async function getAdminStatus(userId) {
  const params = new URLSearchParams({ userId });
  return request(`/api/admin/status?${params}`);
}

export async function switchDataSource(userId, dataSource) {
  return request('/api/admin/data-source', {
    method: 'POST',
    body: { userId, dataSource },
  });
}
