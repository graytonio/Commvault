//#region Dependency Requirements
const formidable = require('formidable');
const scheduler = require('node-schedule');
const calls = require("./middleware");
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
//#endregion

var public_root = __dirname + "/../public/static"

var garbagePaths = [
  "./public/downloads/",
  "./public/static/comm/progress"
]

var commvaultUrl = '/commvault';
var commvaultPath = '/comm/index.html'

var cost_calculatorUrl = '/costcalc';
var cost_calculatorPath = '/cost/index.html';

//#region Web Service Configuration
app.use(express.static('node_modules/bootstrap/dist/')); //Bootstrap css path
app.use(express.static('public/')); //public file path
app.use(express.static('public/static/'));
//#endregion

//#region Garbage Collection
scheduler.scheduleJob('0 * * * *', function() {
  var fileLimit = 20;
  garbagePaths.forEach(function(pathDown) {
    fs.readdir(pathDown, function(err, items) {
      if (items.length > fileLimit) {
        var files = fs.readdirSync(pathDown);
        files.sort(function(a, b) {
          return fs.statSync(pathDown + b).mtime.getTime() -
            fs.statSync(pathDown + a).mtime.getTime();
        });
        for (var i = files.length - 1; i > fileLimit; i--) {
          fs.unlinkSync(pathDown + files[i]);
        }
      }
    })
  })
})
//#endregion

//#region Commvault

// Serve index.html as root
app.get(commvaultUrl, function(req, res) {
  console.log("GET: /commvault");
  res.sendFile(path.join(public_root + commvaultPath));
});

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
    res.sendFile(path.join(public_root + commvaultPath));
  })
});
//#endregion

//#region Cost cost_calculator
app.get(cost_calculatorUrl, function(req, res) {
  console.log("GET: " + cost_calculatorUrl);
  res.sendFile(path.join(public_root + cost_calculatorPath));
});
//#endregion

//#region Server Start
//Listen on port 3000
app.listen(3000);
console.log("Server started on localhost:3000");
//#endregion
