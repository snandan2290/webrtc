const electron = require('electron');
const path = require('path');
const fs = require('fs');

class Store {
  constructor(opts) {
    // console.log("Store called")
    const userDataPath = (electron.app || electron.remote.app).getPath('userData');
    this.path = path.join(userDataPath, opts.configName + '.json');
    this.data = parseDataFile(this.path, opts.defaults);
  }

  /* Checks the store existance
  1. Return the no. of keys if store exists
  2. Return 0 if not exists or any exception */
  check() {
    try {
      if (fs.existsSync(this.path)) {
        return Object.keys(this.data).length;
      } else {
        return 0;
      }
    } catch(err) {
      consol.log("ERROR while chekcing store existance "+err.message)
      return 0;
    }    
  }
  
  //Returns all available keys or empty array
  get_store_keys() {
    return Object.keys(this.data);
  }
  
  // This will just return the property on the `data` object
  get(key) {
    return this.data[key];
  }
  
  // ...and this will set it
  set(key, val) {
    this.data[key] = val;
    fs.writeFileSync(this.path, JSON.stringify(this.data));
  }

  clear_store(){
    console.log("Clear store")
    fs.unlinkSync(this.path);
    return true;
  }
}

function parseDataFile(filePath, defaults) {
  // console.log("Store:: parseDataFile:: filePath::"+filePath)
  try {
    // console.log("parseDataFile :: "+JSON.parse(fs.readFileSync(filePath)))
    return JSON.parse(fs.readFileSync(filePath));
  } catch(error) {
    return defaults;
  }
}

// expose the class
module.exports = Store;