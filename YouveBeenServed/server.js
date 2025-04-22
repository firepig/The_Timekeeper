require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const PouchDB = require('pouchdb');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const app = express();

// Enable CORS for all routes, allowing requests from localhost:8000 explicitly
app.use(cors({
  origin: 'http://localhost:8000'
}));
app.options('*', cors()); // Enable pre-flight requests

// Middleware to parse JSON bodies with increased payload limit
app.use(express.json({ limit: "10mb" }));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'keyboard cat',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Passport user serialization
passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((user, done) => {
  done(null, user);
});

// Google OAuth strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback',
}, (accessToken, refreshToken, profile, done) => {
  // Use Google profile info (mainly id and email)
  return done(null, {
    id: profile.id,
    email: profile.emails[0].value,
    displayName: profile.displayName
  });
}));

// Auth routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    // Successful authentication, redirect to frontend
    res.redirect('http://localhost:8000');
  }
);

app.get('/auth/logout', (req, res) => {
  req.logout(() => {
    res.redirect('http://localhost:8000');
  });
});

// Middleware to require authentication
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'User not authenticated' });
}

// API to get current user
app.get('/api/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

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
app.get('/api/tasks', ensureAuthenticated, async (req, res) => {
  try {
    const response = await axios.get(`${COUCHDB_URL}/_all_docs?include_docs=true`);
    // Only return tasks for this user
    const tasks = response.data.rows.map(row => row.doc).filter(task => task.userId === req.user.id);
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
app.post('/api/tasks', ensureAuthenticated, async (req, res) => {
  try {
    let task = req.body;
    if (!task._id) {
      task._id = "task_" + Date.now();
    }
    // Attach user info
    task.userId = req.user.id;
    task.userEmail = req.user.email;
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
app.put('/api/tasks/:id', ensureAuthenticated, async (req, res) => {
  try {
    const taskId = req.params.id;
    const task = req.body;
    // Only allow update if user matches
    if (task.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
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
app.delete('/api/tasks/:id', ensureAuthenticated, async (req, res) => {
  try {
    const taskId = req.params.id;
    const rev = req.query.rev;
    if (!rev) {
      return res.status(400).json({ error: "Missing revision (rev) parameter" });
    }
    // Fetch the task to check user
    const taskResp = await axios.get(`${COUCHDB_URL}/${taskId}`);
    if (taskResp.data.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
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
