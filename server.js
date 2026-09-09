const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const { randomUUID } = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./stay-on-track.db', (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database');
  }
});

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function initDb() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Stay on Track API running' });
});

app.post('/api/signup', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  if (normalizedEmail.length < 3 || String(password).length < 6) {
    return res.status(400).json({ error: 'Email must be valid and password must be at least 6 characters.' });
  }

  try {
    const existing = await get('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);
    const id = randomUUID();

    await run(
      'INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)',
      [id, String(name).trim(), normalizedEmail, hashedPassword]
    );

    res.status(201).json({
      id,
      name: String(name).trim(),
      email: normalizedEmail
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await get('SELECT * FROM users WHERE email = ?', [normalizedEmail]);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const passwordMatches = await bcrypt.compare(String(password), user.password);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Unable to log in right now.' });
  }
});

app.get('/api/tasks/:userId', async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  try {
    const tasks = await all(
      'SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

    res.json(tasks);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Unable to load tasks.' });
  }
});

app.post('/api/tasks/:userId', async (req, res) => {
  const { userId } = req.params;
  const { title, status, notes } = req.body;

  if (!userId || !title || !status) {
    return res.status(400).json({ error: 'User ID, title, and status are required.' });
  }

  try {
    const user = await get('SELECT id FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const task = {
      id: randomUUID(),
      user_id: userId,
      title: String(title).trim(),
      status: String(status),
      notes: notes ? String(notes).trim() : '',
      created_at: new Date().toISOString()
    };

    await run(
      'INSERT INTO tasks (id, user_id, title, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [task.id, task.user_id, task.title, task.status, task.notes, task.created_at]
    );

    res.status(201).json(task);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Unable to save task.' });
  }
});

app.put('/api/tasks/:userId/:taskId', async (req, res) => {
  const { userId, taskId } = req.params;
  const { title, status, notes } = req.body;

  if (!userId || !taskId) {
    return res.status(400).json({ error: 'User ID and task ID are required.' });
  }

  try {
    const task = await get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [taskId, userId]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const updatedTask = {
      title: title ? String(title).trim() : task.title,
      status: status ? String(status) : task.status,
      notes: notes !== undefined ? String(notes).trim() : task.notes
    };

    await run(
      'UPDATE tasks SET title = ?, status = ?, notes = ? WHERE id = ? AND user_id = ?',
      [updatedTask.title, updatedTask.status, updatedTask.notes, taskId, userId]
    );

    res.json({ id: taskId, user_id: userId, ...updatedTask, created_at: task.created_at });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Unable to update task.' });
  }
});

app.delete('/api/tasks/:userId/:taskId', async (req, res) => {
  const { userId, taskId } = req.params;

  try {
    const task = await get('SELECT id FROM tasks WHERE id = ? AND user_id = ?', [taskId, userId]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    await run('DELETE FROM tasks WHERE id = ? AND user_id = ?', [taskId, userId]);
    res.json({ success: true, taskId });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Unable to delete task.' });
  }
});

async function startServer() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`Stay on Track API running on http://localhost:${PORT}`);
  });
}

startServer();
