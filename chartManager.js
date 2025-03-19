import { parseTimeToSeconds } from './utils.js';

const chartInstances = {};

export function createChart(task) {
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
  chartInstances[task._id] = new Chart(ctx, config);

  if (task.timerRunning) {
    updateTaskChart(task._id);
  }
}

export function updateTaskChart(taskId) {
  const task = TaskManager.tasks.find(t => t._id === taskId);
  if (!task || !task.estimatedTime || !chartInstances[taskId]) return;

  const estimatedSeconds = parseTimeToSeconds(task.estimatedTime);
  const currentElapsedTime = task.timerRunning ? 
    new Date().getTime() - task.startTime + (task.elapsedTime || 0) : 
    (task.elapsedTime || 0);
  const elapsedSeconds = Math.floor(currentElapsedTime / 1000);
  const percentComplete = estimatedSeconds > 0 ? 
    Math.min((elapsedSeconds / estimatedSeconds) * 100, 100) : 0;

  let completedColor;
  if (elapsedSeconds > estimatedSeconds) {
    completedColor = 'rgba(255, 99, 132, 1)';
  } else if (percentComplete >= 65) {
    completedColor = 'rgba(255, 205, 86, 1)';
  } else {
    completedColor = 'rgba(75, 192, 192, 1)';
  }

  chartInstances[taskId].data.datasets[0].data = [percentComplete, 100 - percentComplete];
  chartInstances[taskId].data.datasets[0].backgroundColor[0] = completedColor;
  chartInstances[taskId].update();
}