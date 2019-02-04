//#region Dependency Setup
var fs = require('fs');
var Client = require('node-rest-client-promise').Client;
var client = new Client();
var AWSoptions = require('../options').AWS;
var async = require('async');
var awsCli = require('aws-cli-js');
var rimraf = require('rimraf');
var Options = awsCli.Options;
var Aws = awsCli.Aws;
//#endregion

//#region Variable Setup
//Group ID to Client Look Up Table
var groups = {
  0: "Invalid or Missing Group",
  3: "VCSB",
  4: "DSM",
  6: "VCSB",
  7: "DSM",
  10: "Sims Crane LKL",
  11: "DSM",
  13: "DSM",
  20: "Warner University",
  21: "Warner University",
  22: "DSM",
  26: "B&W Growers",
  27: "B&W Growers",
  28: "AR Savage",
  31: "Raymond Handling",
  33: "DSM",
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
  169: "DSM",
  171: "Center for Sales Strategy",
  172: "Clark Campbell Servers",
  173: "DSM"
}

var auth = "", user = "", pass = "", server = "", debug = false;

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
module.exports.login = function(id, clientGroups, clients) {
  return new Promise(resolve => {
    //Login XML Body
    var loginArgs = {
      data: '<DM2ContentIndexing_CheckCredentialReq username="DSM\\' + user + '" password="' + pass + '" />',
      headers: {
        "Content-Type": "application/xml"
      }
    }
    //Send Login Request
    client.postPromise(server + "Login", loginArgs).then(function(value) {
      //Check that page returned correctly
      if (value.response.statusCode == 200) {
        if (auth == undefined) { //No token returned
          writeProgress("Username or Password Incorrect. Please check for mistakes", id);
          process.exit();
        } else { //Properly logged in
          //Look for and store auth token
          auth = value.data.DM2ContentIndexing_CheckCredentialResp.$.token;
          writeProgress("Login accepted", id);
        }
      }
      //Save Auth Token
      args = {
        headers: {
          "Content-Type": "application/xml",
          "Authtoken": auth
        }
      }

      writeProgress("Collecting Client Groups", id);
      client.getPromise(server + "ClientGroup", args).then(function(value) { //Send Request
        value.data.App_GetServerListResp.groups.forEach(function(element) { //For every client group in returned data
          var name = groups[element.$.Id]; //Get name out of client group
          if (name == undefined) return; //Ignore irrelevant groups
          if (name == "Sims Crane LKL") { //Special case for separating Sims Crane LKL and WH
            clientGroups.push(new ClientGroup("Sims Crane WH"));
            clientGroups[clientGroups.length - 1].knownNames.push("Sims Crane WH");
          }
          var exists = clientGroups.some(function(el) { //Does the group exist?
            return el.name === name;
          });
          if (!exists) { //If the group is new
            clientGroups.push(new ClientGroup(name)); //Create a new ClientGroup
            clientGroups[clientGroups.length - 1].knownNames.push(element.$.name); //Add the name to the known names
          } else { //The group already exists
            var group = clientGroups.find(function(element) { //Find it
              return element.name === name;
            });
            group.knownNames.push(element.$.name); //Add the name to known names
          }
        });
        resolve();
      });
    });
  });
};

/** Reads through the License Summary Report and stores necessary data in clientGroups Array */
module.exports.parseLicenseFile = async function(id, clientGroups, clients) {
  writeProgress("Reading License Report", id);
  var content = fs.readFileSync(__dirname + "/../../public/uploads/" + id + "/LicenseSummaryReport.csv", "utf8"); //Read in input file
  var lines = content.split("\r\n"); //Split into lines

  writeProgress("Parsing cSIM Clients", id);
  await getcSIMClientCount(lines, id, clientGroups, clients); //Send line array to function

  writeProgress("Parsing cAPP and cDPF Clients", id);
  await getcAPPcDPFCount(lines, id, clientGroups, clients); //Send line array to other function
  return new Promise(resolve => {
    resolve();
  });
};

