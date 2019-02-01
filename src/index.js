//#region Dependency Requirements
const formidable = require('formidable');
const scheduler = require('node-schedule');
const calls = require("./middleware");
const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const exec = require('child_process').exec;
const url = require('url');
const http = require('http');
const cors = require('cors');
const shell = require('shelljs');
const app = express();
const port = require('./port').port;
//#endregion

var public_root = __dirname + "/../public/static"

var garbagePaths = [
  "../public/downloads/",
  "../public/static/comm/progress/"
]

var commvaultUrl = '/commvault';
var cost_calculatorUrl = '/costcalc';
var storageReportUrl = '/storagereport';

//#region Web Service Configuration
app.use(cors());
app.use(express.static('node_modules/bootstrap/dist/')); //Bootstrap css path
app.use(express.static('public/')); //public file path
app.use(express.static('public/static/'));
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());
//#endregion

//#region Garbage Collection
scheduler.scheduleJob('0 * * * *', function() {
  var fileLimit = 20;
  garbagePaths.forEach(function(pathDown) {
    fs.readdir(pathDown, function(err, items) {
      if(err){
        console.log(err);
      }
      if (items.length > fileLimit) {
        var files = fs.readdirSync(__dirname + pathDown);
        files.sort(function(a, b) {
          return fs.statSync(pathDown + b).mtime.getTime() -
            fs.statSync(pathDown + a).mtime.getTime();
        });
        for (var i = files.length - 1; i > fileLimit; i--) {
          fs.unlinkSync(pathDown + files[i]);
        }
      }
    });
  })
})
//#endregion

//#region storageReport
app.post(storageReportUrl, function(req, res){
  shell.exec(__dirname + '/storage-report.sh');
  res.sendFile(__dirname + '/output.log');
});

//#endregion

//#region Commvault
app.post(commvaultUrl + "/bug", function(req, res) {
  var form = new formidable.IncomingForm();
  form.parse(req);

  var uID;

  form.on('field', function(name, id) {
    uID = id;
  }).on('end', function() {
    var cmd = `curl -X POST -H "Content-Type: application/json" -d '{"value1": "` + uID + `"}' https://maker.ifttt.com/trigger/commvault_bug/with/key/pJBcu_KvOXI5yTdv4jaxDCzfePjKs8bUzgo5OvspiS8`;
    console.log(cmd);
    exec(cmd, function(error, stdout, stderr) {
      console.log('stdout: ' + stdout);
      console.log('stderr: ' + stderr);
      if (error == null) console.log("Request made with " + uID);
      res.status(200);
      res.send("");
    });
  })
})

//When form submitted
app.post(commvaultUrl, function(req, res) {
  //Move files to uploads and rename them
  console.log("POST: /commvault");
  var form = new formidable.IncomingForm();
  form.parse(req);
  var uID;

  form.on('field', function(name, id) {
    if (!fs.existsSync("./public/uploads/" + id)) {
      fs.mkdirSync("./public/uploads/" + id);
      fs.closeSync(fs.openSync("./public/static/comm/progress/progress_" + id + ".txt", 'w'));
    }
    uID = id;
  }).on('fileBegin', function(name, file) {
    if (file.name.includes("Storage")) {
      file.path = "public/uploads/ClientUsageReport.csv";
    } else if (file.name.includes("License")) {
      file.path = "public/uploads/LicenseSummaryReport.csv";
    }
  }).on('file', function(name, file) {
    console.log('Uploaded ' + file.name);
  }).on('end', function() {
    calls.generateCommvaultReport(uID);
    res.send("");
  })
});
//#endregion

//#region Server Start
//Listen on port 3000
app.listen(port);
console.log("Server started on localhost:" + port);
//#endregion
