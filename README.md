Commvault Usage Report Creation Tool

Summary:
A web tool designed to stream line the billing update process.  The tool takes the input of the two necessary reports, the License Summary Report and the Client Usage Report, and reads through and parses the data into the required spreadsheet to update the billing software.

Usage:
node index.js

Note:
Connection details are contained in the options file and should be changed for production

Workflow:
1. Application is deployed on an internal use server
2. Navigating to page and uploading the necessary reports in CSV form
3. Wait for server to parse and verify data with Commvault
4. New report is available for download to the user's computer
