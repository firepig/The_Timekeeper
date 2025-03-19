import PouchDB from 'pouchdb';
import { parseTimeToSeconds, formatTime } from './utils.js';

const db = new PouchDB("my_database");
const remoteCouchDB = 'YourDBURL';

const TaskManager = {
  tasks: [],

  loadTasks: function () {
    return db.allDocs({ include_docs: true }).then(
      function (result) {
        this.tasks = result.rows.map(function (row) {
          return row.doc;
        });
        renderTasks();
      }.bind(this)
    ).catch(err => console.error("Error loading tasks:", err));
  },

  saveTask: function (task) {
    return db.put(task).then(function (response) {
      task._rev = response.rev;
      renderTasks();
    }).catch(err => console.error("Error saving task:", err));
  },

  addTask: function (task) {
    if (isDuplicate(task)) {
      console.log("Duplicate task not added");
      return;
    }

    task._id = "task_" + Date.now();
    this.tasks.push(task);
    return this.saveTask(task);
  },

  updateTask: function (index, task) {
    this.tasks[index] = task;
    return this.saveTask(task);
  },

  deleteTask: function (index) {
    const task = this.tasks[index];
    return db.remove(task).then(
      function (response) {
        this.tasks.splice(index, 1);
        renderTasks();
      }.bind(this)
    ).catch(err => console.error("Error deleting task:", err));
  },

  getTask: function (index) {
    return this.tasks[index];
  },

  getAllTasks: function () {
    return this.tasks;
  },
};

function isDuplicate(newTask) {
  return TaskManager.tasks.some(task =>
    task.JIRA === newTask.JIRA &&
    task.name === newTask.name &&
    task.dueDate === newTask.dueDate
  );
}

function syncWithRemoteCouchDB() {
  if (remoteCouchDB) {
    db.sync(remoteCouchDB, {
      live: true,
      retry: true,
    })
      .on('change', function (info) {})
      .on('paused', function (err) {})
      .on('active', function () {})
      .on('denied', function (err) {})
      .on('complete', function (info) {})
      .on('error', function (err) {
        console.error("Error during CouchDB sync:", err);
      });
  }
}

syncWithRemoteCouchDB();

export default TaskManager;