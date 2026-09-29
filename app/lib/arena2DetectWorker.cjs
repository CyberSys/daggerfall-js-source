// AUDIT INSTALL (lane 4 #1, 2026-09-29): THE SEARCH, OFF THE MAIN PROCESS.
//
// detectArena2 is synchronous - a readdir, a registry read - and it ran on
// Electron's main process, whose event loop also serves the launcher's own
// page (dagger://launcher) and every window's input: a Steam library on a
// sleeping drive, a network share that is down, or a reg.exe that hangs
// froze the first run before the launcher could paint, for as long as the
// disk took. Here it runs in a worker thread (which loads from inside
// app.asar - measured on Electron 42), each find posted the moment it is
// made, so the shell's deadline (launcherState DETECT_DEADLINE_MS) can stop
// waiting and still offer what was found.
'use strict';

const { parentPort, workerData } = require('node:worker_threads');
const { detectArena2 } = require('./arena2Detect.cjs');

detectArena2({ looseDirs: workerData?.looseDirs ?? [], onFound: (found) => parentPort.postMessage({ found }) });
parentPort.postMessage({ done: true });
