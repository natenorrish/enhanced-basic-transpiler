@echo off
cls
node convert %1 %2
x16emu -bas %2 -keymap en-us
