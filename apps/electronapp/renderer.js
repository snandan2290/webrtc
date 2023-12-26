// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process because
// `nodeIntegration` is turned off. Use `preload.js` to
// selectively enable features needed in the rendering
// process.
console.log("Calling Renderer");

const ldwdcBtn = document.getElementById('ldwdc');
if (ldwdcBtn != null) {
  var host = document.getElementById('hosturl');
  ldwdcBtn.addEventListener('click', function (event) {
    window.electron.sendMessage(host);
  });
}

window.electron.recieveMessage("fromMain", (data) => {
  console.log(`Received ${data} from main process`);
});

function resolveHostAndConnect(regn){
  var host = regn.getAttribute('data-country');
  window.electron.sendMessage(host);
}

const americaBtn = document.getElementById('America')
if (americaBtn != null) {
  americaBtn.addEventListener('click', function (event) {
    resolveHostAndConnect(americaBtn);
  });
}

const emeaBtn = document.getElementById('EMEA')
if(emeaBtn != null) {
  emeaBtn.addEventListener('click', function (event) {
    resolveHostAndConnect(emeaBtn);
  });
}

const apacBtn = document.getElementById('APAC')
if (apacBtn != null) {
  apacBtn.addEventListener('click', function (event) {
    resolveHostAndConnect(apacBtn);
  });
}


