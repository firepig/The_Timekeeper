$(document).ready(function () {
  // animate image transitions over the course o 13 seconds using css
  function timeCheck() {
    // Refactor: Use more descriptive variable names
    // Refactor: Consider using const for timeRanges since it doesn't change
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
    // Refactor: Simplify the find logic
    const range = timeRanges.find(r =>
      (r.start > r.end)
        ? (currentTime >= r.start || currentTime < r.end)
        : (currentTime >= r.start && currentTime < r.end)
    );

    //Improvement: Add a check if range is found
    if (range) {
      $("body").css("background-image", range.image);
      console.log("timechecked-background applied");
    } else {
      console.warn("No matching time range found for current hour:", currentTime);
    }
  }
  timeCheck();
  setInterval(timeCheck, 600000);

  function isDuplicate(newTask) {
    // Refactor: Use more explicit return
    return TaskManager.tasks.some(task =>
      task.JIRA === newTask.JIRA &&
      task.name === newTask.name &&
      task.dueDate === newTask.dueDate
    );
  }

  // Create a new PouchDB instance
  var db = new PouchDB("my_database");
  var remoteCouchDB = "http://" + COUCHDB_USERNAME + ":" + COUCHDB_PASSWORD + "@" +
  COUCHDB_HOST + ":" + COUCHDB_PORT + "/" + COUCHDB_DB;

// Function to start live sync after the initial replication is done.
function syncWithRemoteCouchDB() {
  if (remoteCouchDB) {
    db.sync(remoteCouchDB, {
      live: true,
      retry: true,
    })
      .on('change', function (info) {
        // handle change if needed
      })
      .on('paused', function (err) {
        // replication paused (up-to-date or offline)
      })
      .on('active', function () {
        // replication resumed
      })
      .on('denied', function (err) {
        // document failed to replicate (permissions issue)
      })
      .on('complete', function (info) {
        // live sync started (this event may not fire with live:true)
      })
      .on('error', function (err) {
        console.error("Error during CouchDB sync:", err);
      });
  }
}

// Instead of loading tasks immediately, do initial replication first.
function initialReplication() {
  return db.replicate.from(remoteCouchDB, { live: false });
}

// Show a loading indicator here
function showLoadingIndicator() {
  // $("#loading").show();
}
function hideLoadingIndicator() {
  // $("#loading").hide();
}

// Start initial replication and then load tasks
showLoadingIndicator();
initialReplication()
  .then(function (info) {
    console.log("Initial replication complete:", info);
    // Load tasks only after initial replication is complete.
    return TaskManager.loadTasks();
  })
  .then(function () {
    renderTasks();
    hideLoadingIndicator();
    // Now start live sync for continuous updates.
    syncWithRemoteCouchDB();
  })
  .catch(function (err) {
    console.error("Error during initial replication:", err);
    // Even if there's an error, try to load tasks and start live sync.
    TaskManager.loadTasks().then(renderTasks);
    hideLoadingIndicator();
    syncWithRemoteCouchDB();
  });

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
      ).catch(err => console.error("Error loading tasks:", err)); //Improvement: Catch errors
    },

    saveTask: function (task) {
      return db.put(task).then(function (response) {
        task._rev = response.rev;
        renderTasks();
      }).catch(err => console.error("Error saving task:", err)); //Improvement: Catch errors
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
      ).catch(err => console.error("Error deleting task:", err)); //Improvement: Catch errors
    },

    getTask: function (index) {
      return this.tasks[index];
    },

    getAllTasks: function () {
      return this.tasks;
    },
  };

  // Load tasks from PouchDB on page load
  // TaskManager.loadTasks().then(renderTasks);

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
    var taskImage = $("#TaskImage")[0].files[0]; // Get the image file
  
    // Convert hours, minutes, and seconds to a string in hh:mm:ss format
    var taskEstimate = `${String(taskHours).padStart(2, '0')}:${String(taskMinutes).padStart(2, '0')}:${String(taskSeconds).padStart(2, '0')}`;
  
    if (taskDescr !== "") {
      var task = {
        JIRA: taskJIRA,
        name: taskDescr,
        completed: false,
        dueDate: dueDate,
        timerRunning: false,
        estimatedTime: taskEstimate,
        image: null // Initialize image as null
      };
  
      if (taskImage) {
        var reader = new FileReader();
        reader.onload = function (e) {
          task.image = e.target.result; // Store the Base64 string
          TaskManager.addTask(task);
          renderTasks();
        };
        reader.readAsDataURL(taskImage); // Convert image to Base64 string
      } else {
        TaskManager.addTask(task);
        renderTasks();
      }
  
      // Clear fields
      $("#TaskJIRA").val("");
      $("#TaskDescr").val("");
      $("#TaskHours").val("");
      $("#TaskMinutes").val("");
      $("#TaskSeconds").val("");
      $('input[type="date"]').val("");
      $("#TaskImage").val(""); // Clear the image input
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
  var chartInstances = {}; // Store chart instances for updating

  function parseTimeToSeconds(timeStr) {
    var parts = timeStr.split(":");
    if (parts.length === 3) {
      return (+parts[0]) * 3600 + (+parts[1]) * 60 + (+parts[2]);
    }
    return 0;
  }

  // Add function to update a task's chart
  function updateTaskChart(taskId) {
    const task = TaskManager.tasks.find(t => t._id === taskId);
    if (!task || !task.estimatedTime || !chartInstances[taskId]) return;

    const estimatedSeconds = parseTimeToSeconds(task.estimatedTime);
    // Calculate current elapsed time based on startTime and previously accumulated time
    const currentElapsedTime = task.timerRunning ? 
      new Date().getTime() - task.startTime + (task.elapsedTime || 0) : 
      (task.elapsedTime || 0);
    const elapsedSeconds = Math.floor(currentElapsedTime / 1000);
    const percentComplete = estimatedSeconds > 0 ? 
      Math.min((elapsedSeconds / estimatedSeconds) * 100, 100) : 0;

    // Determine the color based on progress
    let completedColor;
    if (elapsedSeconds > estimatedSeconds) {
      completedColor = 'rgba(255, 99, 132, 1)';  // Red: Out of time
    } else if (percentComplete >= 65) {
      completedColor = 'rgba(255, 205, 86, 1)';  // Yellow: Warning (>=65%)
    } else {
      completedColor = 'rgba(75, 192, 192, 1)';   // Default color for 0-65%
    }

    // Update the chart data
    chartInstances[taskId].data.datasets[0].data = [percentComplete, 100 - percentComplete];
    chartInstances[taskId].data.datasets[0].backgroundColor[0] = completedColor;
    chartInstances[taskId].update();
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
        $timer.css("color", elapsedSeconds > estimatedSeconds ? "red" : "green");
        
        // Update the chart every 3 seconds to avoid excessive updates
        if (elapsedTime % 3000 < 1000) {
          updateTaskChart(taskId);
        }
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
      
      // Update the chart one last time when stopping
      updateTaskChart(taskId);
      $(this).text("Start");
    }
    // If the timer is not running, start it
    else {
      task.startTime = new Date().getTime();
      task.timerRunning = true;
      timerIntervals[taskId] = setInterval(function () {
        updateTimerDisplay(taskId);
      }, 1000); // Update every second
      $(this).text("Stop");
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
  
      // Card header for the task JIRA
      var cardHeader = $("<div>", {
        class: "card-header",
        text: task.JIRA
      });
  
      // Bootstrap row setup
      var row = $("<div>", { class: "row g-0" });
      var colImg = $("<div>", { 
        class: task.image ? "col-md-4 d-flex align-items-center" : "col-md-4", 
        style: task.image ? "" : "display: none;" 
      });
      var img = $("<img>", {
        src: task.image || "", // Use the Base64 string or a placeholder
        class: "img-fluid rounded-start",
        alt: "Task image"
      });
      colImg.append(img);
  
      var colBody = $("<div>", { class: "col d-flex flex-column" });
      var cardBody = $("<div>", { class: "card-body" });
  
      // Task description
      var descriptionText = $("<p>", {
        class: "card-text",
        text: "Description: " + task.name
      });
  
      // Extra info: Due date and estimated time
      var extraInfo = $("<p>", { class: "card-text" });
      var smallText = $("<small>", {
        class: "text-body-secondary",
        html: "Due: " + task.dueDate + " | " +
          (task.estimatedTime ? "Est: " + task.estimatedTime : "No estimate")
      });
      extraInfo.append(smallText);
  
      // Append description and extra info to card body
      cardBody.append(descriptionText, extraInfo);
  
      // If the task has an estimated time, insert the donut chart right after the estimate.
      if (task.estimatedTime) {
        var chartContainer = $("<div>", {
          class: "donut-chart-container d-inline-block",
          style: "width: 25px; height: 25px; margin-left: 10px; transform: translate(0px, .45em);opacity:.7;"
        });
        var chartCanvas = $("<canvas>", {
          id: "chart-" + task._id,
          width: 100,
          height: 100
        });
        chartContainer.append(chartCanvas);
        extraInfo.append(chartContainer);
      }
  
      // Checkbox container
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
  
      // Append checkbox container after chart
      cardBody.append(checkboxContainer);
  
      // Card footer with timer and buttons
      var cardFooter = $("<div>", {
        class: "card-footer d-flex justify-content-end align-items-center"
      });
      var startTimerContainer = $("<div>", {
        class: "d-flex align-items-center",
        style: "margin-right:auto"
      });
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
  
      var editButton = $("<button>", {
        class: "edit btn btn-outline-primary mr-2",
        text: "Edit"
      });
      var deleteButton = $("<button>", {
        class: "delete btn btn-outline-secondary",
        text: "Delete",
        style: "margin-right:.5em;"
      });
      cardFooter.append(startTimerContainer, deleteButton, editButton);
  
      // Assemble the card
      colBody.append(cardHeader, cardBody, cardFooter);
      row.append(colImg, colBody);
      card.append(row);
      $("ul").append(card);
  
      // If the task has an estimated time, create the donut chart
      if (task.estimatedTime) {
        const estimatedSeconds = parseTimeToSeconds(task.estimatedTime);
        const elapsedSeconds = task.elapsedTime ? Math.floor(task.elapsedTime / 1000) : 0;
        const percentComplete = estimatedSeconds > 0 ? Math.min((elapsedSeconds / estimatedSeconds) * 100, 100) : 0;
  
        // Determine the completed portion's color based on progress
        let completedColor;
        if (elapsedSeconds > estimatedSeconds) {
          completedColor = 'rgba(255, 99, 132, 1)';  // Red: Out of time
        } else if (percentComplete >= 65) {
          completedColor = 'rgba(255, 205, 86, 1)';  // Yellow: Warning (>=65%)
        } else {
          completedColor = 'rgba(75, 192, 192, 1)';   // Default color for 0-65%
        }
  
        const donutData = {
          labels: ['Completed', 'Remaining'],
          datasets: [{
            data: [percentComplete, 100 - percentComplete],
            backgroundColor: [
              completedColor,
              'rgba(220, 220, 220, 1)'  // Grey for the remaining portion
            ],
            borderWidth: 0,
          }]
        };
  
        const config = {
          type: 'doughnut',
          data: donutData,
          options: {
            responsive: true,
            plugins: {
              legend: { display: false },
              title: { display: false },
              tooltip: { enabled: false }
            },
            cutout: '70%'
          },
        };
  
        // Instantiate the chart for this task and store it in chartInstances
        var ctx = document.getElementById("chart-" + task._id).getContext("2d");
        chartInstances[task._id] = new Chart(ctx, config);
        
        // If timer is running, set up chart updating immediately
        if (task.timerRunning) {
          updateTaskChart(task._id);
        }
      }
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
