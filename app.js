$(document).ready(function () {
  // animate image transitions over the course o 13 seconds using css
  function timeCheck() {
    //TODO add a function to check the time and change the background image accordingly
    var currentTime = new Date().getHours();
    if (23 <= currentTime && currentTime < 3) {
      // it's between 11pm and 3am
      $("body").css("background-image", "url(images/2.jpg)");
    } else if (6 <= currentTime && currentTime < 9) {
      // it's between 6am and 9am
      $("body").css("background-image", "url(images/1.jpg)");
    } else if (9 <= currentTime && currentTime < 12) {
      // it's between 9am and 12pm
      $("body").css("background-image", "url(images/3.jpg)");
    } else if (12 <= currentTime && currentTime < 15) {
      // it's between 12pm and 3pm
      $("body").css("background-image", "url(images/4.jpg)");
    } else if (15 <= currentTime && currentTime < 18) {
      // it's between 3pm and 6pm
      $("body").css("background-image", "url(images/5.jpg)");
    } else if (18 <= currentTime && currentTime < 21) {
      // it's between 6pm and 9pm
      $("body").css("background-image", "url(images/7.jpg)");
    } else {
      // it's between 9pm and 11pm
      $("body").css("background-image", "url(images/2.jpg)");
    }
    console.log("timechecked-background applied");
  }
  timeCheck();
  setInterval(timeCheck, 600000);

  function isDuplicate(newTask) {
    return TaskManager.tasks.some((task) => {
      return (
        task.JIRA === newTask.JIRA &&
        task.name === newTask.name &&
        task.dueDate === newTask.dueDate
      );
    });
  }

  // Create a new PouchDB instance
  var db = new PouchDB("my_database");
  var remoteCouchDB = 'YourDBURL';
  function syncWithRemoteCouchDB() {
    if (remoteCouchDB) {
      db.sync(remoteCouchDB, {
        live: true,
        retry: true,
      })
        .on('change', function (info) {
          // handle change
        })
        .on('paused', function (err) {
          // replication paused (e.g. replication up to date, user went offline)
        })
        .on('active', function () {
          // replicate resumed (e.g. new changes replicating, user went back online)
        })
        .on('denied', function (err) {
          // a document failed to replicate (e.g. due to permissions)
        })
        .on('complete', function (info) {
          // handle complete
        })
        .on('error', function (err) {
          // handle error
        });
    }
  }
  syncWithRemoteCouchDB();
  //TODO should only make one instance of the database per user maybe use broadcast channel to send data to other tabs also
  //TODO Create a DB to sync with
  //TODO use a color library to generate and utilize different color palletes from background images for better contrast and visibility (light and dark variants at least).
  // cont: and or adjust opacity of elements for the same reasons.
  var TaskManager = {
    tasks: [],

    loadTasks: function () {
      return db.allDocs({ include_docs: true }).then(
        function (result) {
          this.tasks = result.rows.map(function (row) {
            return row.doc;
          });
          renderTasks();
        }.bind(this)
      );
    },

    saveTask: function (task) {
      return db.put(task).then(function (response) {
        task._rev = response.rev;
        renderTasks();
      });
    },

    addTask: function (task) {
      if (isDuplicate(task)) {
        // If the task is a duplicate, don't add it and just return
        console.log("Duplicate task not added");
        return;
      }

      task._id = "task_" + Date.now(); // Add this line to generate a unique _id for the task
      this.tasks.push(task);
      return this.saveTask(task);
    },

    updateTask: function (index, task) {
      this.tasks[index] = task;
      return this.saveTask(task);
    },

    deleteTask: function (index) {
      var task = this.tasks[index];
      return db.remove(task).then(
        function (response) {
          this.tasks.splice(index, 1);
          renderTasks();
        }.bind(this)
      );
    },

    getTask: function (index) {
      return this.tasks[index];
    },

    getAllTasks: function () {
      return this.tasks;
    },
  };

  // Load tasks from PouchDB on page load
  TaskManager.loadTasks().then(renderTasks);

  // Load existing tasks from local storage on page load
  // var tasks = TaskManager.tasks;

  // Render existing tasks in the list
  renderTasks();

  // Add a new task to the list
  $("form").on("submit", function (e) {
    e.preventDefault();
    var taskJIRA = $("#TaskJIRA").val().trim();
    var taskDescr = $("#TaskDescr").val().trim();
    var dueDate = $('input[type="date"]').val();
    if (taskDescr !== "") {
      var task = {
        JIRA: taskJIRA,
        name: taskDescr,
        completed: false,
        dueDate: dueDate,
        timerRunning: false, // Add this line
      };
      TaskManager.addTask(task);
      $("#TaskJIRA").val("");
      $("#TaskDescr").val("");
      $('input[type="date"]').val("");
      renderTasks();
    }
  });

  // Mark a task as completed
  $("ul").on("change", 'input[type="checkbox"]', function () {
    var index = $(this).closest("li").index();
    var task = TaskManager.getTask(index);
    task.completed = $(this).prop("checked");
    TaskManager.updateTask(index, task);
    renderTasks();
  });

  // Start stopwatch function when start button is pressed
$("ul").on("click", ".start", function () {
  var index = $(this).closest("li").index();
  var task = TaskManager.getTask(index);

  // If the timer is running, stop it
  if (task.timerRunning) {
    var elapsedTime = new Date().getTime() - task.startTime;
    task.elapsedTime = (task.elapsedTime || 0) + elapsedTime;
    task.timerRunning = false;
    task.startTime = null;
  }
  // If the timer is not running, start it
  else {
    task.startTime = new Date().getTime();
    task.timerRunning = true;
  }

  TaskManager.updateTask(index, task);
  renderTasks();
});


  // Edit a task in the list
  $("ul").on("click", ".edit", function () {
    var index = $(this).closest("li").index();
    var task = TaskManager.getTask(index);
    var newTaskName = prompt("Edit task name:", task.name);
    if (newTaskName && newTaskName.trim() !== "") {
      task.name = newTaskName;
      TaskManager.updateTask(index, task);
      renderTasks();
    }
  });

  // Delete a task from the list
  $("ul").on("click", ".delete", function () {
    var index = $(this).closest("li").index();
    TaskManager.deleteTask(index);
    renderTasks();
  });

  // Format time in hh:mm:ss
  function formatTime(milliseconds) {
    var totalSeconds = Math.floor(milliseconds / 1000);
    var hours = Math.floor(totalSeconds / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;
    return (
      hours.toString().padStart(2, "0") +
      ":" +
      minutes.toString().padStart(2, "0") +
      ":" +
      seconds.toString().padStart(2, "0")
    );
  }

  // Render tasks in the list
  function renderTasks() {
    $("ul").empty();
    for (var i = 0; i < TaskManager.tasks.length; i++) {
      var task = TaskManager.tasks[i];
      var li = $("<li>");
      var spanJira = $("<span>", { class: "JIRA", text: task.JIRA });
      var lineBreak = $("<br>", { class: "break" });
      var span = $("<span>", { class: "task", text: task.name });
      var startButton = $("<button>", {
        class: "start",
        text: task.timerRunning ? "X" : ">",
      });
      var editButton = $("<button>", { class: "edit", text: "Edit" });
      var deleteButton = $("<button>", { class: "delete", text: "Delete" });
      var checkbox = $("<input>", {
        type: "checkbox",
        checked: task.completed,
      });
      var dueDate = $("<span>", { class: "due-date", text: task.dueDate });
      var timer = $("<input>", {
        class: "timer",
        type: "text",
        value: task.elapsedTime ? formatTime(task.elapsedTime) : "00:00:00",
        readonly: true,
      });
      li.append(
        spanJira,
        lineBreak,
        span,
        startButton,
        editButton,
        deleteButton,
        checkbox,
        dueDate,
        timer
      );
      $("ul").append(li);
    }
    // syncWithRemoteCouchDB(); 

  }
    
  function exportTasksToTextFile() {
    var tasks = TaskManager.getAllTasks();
    var tasksText = tasks
      .map(function (task, index) {
        return (
          "Task " +
          (index + 1) +
          ": " +
          task.name +
          "\n" +
          "JIRA: " +
          task.JIRA +
          "\n" +
          "Due date: " +
          task.dueDate +
          "\n" +
          "Completed: " +
          (task.completed ? "Yes" : "No") +
          "\n" +
          "Elapsed time: " +
          (task.elapsedTime ? formatTime(task.elapsedTime) : "00:00:00") +
          "\n" +
          "----------------------------------------\n"
        );
      })
      .join("");

    var fileBlob = new Blob([tasksText], { type: "text/plain;charset=utf-8" });
    var downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(fileBlob);
    downloadLink.download =
      "tasks_" + new Date().toISOString().slice(0, 10) + ".txt";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }

  // The number of milliseconds in one week: 1000 ms * 60 sec * 60 min * 24 hours * 7 days
  var oneWeekInMilliseconds = 1000 * 60 * 60 * 24 * 7;
  setInterval(exportTasksToTextFile, oneWeekInMilliseconds);

  $("#export-button").on("click", function () {
    exportTasksToTextFile();
  });
});

//set up remote database via couchdb


// var data = {
//   "comment": "I did some work here.",
//   "visibility": {
//       "type": "group",
//       "value": "jira-developers"
//   },
//   "started": "2017-12-07T09:23:19.552+0000",
//   "timeSpentSeconds": 12000
// };
