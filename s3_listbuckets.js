var AWS = require('aws-sdk');
// Set the region
AWS.config.update({
  region: 'us-east-1'
});

// Create CloudWatch service object
var cw = new AWS.CloudWatch({
  apiVersion: '2010-08-01'
});

var params = {
  Dimensions: [{
    Name: 'BucketName',
    Value: 'hwi-dpaas',
    /* required */
  }, ],
  MetricName: 'BucketSizeBytes'
};

cw.listMetrics(params, function(err, data) {
  if (err) {
    console.log("Error", err);
  } else {
    console.log("Metrics", data.Metrics[0].Dimensions);
  }
});
