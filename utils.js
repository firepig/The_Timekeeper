export function parseTimeToSeconds(timeStr) {
  const parts = timeStr.split(":");
  if (parts.length === 3) {
    return (+parts[0]) * 3600 + (+parts[1]) * 60 + (+parts[2]);
  }
  return 0;
}

export function formatTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return (
    hours.toString().padStart(2, "0") +
    ":" +
    minutes.toString().padStart(2, "0") +
    ":" +
    seconds.toString().padStart(2, "0")
  );
}