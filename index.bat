@echo off
goto start

:start
goto startbot

:startbot
node index.js

echo Detected bot crash: %date%-%time% >> logs/error.log
goto start
a