/** Reads through the CLient Usage Report and stores necessary data in the clientGroups Array */
module.exports.parseUsageFile = function(id, clientGroups, clients) {
  var content = fs.readFileSync(__dirname + "/../../public/uploads/" + id + "/ClientUsageReport.csv", "utf8"); //Read in input file
  var lines = content.split("\r\n"); //Split into lines
  var realLines = []; //Used to find all lines that refer to internal storage
  var titles; //Store header information

  writeProgress("Reading Client Usage Report", id);
  var start = false;
  var readPos = 0;
  lines.forEach(function(line) { //For every line
    if (line == ("")) { //If the line is blank
      start = false; //Then you have reached the end of the file
    }
    if (start) { //If you are in the corrent section
      var parts = line.split(','); //Split the line by comma
      if (parts[readPos].startsWith('"DSM') || parts[readPos].includes("CVSDS-Pool01")) { //If the library column is with DSM
        realLines.push(line); //Save this line for more processing
      }
    }
    if (line.includes('"Client","Agent","Instance","Subclient","Storage Policy","Copy","Library","Retention","Application Size (TB)","Data Written (TB)"')) { //If the line indicates the start of the correct table
      start = true; //Set flag that it is time to start reading
      titles = line.split(','); //save the header in titles
      readPos = findHeader(titles, "Library"); //Find index of the library column
    }
  });

  writeProgress("Parsing Client Usage Data", id);
  //Read each Client Group and associate the size in GB to the Client Group
  var groupPos = findHeader(titles, "Client Group"); //Find index of Client Group column
  var sizePos = findHeader(titles, "Data Written"); //Find index of Data Written column
  var clientPos = findHeader(titles, "Client"); //Find index of Client column

  realLines.forEach(function(line) { //For each of the relevant lines
    var parts = line.split(","); //Split into columns
    var groupName = parts[groupPos].split('"')[1]; //Find the client group column values
    var group = undefined;
    if (groupName.length == 0) return; //If there are no groups it is not a valid line
    if (groupName.split(";").length > 1) { //If there is more than one group name
      groupName.split(";").forEach(function(name) { //For each of the group names
        if (group == undefined) { //If group is still unknown
          group = clientGroups.find(function(element) { //Find the client group
            return element.knownNames.indexOf(name.trim()) > -1; //Where the group name is related to a customer name
          });

          if (group != undefined) { //If a group was found
            if (group.name == "Sims Crane LKL" && parts[readPos].includes("CVSDS")) { //If the croup was Sims Crane and should be in WH
              group = clientGroups.find(function(element) { //Return the Sims Crane WH group
                return element.name == "Sims Crane WH";
              });
            }
            if (group.name == "Hunter Warfield" && !groupName.includes("dsm-wh-vca01; Hunter Warfield")) { //If the group was Hunter Warfield and it should not be counted
              group = undefined; //Try again
              return;
            }
            if (group.name.trim() == "DSM") { //If the group was dsm
              if (name.trim() != 'DSM') { //If the group name is not just DSM
                if (groupName.includes("dsm-wh-vca01; Hunter Warfield")) { //If the group names include Hunter Warfield
                  group = clientGroups.find(function(element) {
                    return element.name == "Hunter Warfield"; //The group is Hunter Warfield
                  });
                } else if (!parts[clientPos].toLowerCase().startsWith('"dsm')) { //If the client name does start with DSM
                  group = undefined; //Try again
                  return;
                }
              }
            }
            if (group.name == "DSM" && !groupName.includes("Infrastructure")) { //If the client is Infrastructure
              group = undefined; //Try again
              return;
            }
          }
        }
      });
    } else { //If there is only one name
      group = clientGroups.find(function(element) {
        return element.knownNames.indexOf(groupName) > -1; //Find the customer related to that group name
      });
      if (groupName == "Index Servers") { //If the group is Index Servers
        if (parts[clientPos].toLowerCase().includes("sims_wh")) { //If the client starts with sims_wh
          group = clientGroups.find(function(element) { //The group is Sims Crane WH
            return element.name == "Sims Crane WH";
          })
        } else if (parts[clientPos].toLowerCase().includes("ccm")) { //If the client starts with ccm
          group = clientGroups.find(function(element) { //The group is Clark Campbell Server
            return element.name == "Clark Campbell Servers";
          })
        } else if (parts[clientPos].toLowerCase().includes("hwi")) { //If the client starts with hwi
          group = clientGroups.find(function(element) { //The group is Hunter Warfield
            return element.name == "Hunter Warfield";
          })
        } else if (parts[clientPos].toLowerCase().includes("heacock")) { //If the client starts with heacock
          group = clientGroups.find(function(element) { //The group is Heacock Insurance
            return element.name == "Heacock Insurance";
          })
        } else if (parts[clientPos].toLowerCase().includes("fw_")) { //If the client starts with fw_
          group = clientGroups.find(function(element) { //The group is Fleetwing
            return element.name == "Fleetwing";
          })
        }
        if (group.name == "Hunter Warfield") return; //If the group is Hunter Warfield try again
      }
    }
    if (group == undefined) { //If the group is undefined ignore it
      return;
    } else { //Otherwise
      group.size += (parseFloat(parts[sizePos].split('"')[1]) * 1024); //Add the size to the group object
    }
  });
  return new Promise(resolve => {
    resolve();
  });
}



