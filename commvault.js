//#region Dependency Setup
var fs = require('fs');
var Client = require('node-rest-client-promise').Client;
var client = new Client();
var async = require('async');
//#endregion

//#region Variable Setup
var groups = {
  0: "Invalid or Missing Group",
  3: "VCSB",
  4: "DSM",
  6: "VCSB",
  7: "DSM",
  10: "Sims Crane",
  11: "DSM",
  13: "DSM",
  20: "Warner University",
  21: "Warner University",
  22: "DSM",
  26: "B&W Growers",
  27: "B&W Growers",
  28: "AR Savage",
  31: "Raymond Handling",
  35: "DSM",
  36: "Hunter Warfield",
  37: "Hunter Warfield",
  89: "B&W Growers",
  96: "B&W Growers",
  98: "Wall Titus",
  99: "Wall Titus",
  109: "Fleetwing",
  127: "Fleetwing",
  139: "DSM",
  141: "Clark Campbell Servers",
  145: "Clark Campbell Servers",
  146: "Clark Campbell Servers",
  149: "SAO 20",
  150: "SAO 20",
  152: "SAO 20",
  154: "SAO 20",
  159: "Harrells",
  161: "QEngine",
  163: "SI Portal",
  164: "Heacock Insurance",
  166: "Hunter Warfield",
  167: "AR Savage",
  168: "Pen Florida",
  171: "Clark Campbell Servers",
  172: "Clark Campbell Servers",
  173: "DSM"
}

var auth = "",
  user = "",
  pass = "",
  server = "",
  debug = false;
var clientGroups = [];
var clients = [];
var args = {}
//#endregion

//#region Exported Functions

/** Initializes variables to be used in other functions */
module.exports.init = function(server_p, user_p, pass_p, debug_p) {
  server = server_p;
  user = user_p;
  pass = pass_p;
  if (debug_p) debug = true;
};

/** Sends login command and stores the authentication token */
module.exports.login = function() {
  return new Promise(resolve => {
    //Login XML Command
    var loginArgs = {
      data: '<DM2ContentIndexing_CheckCredentialReq username="DSM\\' + user + '" password="' + pass + '" />',
      headers: {
        "Content-Type": "application/xml"
      }
    }
    //Send Command
    client.postPromise(server + "Login", loginArgs).then(function(value) {
      //Check that page returned correctly
      if (value.response.statusCode == 200) {
        if (auth == undefined) { //No token returned
          writeProgress("Username or Password Incorrect. Please check for mistakes");
          process.exit();
        } else { //Properly logged in
          //Look for and store auth token
          auth = value.data.DM2ContentIndexing_CheckCredentialResp.$.token;
          writeProgress("Login accepted");
        }
      }
      args = {
        headers: {
          "Content-Type": "application/xml",
          "Authtoken": auth
        }
      }

      writeProgress("Collecting Client Groups");
      client.getPromise(server + "ClientGroup", args).then(function(value) { //Send Request
        value.data.App_GetServerListResp.groups.forEach(function(element) { //For every client group in returned data
          var name = groups[element.$.Id];
          if (name == undefined) return;
          var exists = clientGroups.some(function(el) {
            return el.name === name;
          });
          if (!exists) {
            clientGroups.push(new ClientGroup(name));
            clientGroups[clientGroups.length - 1].knownNames.push(element.$.name);
          } else {
            var group = clientGroups.find(function(element) {
              return element.name === name;
            });
            group.knownNames.push(element.$.name);
          }
        });
        //console.log(clientGroups);
        resolve();
      });
    });
  });
};

/** Reads through the License Summary Report and stores necessary data in clientGroups Array */
module.exports.parseLicenseFile = async function() {
  writeProgress("Reading License Report");
  var content = fs.readFileSync("uploads/LicenseSummaryReport.csv", "utf8");
  var lines = content.split("\r\n");

  writeProgress("Parsing cSIM Clients");
  await getcSIMClientCount(lines);

  writeProgress("Parsing cAPP and cDPF Clients");
  await getcAPPcDPFCount(lines);
  return new Promise(resolve => {
    resolve();
  });
};

