require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const PouchDB = require('pouchdb');

const app = express();

// Enable CORS for all routes, allowing requests from localhost:8000 explicitly
app.use(cors({
  origin: 'http://localhost:8000'
}));
app.options('*', cors()); // Enable pre-flight requests

// Middleware to parse JSON bodies with increased payload limit
app.use(express.json({ limit: "10mb" }));

// Load credentials from environment variables
const {
  COUCHDB_USERNAME,
  COUCHDB_PASSWORD,
  COUCHDB_HOST,
  COUCHDB_PORT,
  COUCHDB_DB,
  PORT
} = process.env;

// Construct the base URL for CouchDB
const COUCHDB_URL = `http://${COUCHDB_USERNAME}:${COUCHDB_PASSWORD}@${COUCHDB_HOST}:${COUCHDB_PORT}/${COUCHDB_DB}`;

const localDB = new PouchDB('serverDB');

// Start continuous sync in the background
localDB.sync(COUCHDB_URL, { live: true, retry: true })
  .on('error', (err) => {
    console.error("Sync error:", err);
  });

/**
 * GET /api/tasks
 * Retrieves all tasks from CouchDB.
 */
app.get('/api/tasks', async (req, res) => {
  try {
    const response = await axios.get(`${COUCHDB_URL}/_all_docs?include_docs=true`);
    const tasks = response.data.rows.map(row => row.doc);
    res.json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tasks
 * Adds a new task. If an _id is not provided, one is generated.
 */
app.post('/api/tasks', async (req, res) => {
  try {
    let task = req.body;
    if (!task._id) {
      task._id = "task_" + Date.now();
    }
    const response = await axios.put(`${COUCHDB_URL}/${task._id}`, task);
    res.json(response.data);
  } catch (error) {
    console.error("Error adding task:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/tasks/:id
 * Updates an existing task using the provided task data.
 */
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const taskId = req.params.id;
    const task = req.body;
    const response = await axios.put(`${COUCHDB_URL}/${taskId}`, task);
    res.json(response.data);
  } catch (error) {
    console.error("Error updating task:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/tasks/:id
 * Deletes a task. Requires the revision (rev) to be provided as a query parameter.
 */
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const taskId = req.params.id;
    const rev = req.query.rev;
    if (!rev) {
      return res.status(400).json({ error: "Missing revision (rev) parameter" });
    }
    const response = await axios.delete(`${COUCHDB_URL}/${taskId}?rev=${rev}`);
    res.json(response.data);
  } catch (error) {
    console.error("Error deleting task:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
const serverPort = PORT || 3000;
app.listen(serverPort, () => {
  console.log(`Proxy server running on port ${serverPort}`);
});