/** Creat the report to be downloaded by the client */
module.exports.createReport = async function(id, clientGroups, clients) { //Create the report for the user to download
  var downloadPath = "/../../public/downloads/FinalBillingReportCommvault_" + id + ".csv" //Use the client id in download path
  console.log("Creating a Report File");

  fs.writeFileSync(__dirname + downloadPath, "Client Group, Backup Size Actual (GB), Amazon S3 (GB), SSP-C-APP-Client, SSP-C-DPF-Client, SSP-cSIM-V-F-Client, SSP-C-DPSR-1T\n", function(err) {}); //Write headers

  //var s3 = await getS3Storage(); //Query AWS for bucket size

  var hwi = clientGroups.find(function(element) { //Find the hwi client group
    return element.name == "Hunter Warfield";
  });

  //if(hwi != undefined) hwi.S3 = s3; //If it is found set its S3 size

  clientGroups.sort(compare); //Sort the clients alphabetically

  clientGroups.forEach(function(element) { //For each client group
    if (element.name == "Hunter Warfield") { //If the client group is Hunter Warfield
      fs.appendFileSync(__dirname + downloadPath, element.name + "," + Math.round(element.size) + "," + element.S3 + "," + element.APP + "," + element.DPF + "," + element.cSIM + "\n", function(err) {}); //Write data with S3
    } else { //Otherwise
      fs.appendFileSync(__dirname + downloadPath, element.name + "," + Math.round(element.size) + ",," + element.APP + "," + element.DPF + "," + element.cSIM + "\n", function(err) {}); //Write data without S3
    }
  });

  writeProgress('<a href="http://10.70.117.150:8081/downloads/FinalBillingReportCommvault_' + id + '.csv">Download Report Here</a>', id); //Send download link

  rimraf('./public/uploads/' + id, function() {}); //Remove Upload files

  return new Promise(resolve => {
    resolve();
  });
}

/** Write a line to the progress console in the browser window*/
var writeProgress = module.exports.writeProgress = function(msg, id) {
  fs.appendFile(__dirname + "/../../public/static/comm/progress/progress_" + id + ".txt", msg + "<br>", function(err) { //Write message to the progress file ascociated with the user
    console.log(id + ": " + msg);
    if (err) return console.log(err);
  });
};

/** Clear progress text file*/
var resetProgress = module.exports.resetProgress = function(id) {
  fs.writeFile(__dirname + "/../../public/static/comm/progress/progress_" + id + ".txt", "", function(err) { //Clear the progress file ascociated with the user
    if (err) return console.log(err);
  });
}

