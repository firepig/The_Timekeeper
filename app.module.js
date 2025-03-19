import $ from 'jquery';
import PouchDB from 'pouchdb';
import { TaskManager } from './taskManager';
import { timeCheck } from './timeCheck';

$(document).ready(function () {
  // Initialize TaskManager
  TaskManager.loadTasks().then(renderTasks);

  // Time check for background image
  timeCheck();
  setInterval(timeCheck, 600000);

  // Form submission for adding new tasks
  $("form").on("submit", function (e) {
    e.preventDefault();
    var taskJIRA = $("#TaskJIRA").val().trim();
    var taskDescr = $("#TaskDescr").val().trim();
    var dueDate = $('input[type="date"]').val();
    var taskHours = parseInt($("#TaskHours").val().trim()) || 0;
    var taskMinutes = parseInt($("#TaskMinutes").val().trim()) || 0;
    var taskSeconds = parseInt($("#TaskSeconds").val().trim()) || 0;

    var taskEstimate = `${String(taskHours).padStart(2, '0')}:${String(taskMinutes).padStart(2, '0')}:${String(taskSeconds).padStart(2, '0')}`;

    if (taskDescr !== "") {
      var task = {
        JIRA: taskJIRA,
        name: taskDescr,
        completed: false,
        dueDate: dueDate,
        timerRunning: false,
        estimatedTime: taskEstimate
      };
      TaskManager.addTask(task);
      $("#TaskJIRA").val("");
      $("#TaskDescr").val("");
      $("#TaskHours").val("");
      $("#TaskMinutes").val("");
      $("#TaskSeconds").val("");
      $('input[type="date"]').val("");
      renderTasks();
    }
  });

  // Event listeners for task actions
  $("ul").on("change", 'input[type="checkbox"]', function () {
    var index = $(this).closest(".card").index();
    var task = TaskManager.getTask(index);
    if (task) {
      task.completed = $(this).prop("checked");
      TaskManager.updateTask(index, task);
      renderTasks();
    }
  });

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
      updateTaskChart(taskId);
      $(this).text("Start");
    } else {
      task.startTime = new Date().getTime();
      task.timerRunning = true;
      timerIntervals[taskId] = setInterval(function () {
        updateTimerDisplay(taskId);
      }, 1000);
      $(this).text("Stop");
    }

    TaskManager.updateTask(taskId, task);
  });

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

  $("ul").on("click", ".delete", function () {
    const taskId = $(this).closest(".card").data("id");
    const index = TaskManager.tasks.findIndex(t => t._id === taskId);
    TaskManager.deleteTask(index);
    renderTasks();
  });

  $("#export-button").on("click", function () {
    exportTasksToTextFile();
  });
});