var changeInstanceDetail = function(instance) {
	if (process.env.ECS_CONTAINER_METADATA_FILE) {
	    // Define JSON File
	    var fs = require("fs");
	    // Get content from file ECS_CONTAINER_METADATA_FILE
	    var contents = fs.readFileSync(process.env.ECS_CONTAINER_METADATA_FILE);
	    // Define to JSON type
	    var jsonContent = JSON.parse(contents);
	    // Check the container start to be ready before we read the ports
	    while (jsonContent.MetadataFileStatus !== 'READY') {
	        // Get content from file ECS_CONTAINER_METADATA_FILE
	            var contents = fs.readFileSync(process.env.ECS_CONTAINER_METADATA_FILE);
	        // Define to JSON type
	            var jsonContent = JSON.parse(contents);
	            console.log('Re-try to fetch the status..');
	    }
	    // Set the Port
	    instance.port = String(jsonContent.PortMappings[0].HostPort).trim();
	};
};
module.exports = changeInstanceDetail;
