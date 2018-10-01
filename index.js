//#region Dependency Requirements
const formidable = require('formidable');
const calls = require("./middleware");
const express = require('express');
const path = require('path');
const app = express();
//#endregion

var commvaultPath = '/'

//#region Web Service Configuration
app.use(express.static('node_modules/bootstrap/dist/')); //Bootstrap css path
app.use(express.static('static')); //Static file path

//Serve index.html as root
app.get(commvaultPath, function(req, res) {
  res.sendFile(path.join(__dirname + '/static/index.html'));
});
//When form submitted
app.post(commvaultPath, function(req, res) {
  //Move files to uploads and rename them
  var form = new formidable.IncomingForm();
  form.parse(req);
  form.on('fileBegin', function(name, file) {
    if (file.name.includes("Storage")) {
      file.path = __dirname + "/uploads/ClientUsageReport.csv";
    } else if (file.name.includes("License")) {
      file.path = __dirname + "/uploads/LicenseSummaryReport.csv";
    }
  });
  form.on('file', function(name, file) {
    console.log('Uploaded ' + file.name);
  });
  //Execute report function
  calls.generateCommvaultReport();
  //Return to root file
  res.sendFile(__dirname + '/static/index.html');
});

//Listen on port 3000
app.listen(3000);
//#endregion
