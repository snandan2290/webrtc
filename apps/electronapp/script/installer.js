#!/usr/bin/env node

const createWindowsInstaller = require('electron-winstaller').createWindowsInstaller
const path = require('path')
const rimraf = require('rimraf')

deleteOutputFolder()
  .then(getInstallerConfig)
  .then(createWindowsInstaller)
  .catch((error) => {
    console.error(error.message || error)
    process.exit(1)
  })

function getInstallerConfig () {
  const rootPath = path.join(__dirname, '..')
  const outPath = path.join(rootPath, 'out')
  console.log("rootPath::"+rootPath);
  console.log("outPath::"+outPath);

  return Promise.resolve({
    appDirectory: path.join(outPath, 'MLDTAPP-win32-x64'),
    exe: 'MLDTAPP.exe',
    iconUrl: path.join(rootPath, 'assets', 'images', 'mml.ico'),
    noMsi: true,
    outputDirectory: path.join(outPath, 'windows-installer'),
    setupExe: 'MLDTAPP.exe',
    setupIcon: path.join(rootPath, 'assets', 'images', 'mml.ico'),
    skipUpdateIcon: true
  })
}

function deleteOutputFolder () {
  return new Promise((resolve, reject) => {
    rimraf(path.join(__dirname, '..', 'out', 'windows-installer'), (error) => {
      error ? reject(error) : resolve()
    })
  })
}
