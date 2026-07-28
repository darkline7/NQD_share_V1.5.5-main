@echo off
setlocal

if not exist "node_modules" (
    echo "No required modules found, starting module installation process..."
    npm install
) else (
    echo "Starting Bot Zalo D Q T - V1.5.0 Developed by N Q D x N D Q"
)

npm run bot

endlocal