/** Reads through the CLient Usage Report and stores necessary data in the clientGroups Array */
module.exports.parseUsageFile = function() {
  //Read File in and Jump to Right Section
  //Filter out any rows wher Library does not start with dsm
  var content = fs.readFileSync("uploads/ClientUsageReport.csv", "utf8");
  var lines = content.split("\r\n");
  var realLines = [];
  var titles;

  writeProgress("Reading Client Usage Report");
  var start = false;
  var readPos = 0;
  lines.forEach(function(line) {
    if (line == ("")) {
      start = false;
    }
    if (start) {
      var parts = line.split(',');
      if (parts[readPos].startsWith('"DSM')) {
        realLines.push(line);
      }
    }
    if (line.includes('"Client","Agent","Instance","Subclient","Storage Policy","Copy","Library","Retention","Application Size (TB)","Data Written (TB)"')) {
      start = true;
      titles = line.split(',');
      readPos = findHeader(titles, "Library");
    }
  });

  writeProgress("Parsing Client Usage Data");
  //Read each Client Group and associate the size in GB to the Client Group
  var groupPos = findHeader(titles, "Client Group");
  var sizePos = findHeader(titles, "Data Written");
  var clientPos = findHeader(titles, "Client");

  realLines.forEach(function(line) {
    var parts = line.split(",");
    var groupName = parts[groupPos].split('"')[1];
    var group = undefined;
    if (groupName.length == 0) return;
    if (groupName.split(";").length > 1) {
      groupName.split(";").forEach(function(name) {
        if (group == undefined) {
          group = clientGroups.find(function(element) {
            return element.knownNames.indexOf(name.trim()) > -1;
          });
          if (group != undefined && group.name.trim() == "DSM") {
            if (name.trim() != 'DSM') {
              if (parts[clientPos].toLowerCase().startsWith('"hwi') || parts[clientPos].toLowerCase().startsWith('"hw')) {
                group = clientGroups.find(function(element) {
                  return element.name == "Hunter Warfield";
                });
              } else if (!parts[clientPos].toLowerCase().startsWith('"dsm')) {
                group = undefined;
              }
            }
          }
        }
      });
    } else {
      group = clientGroups.find(function(element) {
        return element.knownNames.indexOf(groupName) > -1;
      });
    }
    if (group == undefined) {
      console.log("------------------------");
      console.log(parts[clientPos]);
      console.log(groupName.split(";"));
      console.log("------------------------");
    }
    console.log(group.name + ":" + parts[clientPos] + ":" + parts[groupPos]);
    group.size += parseFloat(parts[sizePos].split('"')[1]) * 1024;
  });
  return new Promise(resolve => {
    resolve();
  });
}

/** Creat the report to be downloaded by the client */
module.exports.createReport = function() {
  console.log("Creating a Report File");
  fs.writeFile(__dirname + "/static/FinalBillingReport.csv", "", function(err) {});

  fs.appendFileSync(__dirname + "/static/FinalBillingReport.csv", "Client Group, Backup Size Actual (GB), Amazon S3 (GB), SSP-C-APP-Client, SSP-C-DPF-Client, SSP-cSIM-V-F-Client, SSP-C-DPSR-1T\n", function(err) {});

  clientGroups.forEach(function(element) {
    fs.appendFile(__dirname + "/static/FinalBillingReport.csv", element.name + "," + element.size + ",," + element.APP + "," + element.DPF + "," + element.cSIM + "\n", function(err) {});
  });
}

/** Write a line to the progress console in the browser window*/
var writeProgress = module.exports.writeProgress = function(msg) {
  fs.appendFile(__dirname + "/static/progress.txt", msg + "<br>", function(err) {
    console.log(msg);
    if (err) return console.log(err);
  });
};

/** Clear progress text file*/
var resetProgress = module.exports.resetProgress = function(msg) {
  fs.writeFile(__dirname + "/static/progress.txt", "", function(err) {
    if (err) return console.log(err);
  });
}

//#endregion

//#region Internal Functions
//Define a ClientGroup Object
function ClientGroup(name) {
  this.name = name;
  this.size = 0;
  this.cSIM = 0;
  this.DPF = 0;
  this.APP = 0;
  this.knownNames = [];
}

//Define a ClientUser Object
function ClientUser(name) {
  this.name = name;
  this.group;
}

function findHeader(titles, head) {
  for (var i = 0; i < titles.length; i++) {
    if (titles[i].includes(head)) {
      return i;
    }
  }
  return -1;
}

//Recognize the Group a particular client belongs to
function groupRegex(client_p, stem, base, invalidGroups, cb) {
  var offset = 0;
  do {
    if (base == undefined || stem.client.clientEntity.$.clientId == "-32000") {
      return -1;
    }
    if (Object.keys(base).length > 1) {
      if (base[Object.keys(base)[0 + offset]] == undefined) {
        console.log(client_p.name);
      }
      if (offset >= Object.keys(base).length) {
        group = '13';
        break;
      }
      group = base[Object.keys(base)[0 + offset]].$.clientGroupId;
      if (group == '13') {
        if (!client_p.name.toLowerCase().startsWith("dsm")) {
          group = '1';
        }
      }
      if (group == '22') {
        if (Object.keys(base).length - 1 != offset) group = '1';
      }
    } else {
      group = base[Object.keys(base)[0]].clientGroupId;
      if (group == '13' || group == '7') {
        if (!client_p.name.toLowerCase().startsWith("dsm")) {
          if (client_p.name.toLowerCase().startsWith("hw")) {
            group = 36;
          } else if (client_p.name.toLowerCase().startsWith("fw")) {
            group = 127;
          } else if (client_p.name.toLowerCase().startsWith("hwi")) {
            group = 164;
          }
        }
      }
    }
    offset++;
  } while (invalidGroups.includes(group));
  return group;
}

