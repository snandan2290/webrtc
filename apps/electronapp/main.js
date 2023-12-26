// Modules to control application life and create native browser window
const { app, 
  BrowserWindow,
  ipcMain,
  session}       = require('electron')
const path       = require('path');
// const {ipcMain}  = require('electron');
const Store      = require('./store.js');
const replace    = require("replace");
const fs         = require('fs');

/* Variables */
var mainWindow   = null; 
var HOST_URL     = false;
var lndgpg       = true;
var forcequit    = false;

if (handleSquirrelEvent(app)) {
  return;
}

function createWindow() {
  lndgpg = store.get('lndgpg');
  if (lndgpg === undefined) {
    lndgpg = true;
  }
  if (lndgpg){
    console.log("createWindow:: Create landing page window");
    mainWindow = initWindowObj();
    mainWindow.loadFile( __dirname + '/electron_landing/index.html');
  } else {
    console.log("createWindow:: Create WebClient page window");
    mainWindow = initWindowObj();
    // mainWindow.loadFile('./movius-web/index.html');
    var direct_host_url = store.get('direct_host_url')
    console.log("direct_host_url" + direct_host_url)
    if (direct_host_url != 'undefined' && direct_host_url != null) {
      console.log("Connecting to HOST server")
      mainWindow.loadURL(direct_host_url+"/movius-web");
    } else {
      console.log("Execute embeded Angular App")
      mainWindow.loadFile( __dirname + '/movius-web/index.html');
    }
  }
  // Open the DevTools.
  // mainWindow.webContents.openDevTools()
}

function initWindowObj(){
  var windw = null;
  if (process.platform == 'darwin') {
    windw = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js')
      },
      icon: __dirname + '/assets/images/mml.icns',
      autoHideMenuBar : true
    });
  } else if (process.platform == 'win32') {
    windw = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js')
      },
      icon: __dirname + '/assets/images/mml.ico',
      autoHideMenuBar : true
    });
  }
  return windw;
}

/* Instantiate store to capture user session */
const store = new Store({
  configName: 'user-preferences',
  defaults: {}
});


function restore_store() {
  var store_size = store.check();
  if (store_size != 0) {
    var store_keys = store.get_store_keys();
    for (var i = 0; i < store_size; i++) {
      // console.log("Session data::"+i+"::"+store_keys[i]+"==>"+store.get(store_keys[i]));
      if (store_keys[i] != "lndgpg") {
        try {
          mainWindow.webContents
            .executeJavaScript('sessionStorage.setItem(' + JSON.stringify(store_keys[i]) + ',' + JSON.stringify(store.get(store_keys[i])) + ');', true)
            .then(result => {

            });
        } catch (e) {
          console.log("ERROR while writing to sessionStorage::" + e.message);
        }
      }
    }
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  console.log("App 'whenReady' event")

  createWindow();

  app.on('activate', function () {
    console.log("App in 'activate' event for MAC alone");
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      console.log("App on 'activate' event for MAC --> create window")
      createWindow();
    } else {
      console.log("App on 'activate' event for MAC --> show window")
      mainWindow.show();
    }
    restore_store();
  });

  const http_filter = {
    urls: ['https://*/movius-web']
  };

  session.defaultSession.webRequest.onBeforeRequest(http_filter, function (details, callback) {
    session.defaultSession.cookies.get({ name: 'sso_response' }).then((cookies) => {
      // console.log(decodeURIComponent(cookies[0]['value']));
      try {
        mainWindow.webContents
          .executeJavaScript('sessionStorage.setItem("oidc" ,' + JSON.stringify(JSON.stringify(decodeURIComponent(cookies[0]['value']))) + ');', true)
          .then(result => {
          });
      } catch (e) {
        console.log("ERROR while writing cookies to sessionStorage::" + e.message);
      }      
      token = details.url;
    }).catch((error) => {
      console.log(error)
    })
    callback({
      cancel: false
    });
    mainWindow.loadFile( __dirname + '/movius-web/index.html')
  });

  restore_store();

  // Handling fail to oad webContents
  mainWindow.webContents.on("did-fail-load", function (e) {
    console.log("Window on 'did-fail-load' event");
    mainWindow.loadFile( __dirname + '/movius-web/index.html');
  });

  // When windowd closed but App is not quit yet
  mainWindow.on('close', function (e) {
    console.log("Window on 'close' event");

    if (process.platform == 'darwin'){ 
      if (!forcequit){
        e.preventDefault();
        mainWindow.hide();
      }
    }

    try {
      mainWindow.webContents
        .executeJavaScript('sessionStorage')
        .then(result => {
          for (var prop in result) {
            // console.log("Session data:: "+prop+ "-->"+result[prop]);
            store.set(prop, result[prop]);
          }
        });
    } catch (e) {
      console.log("Exception caught in 'storage': " + e.message);
    }

  }); /* mainWindow.on'close' */

  // You can use 'before-quit' instead of (or with) the close event
  app.on('before-quit', function (e) {
    // Handle menu-item or keyboard shortcut quit here
    console.log("App on 'before-quit' event");
    if (process.platform == 'darwin') {
      forcequit = true;
    }
  });

  app.on('activate-with-no-open-windows', function(){
    console.log("App on 'activate-with-no-open-windows' event")
    if (process.platform == 'darwin'){
      mainWindow.show();        
    } 
  });  
}); /* app.ready */


// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  console.log("App on 'window-all-closed' event  All app window closed quiting for Win OS/minimised for MAC");
  if (process.platform !== 'darwin') app.quit();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

function handleSquirrelEvent(application) {
  if (process.argv.length === 1) {
      return false;
  }

  const ChildProcess = require('child_process');
  const path = require('path');

  const appFolder = path.resolve(process.execPath, '..');
  const rootAtomFolder = path.resolve(appFolder, '..');
  const updateDotExe = path.resolve(path.join(rootAtomFolder, 'Update.exe'));
  const exeName = path.basename(process.execPath);

  const spawn = function(command, args) {
      let spawnedProcess, error;

      try {
          spawnedProcess = ChildProcess.spawn(command, args, {
              detached: true
          });
      } catch (error) {}

      return spawnedProcess;
  };

  const spawnUpdate = function(args) {
      return spawn(updateDotExe, args);
  };

  const squirrelEvent = process.argv[1];
  switch (squirrelEvent) {
      case '--squirrel-install':
      case '--squirrel-updated':
          spawnUpdate(['--createShortcut', exeName]);

          setTimeout(application.quit, 1000);
          return true;

      case '--squirrel-uninstall':
          const store = new Store({
            configName: 'user-preferences',
            defaults: {}
          })

          spawnUpdate(['--removeShortcut', exeName]);
          store.clear_store();

          setTimeout(application.quit, 1000);
          return true;

      case '--squirrel-obsolete':
          application.quit();
          return true;
  }
}; /* handleSquirrelEvent */


ipcMain.on("lndgtowdc", (event, host) => {
  console.log("On 'lndgtowdc' event");
  editWDCIndex(host);
  // createWindow();
  // mainWindow.close();
  mainWindow.loadFile( __dirname + '/movius-web/index.html')
});

function editWDCIndex(host){
  console.log("editWDCIndex:: start");
  replace({
    regex: "HOST",
    replacement: host,
    paths: [ __dirname + '/movius-web/index.html'],
    recursive: true,
    silent: true,
  });
  store.set('lndgpg',false)
  console.log("editWDCIndex:: end");
}
