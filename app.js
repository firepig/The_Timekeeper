$(document).ready(function () {
  // animate image transitions over the course o 13 seconds using css
  function timeCheck() {
    const timeRanges = [
      { start: 23, end: 3, image: "url(images/2.jpg)" },
      { start: 6, end: 9, image: "url(images/1.jpg)" },
      { start: 9, end: 12, image: "url(images/3.jpg)" },
      { start: 12, end: 15, image: "url(images/4.jpg)" },
      { start: 15, end: 18, image: "url(images/5.jpg)" },
      { start: 18, end: 21, image: "url(images/7.jpg)" },
      { start: 21, end: 23, image: "url(images/2.jpg)" }
    ];
  
    const currentTime = new Date().getHours();
    const range = timeRanges.find(r => {
      if (r.start > r.end) {
        // The range crosses midnight (e.g. 23 to 3)
        return currentTime >= r.start || currentTime < r.end;
      } else {
        // The range does not cross midnight
        return currentTime >= r.start && currentTime < r.end;
      }
    });
    
    $("body").css("background-image", range.image);
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
    var taskHours = parseInt($("#TaskHours").val().trim()) || 0;
    var taskMinutes = parseInt($("#TaskMinutes").val().trim()) || 0;
    var taskSeconds = parseInt($("#TaskSeconds").val().trim()) || 0;

    // Convert hours, minutes, and seconds to a string in hh:mm:ss format
    var taskEstimate = `${String(taskHours).padStart(2, '0')}:${String(taskMinutes).padStart(2, '0')}:${String(taskSeconds).padStart(2, '0')}`;

    if (taskDescr !== "") {
      var task = {
        JIRA: taskJIRA,
        name: taskDescr,
        completed: false,
        dueDate: dueDate,
        timerRunning: false,
        estimatedTime: taskEstimate  // Store the estimate as a string
      };
      TaskManager.addTask(task);       
      // clear fields 
      $("#TaskJIRA").val(""); 
      $("#TaskDescr").val("");
      $("#TaskHours").val(""); 
      $("#TaskMinutes").val(""); 
      $("#TaskSeconds").val(""); 
      $('input[type="date"]').val(""); 
      // render tasks
      renderTasks();
    }
  });
  // Mark a task as completed
  $("ul").on("change", 'input[type="checkbox"]', function () {
    var index = $(this).closest(".card").index();
    var task = TaskManager.getTask(index);
    if (task) {
      task.completed = $(this).prop("checked");
      TaskManager.updateTask(index, task);
      renderTasks();
    }
  });

  var timerIntervals = {};

  function parseTimeToSeconds(timeStr) {
    var parts = timeStr.split(":");
    if (parts.length === 3) {
      return (+parts[0]) * 3600 + (+parts[1]) * 60 + (+parts[2]);
    }
    return 0;
  }

  function updateTimerDisplay(taskId) {
    // Find the task by its _id
    const task = TaskManager.tasks.find(t => t._id === taskId);
    if (task && task.timerRunning) {
      const elapsedTime = new Date().getTime() - task.startTime + (task.elapsedTime || 0);
      // Find the card that has this taskId
      const $card = $("ul .card").filter(function () {
        return $(this).data("id") === taskId;
      });
      const $timer = $card.find(".timer");
      $timer.val(formatTime(elapsedTime));
    
      // Check if estimated time is exceeded
      if (task.estimatedTime) {
        const estimatedSeconds = parseTimeToSeconds(task.estimatedTime);
        const elapsedSeconds = Math.floor(elapsedTime / 1000);
        $timer.css("color", elapsedSeconds > estimatedSeconds ? "red" : "black");
      }
    }
  }
  
  
  // Start stopwatch function when start button is pressed
  $("ul").on("click", ".start", function () {
    const taskId = $(this).closest(".card").data("id");
    const task = TaskManager.tasks.find(t => t._id === taskId);
  
    // If the timer is running, stop it
    if (task.timerRunning) {
      var elapsedTime = new Date().getTime() - task.startTime;
      task.elapsedTime = (task.elapsedTime || 0) + elapsedTime;
      task.timerRunning = false;
      task.startTime = null;
      clearInterval(timerIntervals[taskId]);
      // Update only the timer display instead of re-rendering everything
      $(this).closest(".card").find(".timer").val(formatTime(task.elapsedTime));
    }
    // If the timer is not running, start it
    else {
      task.startTime = new Date().getTime();
      task.timerRunning = true;
      timerIntervals[taskId] = setInterval(function () {
        updateTimerDisplay(taskId);
      }, 1000); // Update every second
    }
  
    TaskManager.updateTask(taskId, task);
    // Optionally update only the affected task's DOM, rather than calling renderTasks()
  });

  // Edit a task in the list
  $("ul").on("click", ".edit", function () {
    const taskId = $(this).closest(".card").data("id");
    const index = TaskManager.tasks.findIndex(t => t._id === taskId);
    const task = TaskManager.tasks[index];
    const newTaskName = prompt("Edit task name:", task.name);
    if (newTaskName && newTaskName.trim() !== "") {
      task.name = newTaskName;
      TaskManager.updateTask(index, task);
      renderTasks();
    }
  });

  // Delete a task from the list
  $("ul").on("click", ".delete", function () {
    const taskId = $(this).closest(".card").data("id");
    const index = TaskManager.tasks.findIndex(t => t._id === taskId);
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
    TaskManager.tasks.forEach(task => {
      const card = $("<div>", { class: "card mb-3", "data-id": task._id });
      
      // Create card header for the task JIRA
      var cardHeader = $("<div>", { 
        class: "card-header", 
        text: task.JIRA 
      });
      
      // Create a Bootstrap row inside the card
      var row = $("<div>", { class: "row g-0" });
      
      // Left column for an image (using a placeholder; hide if not needed)
      var colImg = $("<div>", { class: "col-md-4 d-none" });
      var img = $("<img>", { 
        src: "placeholder.jpg", 
        class: "img-fluid rounded-start", 
        alt: "Task image" 
      });
      colImg.append(img);
      
      // Right column for card content
      var colBody = $("<div>", { class: "col" });
      
      // Card body for primary info
      var cardBody = $("<div>", { class: "card-body" });
      
      // Checkbox container for marking task as completed
      var checkboxContainer = $("<div>", { class: "form-check mb-2" });
      var checkboxId = "taskCheckbox_" + task._id;
      var checkbox = $("<input>", {
        type: "checkbox",
        checked: task.completed,
        class: "form-check-input",
        id: checkboxId
      });
      var checkboxLabel = $("<label>", {
        class: "form-check-label",
        for: checkboxId,
        text: "Completed"
      });
      checkboxContainer.append(checkbox, checkboxLabel);
      
      // Description: task description (from task.name)
      var descriptionText = $("<p>", { 
        class: "card-text", 
        text: "Description: " + task.name 
      });
      
      // Extra info: due date and estimated time
      var extraInfo = $("<p>", { class: "card-text" });
      var smallText = $("<small>", { 
        class: "text-body-secondary", 
        html: "Due: " + task.dueDate + " | " +
              (task.estimatedTime ? "Est: " + task.estimatedTime : "No estimate")
      });
      extraInfo.append(smallText);
      
      // Append primary info to card body
      cardBody.append( descriptionText, extraInfo, checkboxContainer);
      
      // Create card footer for interactive elements
      var cardFooter = $("<div>", { 
        class: "card-footer d-flex justify-content-end align-items-center" 
      });
      
      // Container for start button and timer display
      var startTimerContainer = $("<div>", { class: "d-flex align-items-center", style: "margin-right:auto" });
      var startButton = $("<button>", {
        class: "start btn btn-primary",
        text: task.timerRunning ? "Stop" : "Start"
      });
      var timerInput = $("<input>", {
        class: "timer ml-2",
        type: "text",
        value: task.elapsedTime ? formatTime(task.elapsedTime) : "00:00:00",
        readonly: true,
        style: "width:100px;"
      });
      startTimerContainer.append(startButton, timerInput);
      
      // Action buttons for edit and delete
      var editButton = $("<button>", {
        class: "edit btn btn-outline-primary mr-2",
        text: "Edit"
      });
      var deleteButton = $("<button>", {
        class: "delete btn btn-outline-secondary",
        text: "Delete",
        style: "margin-right:.5em;"
      });
      
      // Append interactive elements to card footer
      cardFooter.append(startTimerContainer, deleteButton, editButton);
      
      // Append card header, card body, and footer to right column
      colBody.append(cardHeader, cardBody, cardFooter);
      
      // Assemble the row and card
      row.append(colImg, colBody);
      card.append(row);
      
      // Append the card to the container (assuming <ul> is your container)
      $("ul").append(card);
    });
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
