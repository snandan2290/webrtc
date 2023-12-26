// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
const { remote, BrowserWindow } = require('electron');
const { contextBridge, ipcRenderer} = require('electron')
console.log("preload loaded");
// var currWindow = BrowserWindow.getFocusedWindow();

contextBridge.exposeInMainWorld(
  'electron',
  {
      sendMessage: (host) => {
        console.log("host received : "+host);
        ipcRenderer.send("lndgtowdc", host);
      },
      recieveMessage: (channel, func) => {
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }      
  }
);


window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type])
  }
});


