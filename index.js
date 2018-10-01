//#region Dependency Requirements
const formidable = require('formidable');
const options = require("./options");
const vault = require('./commvault');
const express = require('express');
const path = require('path');
const app = express();
//#endregion

//#region Variable Setup
var server = "",
  user = "",
  pass = "",
  debug = false; //Turn on debug output

//Grab command line options
server = "http://" + options.server + ":81/SearchSvc/CVWebService.svc/";
user = options.user;
pass = Buffer.from(options.pass).toString('base64'); //Password must be base64 encoded
if (process.argv[5] == undefined) debug == false;
else if (process.argv[5].localeCompare("true") == 0) debug = true;
vault.init(server, user, pass, debug);
vault.resetProgress();

//#endregion

//#region Run function
/** Main execution function */
async function run() {

  vault.resetProgress();
  await vault.login();
  await vault.parseLicenseFile();
  await vault.parseUsageFile();
  vault.createReport();

  vault.writeProgress('<a href="http://localhost:3000/FinalBillingReport.csv">Download Report Here</a>');

  //TODO: Send Report to web browser
}
//#endregion

//#region Web Service Configuration
app.use(express.static('node_modules/bootstrap/dist/')); //Bootstrap css path
app.use(express.static('static')); //Static file path

//Serve index.html as root
app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname + '/static/index.html'));
});

//When form submitted
app.post('/', function(req, res) {
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

  //Execute run function
  run();
  //Return to root file
  res.sendFile(__dirname + '/static/index.html');
});

//Listen on port 3000
app.listen(3000);
//#endregion
