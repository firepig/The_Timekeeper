$(document).ready(function () {
  // Define the API base URL with the correct port
  var API_BASE_URL = "http://localhost:3000";

  var localDB = new PouchDB('timekeeper');

  // Animate background image transitions
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
    const range = timeRanges.find(r =>
      (r.start > r.end)
        ? (currentTime >= r.start || currentTime < r.end)
        : (currentTime >= r.start && currentTime < r.end)
    );

    if (range) {
      $("body").css("background-image", range.image);
      console.log("timechecked-background applied");
    } else {
      console.warn("No matching time range found for current hour:", currentTime);
    }
  }
  timeCheck();
  setInterval(timeCheck, 600000);

  // Check for duplicate tasks based on JIRA, name, and due date
  function isDuplicate(newTask) {
    return TaskManager.tasks.some(task =>
      task.JIRA === newTask.JIRA &&
      task.name === newTask.name &&
      task.dueDate === newTask.dueDate
    );
  }

  // TaskManager using AJAX calls to your Node proxy
  var TaskManager = {
    tasks: [],

    loadTasks: function () {
      return $.ajax({
        url: API_BASE_URL + '/api/tasks',
        method: 'GET',
        dataType: 'json'
      }).then(function (tasks) {
        TaskManager.tasks = tasks;
        renderTasks();
      }).fail(function (err) {
        console.error("Error loading tasks:", err);
      });
    },

    addTask: function (task) {
      if (isDuplicate(task)) {
        console.log("Duplicate task not added");
        return;
      }
      return $.ajax({
        url: API_BASE_URL + '/api/tasks',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(task)
      }).then(function (response) {
        // Reload tasks after adding a new one
        return TaskManager.loadTasks();
      }).fail(function (err) {
        console.error("Error adding task:", err);
      });
    },

    updateTask: function (task) {
      return $.ajax({
        url: API_BASE_URL + '/api/tasks/' + task._id,
        method: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify(task)
      }).then(function (response) {
        // Reload tasks after updating
        return TaskManager.loadTasks();
      }).fail(function (err) {
        console.error("Error updating task:", err);
      });
    },

    deleteTask: function (task) {
      // CouchDB deletion requires the _rev parameter
      return $.ajax({
        url: API_BASE_URL + '/api/tasks/' + task._id + '?rev=' + task._rev,
        method: 'DELETE',
        dataType: 'json'
      }).then(function (response) {
        // Reload tasks after deletion
        return TaskManager.loadTasks();
      }).fail(function (err) {
        console.error("Error deleting task:", err);
      });
    },

    getTask: function (index) {
      return this.tasks[index];
    },

    getAllTasks: function () {
      return this.tasks;
    }
  };

  // Initial load of tasks from the server
  TaskManager.loadTasks();

  // Render tasks in the list
  function renderTasks() {
    $("ul").empty();
    TaskManager.tasks.forEach(task => {
      const card = $("<div>", { class: "card mb-3", "data-id": task._id });

      // Card header for the task JIRA
      const cardHeader = $("<div>", {
        class: "card-header",
        text: task.JIRA
      });

      // Bootstrap row setup
      const row = $("<div>", { class: "row g-0" });
      const colImg = $("<div>", {
        class: task.image ? "col-md-4 d-flex align-items-center" : "col-md-4",
        style: task.image ? "" : "display: none;"
      });
      const img = $("<img>", {
        src: task.image || "",
        class: "img-fluid rounded-start",
        alt: "Task image"
      });
      colImg.append(img);

      const colBody = $("<div>", { class: "col d-flex flex-column" });
      const cardBody = $("<div>", { class: "card-body" });

      // Task description
      const descriptionText = $("<p>", {
        class: "card-text",
        text: "Description: " + task.name
      });

      // Extra info: Due date and estimated time
      const extraInfo = $("<p>", { class: "card-text" });
      const smallText = $("<small>", {
        class: "text-body-secondary",
        html: "Due: " + task.dueDate + " | " +
          (task.estimatedTime ? "Est: " + task.estimatedTime : "No estimate")
      });
      extraInfo.append(smallText);

      // Append header, description, and extra info
      cardBody.append(descriptionText, extraInfo);

      // If an estimated time is provided, add a donut chart container
      if (task.estimatedTime) {
        const chartContainer = $("<div>", {
          class: "donut-chart-container d-inline-block",
          style: "width: 25px; height: 25px; margin-left: 10px; transform: translate(0px, .45em);opacity:.7;"
        });
        const chartCanvas = $("<canvas>", {
          id: "chart-" + task._id,
          width: 100,
          height: 100
        });
        chartContainer.append(chartCanvas);
        extraInfo.append(chartContainer);
      }

      // Checkbox container for marking task completion
      const checkboxContainer = $("<div>", { class: "form-check mb-2" });
      const checkboxId = "taskCheckbox_" + task._id;
      const checkbox = $("<input>", {
        type: "checkbox",
        checked: task.completed,
        class: "form-check-input",
        id: checkboxId
      });
      const checkboxLabel = $("<label>", {
        class: "form-check-label",
        for: checkboxId,
        text: "Completed"
      });
      checkboxContainer.append(checkbox, checkboxLabel);
      cardBody.append(checkboxContainer);

      // Card footer with timer and action buttons
      const cardFooter = $("<div>", {
        class: "card-footer d-flex justify-content-end align-items-center"
      });
      const startTimerContainer = $("<div>", {
        class: "d-flex align-items-center",
        style: "margin-right:auto"
      });
      const startButton = $("<button>", {
        class: "start btn btn-primary",
        text: task.timerRunning ? "Stop" : "Start"
      });
      const timerInput = $("<input>", {
        class: "timer ml-2",
        type: "text",
        value: task.elapsedTime ? formatTime(task.elapsedTime) : "00:00:00",
        readonly: true,
        style: "width:100px;"
      });
      startTimerContainer.append(startButton, timerInput);

      const editButton = $("<button>", {
        class: "edit btn btn-outline-primary mr-2",
        text: "Edit"
      });
      const deleteButton = $("<button>", {
        class: "delete btn btn-outline-secondary",
        text: "Delete",
        style: "margin-right:.5em;"
      });
      cardFooter.append(startTimerContainer, deleteButton, editButton);

      // Assemble the card and append to the list
      colBody.append(cardHeader, cardBody, cardFooter);
      row.append(colImg, colBody);
      card.append(row);
      $("ul").append(card);

      // Create donut chart for tasks with an estimated time (Chart.js must be loaded)
      if (task.estimatedTime) {
        const estimatedSeconds = parseTimeToSeconds(task.estimatedTime);
        const elapsedSeconds = task.elapsedTime ? Math.floor(task.elapsedTime / 1000) : 0;
        const percentComplete = estimatedSeconds > 0 ? Math.min((elapsedSeconds / estimatedSeconds) * 100, 100) : 0;

        let completedColor;
        if (elapsedSeconds > estimatedSeconds) {
          completedColor = 'rgba(255, 99, 132, 1)';
        } else if (percentComplete >= 65) {
          completedColor = 'rgba(255, 205, 86, 1)';
        } else {
          completedColor = 'rgba(75, 192, 192, 1)';
        }

        const donutData = {
          labels: ['Completed', 'Remaining'],
          datasets: [{
            data: [percentComplete, 100 - percentComplete],
            backgroundColor: [
              completedColor,
              'rgba(220, 220, 220, 1)'
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

        const ctx = document.getElementById("chart-" + task._id).getContext("2d");
        new Chart(ctx, config);
      }
    });
  }

  function parseTimeToSeconds(timeStr) {
    var parts = timeStr.split(":");
    if (parts.length === 3) {
      return (+parts[0]) * 3600 + (+parts[1]) * 60 + (+parts[2]);
    }
    return 0;
  }

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

  // Event handlers

  $("form").on("submit", function (e) {
    e.preventDefault();
    var taskJIRA = $("#TaskJIRA").val().trim();
    var taskDescr = $("#TaskDescr").val().trim();
    var dueDate = $('input[type="date"]').val();
    var taskHours = parseInt($("#TaskHours").val().trim()) || 0;
    var taskMinutes = parseInt($("#TaskMinutes").val().trim()) || 0;
    var taskSeconds = parseInt($("#TaskSeconds").val().trim()) || 0;
    var taskImage = $("#TaskImage")[0].files[0];

    var taskEstimate = `${String(taskHours).padStart(2, '0')}:${String(taskMinutes).padStart(2, '0')}:${String(taskSeconds).padStart(2, '0')}`;

    if (taskDescr !== "") {
      var task = {
        JIRA: taskJIRA,
        name: taskDescr,
        completed: false,
        dueDate: dueDate,
        timerRunning: false,
        estimatedTime: taskEstimate,
        image: null
      };

      if (taskImage) {
        var reader = new FileReader();
        reader.onload = function (e) {
          task.image = e.target.result;
          TaskManager.addTask(task);
        };
        reader.readAsDataURL(taskImage);
      } else {
        TaskManager.addTask(task);
      }

      $("#TaskJIRA").val("");
      $("#TaskDescr").val("");
      $("#TaskHours").val("");
      $("#TaskMinutes").val("");
      $("#TaskSeconds").val("");
      $('input[type="date"]').val("");
      $("#TaskImage").val("");
    }
  });

  $("ul").on("change", 'input[type="checkbox"]', function () {
    var index = $(this).closest(".card").index();
    var task = TaskManager.getTask(index);
    if (task) {
      task.completed = $(this).prop("checked");
      TaskManager.updateTask(task);
    }
  });

  var timerIntervals = {};

  function updateTimerDisplay(taskId) {
    const task = TaskManager.tasks.find(t => t._id === taskId);
    if (task && task.timerRunning) {
      const elapsedTime = new Date().getTime() - task.startTime + (task.elapsedTime || 0);
      const $card = $("ul .card").filter(function () {
        return $(this).data("id") === taskId;
      });
      const $timer = $card.find(".timer");
      $timer.val(formatTime(elapsedTime));

      if (task.estimatedTime) {
        const estimatedSeconds = parseTimeToSeconds(task.estimatedTime);
        const elapsedSeconds = Math.floor(elapsedTime / 1000);
        $timer.css("color", elapsedSeconds > estimatedSeconds ? "red" : "green");
      }
    }
  }

  $("ul").on("click", ".start", function () {
    const taskId = $(this).closest(".card").data("id");
    const task = TaskManager.tasks.find(t => t._id === taskId);

    if (task.timerRunning) {
      var elapsedTime = new Date().getTime() - task.startTime;
      task.elapsedTime = (task.elapsedTime || 0) + elapsedTime;
      task.timerRunning = false;
      task.startTime = null;
      clearInterval(timerIntervals[taskId]);
      $(this).closest(".card").find(".timer").val(formatTime(task.elapsedTime));
      $(this).text("Start");
    } else {
      task.startTime = new Date().getTime();
      task.timerRunning = true;
      timerIntervals[taskId] = setInterval(function () {
        updateTimerDisplay(taskId);
      }, 1000);
      $(this).text("Stop");
    }

    TaskManager.updateTask(task);
  });

  $("ul").on("click", ".edit", function () {
    const taskId = $(this).closest(".card").data("id");
    const index = TaskManager.tasks.findIndex(t => t._id === taskId);
    const task = TaskManager.tasks[index];
    const newTaskName = prompt("Edit task name:", task.name);
    if (newTaskName && newTaskName.trim() !== "") {
      task.name = newTaskName;
      TaskManager.updateTask(task);
    }
  });

  $("ul").on("click", ".delete", function () {
    const taskId = $(this).closest(".card").data("id");
    const index = TaskManager.tasks.findIndex(t => t._id === taskId);
    const task = TaskManager.tasks[index];
    if (task) {
      TaskManager.deleteTask(task);
    }
  });

  function exportTasksToTextFile() {
    var tasks = TaskManager.getAllTasks();
    var tasksText = tasks
      .map(function (task, index) {
        return (
          "Task " +
          (index + 1) +
          ": " + task.name + "\n" +
          "JIRA: " + task.JIRA + "\n" +
          "Due date: " + task.dueDate + "\n" +
          "Completed: " + (task.completed ? "Yes" : "No") + "\n" +
          "Elapsed time: " + (task.elapsedTime ? formatTime(task.elapsedTime) : "00:00:00") + "\n" +
          "----------------------------------------\n"
        );
      })
      .join("");

    var fileBlob = new Blob([tasksText], { type: "text/plain;charset=utf-8" });
    var downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(fileBlob);
    downloadLink.download = "tasks_" + new Date().toISOString().slice(0, 10) + ".txt";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }

  var oneWeekInMilliseconds = 1000 * 60 * 60 * 24 * 7;
  setInterval(exportTasksToTextFile, oneWeekInMilliseconds);

  $("#export-button").on("click", function () {
    exportTasksToTextFile();
  });
});