//Get information about a specific Client and set client group ONLY TO BE USED IN ASYC FOR LOOP
function getClientClientGroupIDByNamePromise(client_p, cb) {
  var invalidGroups = ['1', '2', '23', '138'];
  client.getPromise(server + "Client/byName(clientName='" + client_p.name + "')", args).then(function(value) {
    var stem = value.data.App_GetClientPropertiesResponse.clientProperties;
    var base = stem.clientGroups;
    var group = groupRegex(client_p, stem, base, invalidGroups);
    if (group == -1) {
      cb();
      return;
    }

    if (groups[group] == undefined) console.log(client_p.name + ": " + group);
    client_p.group = groups[group];
    clients.push(client_p);
    cb();
  });
}

//Get the ID of a Client Group given the Name
function getClientGroupIDByNamePromise(o_group, cb) {
  client.getPromise(server + "ClientGroup/byName(clientGroupName='" + o_group.name + "')", args).then(function(value) {
    var id = value.data.App_PerformClientGroupResp.clientGroupDetail.clientGroup.$.clientGroupId;
    o_group.ref = groups[id];
    cb();
  });
}

//Count clients by client group in specific table
function getcSIMClientCount(lines) {
  var temp_clients = [];
  return new Promise(resolve => {
    var cSIM = false;

    //Read csv file and pull needed data
    lines.forEach(function(line) {
      if (line.includes("CPU Sockets on Hypervisor Hosts:")) cSIM = false; //End

      if (cSIM) {
        var lineParts = line.split(',');
        temp_clients.push(new ClientUser(lineParts[0]));
      }

      if (line.includes("Virtual Machine Name,Last Backup Time,Size,")) cSIM = true; //Start
    });

    writeProgress("Parsing cSIM Client Data");
    //Get information for each client
    async.each(temp_clients, function(client, cb) {
      getClientClientGroupIDByNamePromise(client, cb);
    }, function(err) {
      //Count the number of clients per group
      clients.forEach(function(client) {
        clientGroups.forEach(function(group) {
          if (client.group == group.name) group.cSIM++;
        });
      });
      resolve();
    });
  });
}

//Count clients by client group and application in specific table
function getcAPPcDPFCount(lines) {
  var temp_clients = [];
  var start = false;
  return new Promise(resolve => {
    lines.forEach(function(line) {
      if (line === ("")) start = false;
      if (start) {
        var lineParts = line.split(",");
        var client = clients.find(function(element) {
          return element.name === lineParts[3];
        });
        if (client === undefined && lineParts[3] != "N/A") {
          temp_clients.push(new ClientUser(lineParts[3]));
        }
      }
      if (line.includes("Agent and Feature License DetailsLicense Type,Permanent Total,Permanent Used,Used By,Agent,Install Date,")) start = true;
    });
    async.each(temp_clients, function(client, cb) {
        getClientClientGroupIDByNamePromise(client, cb);
      },
      function(err) {
        writeProgress("Parse Agent and Feature License Details");
        lines.forEach(function(line) {
          if (line === ("")) {
            start = false;
          }
          if (start) {
            var lineParts = line.split(",");
            if (lineParts[0] === "Application Class 1") {
              var clientLookup = clients.find(function(element) {
                return element.name === lineParts[3];
              });
              var group;
              if (clientLookup != undefined) {
                group = clientLookup.group;
              } else {
                return;
              }
              clientGroups.find(function(element) {
                return element.name === group;
              }).APP++;
            } else if (lineParts[0] === "Server File System") {
              var clientLookup = clients.find(function(element) {
                return element.name === lineParts[3];
              });
              var group;
              if (clientLookup != undefined) {
                group = clientLookup.group;
              } else {
                return;
              }
              clientGroups.find(function(element) {
                return element.name === group;
              }).DPF++;
            }
          }
          if (line.includes("Agent and Feature License DetailsLicense Type,Permanent Total,Permanent Used,Used By,Agent,Install Date,")) {
            start = true;
          }
        });
        resolve();
      });

  });
}
//#endregion
