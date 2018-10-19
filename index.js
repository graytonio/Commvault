//#region Dependency Requirements
const formidable = require('formidable');
const calls = require("./middleware");
const express = require('express');
const path = require('path');
const app = express();
//#endregion

var commvaultUrl = '/commvault';
var commvaultPath = '/static/commvault/index.html'

//#region Web Service Configuration
app.use(express.static('node_modules/bootstrap/dist/')); //Bootstrap css path
app.use(express.static('static')); //Static file path

//#region Commvault
//Serve index.html as root
app.get(commvaultUrl, function(req, res) {
  console.log("GET: /static/index.html");
  res.sendFile(path.join(__dirname + commvaultPath));
  calls.clearCommvaultConsole();
});

//When form submitted
app.post(commvaultUrl, function(req, res) {
  //Move files to uploads and rename them
  console.log("POST: /static/index.html");
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
  res.sendFile(__dirname + commvaultPath);
});
//#endregion

//Listen on port 3000
app.listen(3000);
console.log("Server started on localhost:3000");
//#endregion
