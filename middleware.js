const vault = require('./middleware/commvault');
const options = require("./options");

module.exports.generateCommvaultReport = async function() {
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

  await vault.login();
  await vault.parseLicenseFile();
  await vault.parseUsageFile();
  vault.createReport();

  vault.writeProgress('<a href="http://localhost:3000/FinalBillingReport.csv">Download Report Here</a>');
}

module.exports.clearCommvaultConsole = function() {
  vault.resetProgress();
}
