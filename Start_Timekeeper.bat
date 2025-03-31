@echo off
echo Starting YouveBeenServed server...
start cmd /k "cd YouveBeenServed && node server.js"

echo Starting main app server...
start cmd /k "node server.js"

echo Both servers have been started.