function getS3Storage() {
  return new Promise(resolve => {
    var aws = new Aws(AWSoptions);
    var d = new Date();
    aws.command('cloudwatch get-metric-statistics --metric-name BucketSizeBytes --namespace AWS/S3 --start-time ' + d.getFullYear() + '-' + d.getMonth() + '-' + (d.getDate() - 1) + 'T00:00:00Z --end-time ' + d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate() + 'T00:00:00Z --statistics Average --unit Bytes --region us-east-1 --dimensions Name=BucketName,Value=hwi-dpaas Name=StorageType,Value=StandardStorage --period 86400 --output json').then(function(data) { //Run the awsCli command for getting the bucket size
      var size = data.object.Datapoints[0].Average / Math.pow(10, 9);
      resolve(size);
    });
  });
}

//#endregion

//#region Internal Functions

//Compare function for ClientGroup object
function compare(a, b) {
  if (a.name < b.name) return -1;
  if (a.name > b.name) return 1;
  return 0;
}

//Define a ClientGroup Object
function ClientGroup(name) {
  this.name = name;
  this.size = 0;
  this.S3 = 0;
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

//Return index of passed header name
function findHeader(titles, head) {
  for (var i = 0; i < titles.length; i++) {
    if (titles[i].includes(head)) {
      return i;
    }
  }
  return -1;
}

//Recognize the Group a particular client belongs to
function groupRegex(client_p, stem, base, invalidGroups) {
  var offset = 0;
  do {
    if (base == undefined || stem.client.clientEntity.$.clientId == "-32000") {
      return -1;
    }
    if (Object.keys(base).length > 1) {
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
      if (group == '13' || group == '7' || group == '2') {
        if (!client_p.name.toLowerCase().startsWith("dsm")) {
          if (client_p.name.toLowerCase().startsWith("hw")) {
            group = 36;
          } else if (client_p.name.toLowerCase().startsWith("fw")) {
            group = 127;
          } else if (client_p.name.toLowerCase().startsWith("hwi")) {
            group = 164;
          } else if (client_p.name.toLowerCase().startsWith("css")) {
            group = 171;
          }
        } else {
          group = 33;
        }
      }
    }
    offset++;
  } while (invalidGroups.includes(group));
  return group;
}

//Get information about a specific Client and set client group ONLY TO BE USED IN ASYC FOR LOOP
function getClientClientGroupIDByNamePromise(client_p, cb, clients) {
  var invalidGroups = ['1', '2', '23', '32', '138'];
  client.getPromise(server + "Client/byName(clientName='" + client_p.name + "')", args).then(function(value) {
    var stem = value.data.App_GetClientPropertiesResponse.clientProperties;
    var base = stem.clientGroups;
    var group = groupRegex(client_p, stem, base, invalidGroups);
    if (group == -1) {
      cb();
      return;
    }
    client_p.group = groups[group];
    clients.push(client_p);
    cb();
    return;
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
function getcSIMClientCount(lines, id, clientGroups, clients) {
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

    writeProgress("Parsing cSIM Client Data", id);

    //Get information for each client
    async.each(temp_clients, function(client, cb) {
      getClientClientGroupIDByNamePromise(client, cb, clients);
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
function getcAPPcDPFCount(lines, id, clientGroups, clients) {
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
        if (client == undefined && lineParts[3] != "N/A") {
          temp_clients.push(new ClientUser(lineParts[3]));
        }
      }
      if (line.includes("Agent and Feature License DetailsLicense Type,Permanent Total,Permanent Used,Used By,Agent,Install Date,")) start = true;
    });
    async.each(temp_clients, function(client, cb) {
        getClientClientGroupIDByNamePromise(client, cb, clients);
      },
      function(err) {
        writeProgress("Parse Agent and Feature License Details", id);
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

              var groupLookup = clientGroups.find(function(element) {
                return element.name === group;
              });

              if (groupLookup == undefined) {
                console.log(clientLookup);
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
