const vault = require('./middleware/commvault');
const options = require("./options").options;
const fs = require("fs");

module.exports.generateCommvaultReport = async function(id) {
  var server = "",
    user = "",
    pass = "",
    debug = false; //Turn on debug output

  //Grab command line options
  server = "http://" + options.server + ":81/SearchSvc/CVWebService.svc/";
  user = options.user;
  pass = Buffer.from(options.pass).toString('base64'); //Password must be base64 encoded

  fs.renameSync("./public/uploads/ClientUsageReport.csv", "./public/uploads/" + id + "/ClientUsageReport.csv");
  fs.renameSync("./public/uploads/LicenseSummaryReport.csv", "./public/uploads/" + id + "/LicenseSummaryReport.csv");

  vault.init(server, user, pass, debug);

  var clientGroups = [];
  var clients = [];

  vault.resetProgress(id);

  await vault.login(id, clientGroups, clients);
  await vault.parseLicenseFile(id, clientGroups, clients);
  await vault.parseUsageFile(id, clientGroups, clients);
  await vault.createReport(id, clientGroups, clients);
}

module.exports.clearCommvaultConsole = function(id) {
  vault.resetProgress(id);
}
