$(document).ready(function () {
  var TaskManager = {
    tasks: JSON.parse(localStorage.getItem("tasks")) || [],

    saveTasks: function () {
      localStorage.setItem("tasks", JSON.stringify(this.tasks));
    },

    addTask: function (task) {
      this.tasks.push(task);
      this.saveTasks();
    },

    updateTask: function (index, task) {
      this.tasks[index] = task;
      this.saveTasks();
    },

    deleteTask: function (index) {
      this.tasks.splice(index, 1);
      this.saveTasks();
    },

    getTask: function (index) {
      return this.tasks[index];
    },

    getAllTasks: function () {
      return this.tasks;
    },
  };

  
  // Load existing tasks from local storage on page load
  var tasks = TaskManager.tasks;

  // Render existing tasks in the list
  renderTasks();

  // Add a new task to the list
  $("form").on("submit", function (e) {
    e.preventDefault();
    var taskName = $('input[type="text"]').val().trim();
    var dueDate = $('input[type="date"]').val();
    if (taskName !== "") {
      var task = { name: taskName, completed: false, dueDate: dueDate };
      TaskManager.addTask(task);
      $('input[type="text"]').val("");
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
    if (!task.startTime) {
      task.startTime = new Date().getTime();
      TaskManager.updateTask(index, task);
      $(this).text("Stop");
    } else {
      var elapsedTime = new Date().getTime() - task.startTime;
      task.elapsedTime = (task.elapsedTime || 0) + elapsedTime;
      TaskManager.updateTask(index, task);
      $(this).text(">");
      $(this).siblings(".timer").val(formatTime(task.elapsedTime));
      task.startTime = null;
    }
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
    return hours.toString().padStart(2, '0') + ':' +
           minutes.toString().padStart(2, '0') + ':' +
           seconds.toString().padStart(2, '0');
  }

  // Render tasks in the list
  function renderTasks() {
    $('ul').empty();
    for (var i = 0; i < tasks.length; i++) {
      var task = tasks[i];
      var li = $('<li>');
      var span = $('<span>', { class: 'task', text: task.name });
      var startButton = $('<button>', { class: 'start', text: (task.startTime && !task.completed) ? 'Stop' : '>' });
      var editButton = $('<button>', { class: 'edit', text: 'Edit' });
      var deleteButton = $('<button>', { class: 'delete', text: 'Delete' });
      var checkbox = $('<input>', { type: 'checkbox', checked: task.completed });
      var dueDate = $('<span>', { class: 'due-date', text: task.dueDate });
      var timer = $('<input>', { class: 'timer', type: 'text',
        value: task.elapsedTime ? formatTime(task.elapsedTime) : '00:00:00',
        readonly: true
      });
      li.append(span, startButton, editButton, deleteButton, checkbox, dueDate, timer);
      $('ul').append(li);
    }
  }

  function exportTasksToTextFile() {
    var tasks = TaskManager.getAllTasks();
    var tasksText = tasks.map(function (task, index) {
      return (
        "Task " + (index + 1) + ": " + task.name + "\n" +
        "Due date: " + task.dueDate + "\n" +
        "Completed: " + (task.completed ? "Yes" : "No") + "\n" +
        "Elapsed time: " + (task.elapsedTime ? formatTime(task.elapsedTime) : "00:00:00") + "\n" +
        "----------------------------------------\n"
      );
    }).join('');
  
    var fileBlob = new Blob([tasksText], { type: 'text/plain;charset=utf-8' });
    var downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(fileBlob);
    downloadLink.download = 'tasks_' + new Date().toISOString().slice(0, 10) + '.txt';
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

