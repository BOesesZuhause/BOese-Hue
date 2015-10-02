var config = require('./config.json');
var devices = require('./devices.json');

var WebSocketClient = require('websocket').client;

var hue = require("node-hue-api"),
    HueApi = hue.HueApi,
    lightState = hue.lightState;

var api = new HueApi(config.bridge.ipaddress, config.bridge.username);

var state = lightState.create();

var sequenceNr = 0;

var displayError = function(err) {
	if(err != null){
		console.log("Error: " + err);
	}
};

var displayResult = function(result) {
    console.log(result);
};

//Save the config in JSON file
var saveConfig = function(){
	var jsonfile = require('jsonfile');
	var file = './config.json';

	jsonfile.writeFile(file, config, {spaces: 2}, displayError);
	console.log("Config saved: "+file);
};

//Save the devices in JSON file
var saveDevices = function(){
	var jsonfile = require('jsonfile');
	var file = './devices.json';

	jsonfile.writeFile(file, devices, {spaces: 2}, displayError);
	console.log("Devices saved: "+file);
};

var getDevices = function(cb2){
	

	//Create JSON Devices for Distribuert DeviceId = HUEId
	var devices = function(result, cb) {
		
		//Save Devices 
		devices =  '{"Devices":[';

	    var timestamp = new Date();

	    //Build JSON MessageType: SendDevices
	   	messageSendDevices =  '{"Header":{'
					+ '"MessageType":4,'
					+ '"ConnectorId":' + config.distributor.ConnectorId + ','
					+ '"SequenceNr":'+ (sequenceNr + 1) +','
					+ '"AcknowledgeNr":0,'
					+ '"Status":0,'
					+ '"Timestamp":' + timestamp.getTime()
					+ '},'
					+ '"Devices":[';

		for(var i = 0; i < result.lights.length; i++){
			messageSendDevices += '{'
						+ '"DeviceName":"' + result.lights[i].name+'",'
						+ '"DeviceId":-1'
						+ '},';

			devices += '{'
						+ '"DeviceName":"' + result.lights[i].name+'",'
						+ '"HueId":' + result.lights[i].id + ','
						+ '"DeviceId":-1,'
						+ '"Components":0'
						+ '},';
		}
		//Delete last "," from string messageSendDevices
		messageSendDevices = messageSendDevices.substr(0,messageSendDevices.length-1);
		messageSendDevices += ']}';

		//Parse String messageSendDevices to JSON 
		messageSendDevices = JSON.parse(messageSendDevices);
		cb(messageSendDevices);

		//Delete last "," from string devices
		devices = devices.substr(0,devices.length-1);
		devices += ']}';
	};

	//Geräte abfragen und messageSendDevies bauen aufrufen
 	api.lights(function(err, lights) {
   		if (err) throw err;
    	devices(lights, function(messageSendDevices){
    		cb2(messageSendDevices);
    	});
	});
};

/**
 * Serch the DeviceId from the device by HueID
 *
 * @param {integer} deviceId - The DeviceId from the Device.
 * @return {integer} - Returns the DeviceName from the device.
 */
var convertDeviceIdToHueId = function(deviceId, cbHueId){
	for(var i = 0; i < devices.Devices.length; i++){
		if(devices.Devices[i].DeviceId == deviceId){
			cbHueId(devices.Devices[i].HueId);
			break;
		}else{
			displayError("No Device found with DeviceId: " + deviceId);
		}
	}
};

/**
 * Serch the DeviceName from the device by DeviceId
 *
 * @param {integer} deviceId - The DeviceId from the Device.
 * @return {string} - Returns the DeviceName from the device.
 */
var getDeviceName = function(deviceId, cbDeviceName){
	for(var i = 0; i < devices.Devices.length; i++){
		if(devices.Devices[i].DeviceId == deviceId){
			cbDeviceName(devices.Devices[i].DeviceName);
			break;
		}else{
			displayError("No Device found with DeviceId: " + deviceId);
		}
	}
}; 

/**
 * Set the brightness from 0% to 100% (0% is not off) for a device
 *
 * @param {integer} deviceId - The DeviceId from the Device.
 * @param {integer} brightness - The value for the brightness in %. Only values from 0 to 100.  
 */
var hueSetBrightness = function(deviceId, brightness){
	var deviceName = getDeviceName(deviceId, function(deviceName){});

	if(brightness >= 0 && brightness <= 100){
		var hueId = convertDeviceIdToHueId(deviceId, function(hueId){});

		api.setLightState(hueId, state.brightness(brightness), function(err, result) {
			if (err) throw err;
			displayResult("Set " + deviceName + " brightness: " + brightness + "%");	
		});
	}else{
		displayError("Set " + deviceName + " brightness: Value not between 0 and 100: " + brightness);
	}	
};

/**
 * Get the brightness from 0% to 100% (0% is not off) for a device
 *
 * @param {integer} deviceId - The DeviceId from the Device.
 * @return {integer} - The value for the brightness in %. Only values from 0 to 100.  
 */
var hueGetBrightness = function(devicesId, cbBrightness){
	var hueId = convertDeviceIdToHueId(deviceId, function(hueId){});

	api.lightStatus(hueId, function(err, result) {
    	if (err) throw err;
    	cbBrightness(result.state.bri);
	});
};

/**
 * Switch the device on or off
 *
 * @param {integer} deviceId - The DeviceId from the Device.
 * @param {integer} stateSwitch - State to switch on or off.  
 */
var hueSetSwitch = function(deviceId, stateSwitch){
	var deviceName = getDeviceName(deviceId, function(deviceName){});

	if(stateSwitch){
		var hueId = convertDeviceIdToHueId(deviceId, function(hueId){});

		api.setLightState(hueId, state.on(), function(err, result) {
			if (err) throw err;
			displayResult("Switch " + deviceName + " on. ");	
		});
	}else if(stateSwitch == 0){
		var hueId = convertDeviceIdToHueId(deviceId, function(hueId){});

		api.setLightState(hueId, state.off(), function(err, result) {
			if (err) throw err;
			displayResult("Switch " + deviceName + " off. ");	
		});
	}else{
		displayError("Switch " + deviceName + ": Value not 0 or 1: " + stateSwitch);
	}	
};

/**
 * Get the state from switch for a device
 *
 * @param {integer} deviceId - The DeviceId from the Device.
 * @return {integer} - The state of the switch.
 */
var hueGetSwitch = function(devicesId, cbSwitch){
	var hueId = convertDeviceIdToHueId(deviceId, function(hueId){});

	api.lightStatus(hueId, function(err, result) {
    	if (err) throw err;
    	cbSwitch(result.state.on ? 1 : 0);
	});
};

var setValue = function(message){
	for (var i = 0; i < devices.Devices.length; i++){
	    	//Search the same Device Id in message and devices
	    	if(message.DeviceId == devices.Devices[i].DeviceId){
		    	for(var j = 0; j < devices.Devices[i].Components.length; j++){

			    	// Serach the components with the same DeviceComponentId
			    	if (message.DeviceComponentId== devices.Devices[i].Components[j].DeviceComponentId){
			    		switch(devices.Devices[i].Components[j].ComponentName) {
	                		case "on":
	                			hueGetSwitch(message.DeviceId, message.Value);
	                		case "bri":
	                			hueSetBrightness(message.DeviceId, message.Value);
	                    		break;
	                    	}
			    		//Component found, end for
			    		break;
			    	}	
		    	}
		    	//Device found, end for
		    	break;
	   		 }
	    }
};

/**
 * Build the JSON Message with the Components
 *
 * @param deviceID {integer} The deviceId.
 * @return {string} Returns the JSON Message.
 */
var getComponents = function(deviceId, cb){
	var api = new HueApi(config.bridge.ipaddress, config.bridge.username);

	var devicesPoint = 0;

	//Serach HueID for DeviceID
	for(var i = 0; i < devices.Devices.length;i++){
		if(devices.Devices[i].DeviceId == deviceId){
			var hueId = devices.Devices[i].HueId;
			devicesPoint = i;
			i = devices.Devices.length;
		}
	}

	api.lightStatus(hueId, function(err, result) {
    	if (err) throw err;

	    var timestamp = new Date().getTime();
	    var configComponents = require('./configComponents.json');

	    //var components = '{"Components":[';
	    var components = "[";

	    for(var i = 0; i < configComponents.Devices.length; i++){

	    	//Check is a Config for the DeviceTyp set
	    	if(configComponents.Devices[i].Type == result.type){

	    		//Bulid component devies for id's
	    		for(var j = 0; j <configComponents.Devices[i].Components.length; j++){

					components += '{'
						+ '"DeviceComponentId":' + JSON.stringify(configComponents.Devices[i].Components[j].DeviceComponentId) + ','
				        + '"ComponentName":' + JSON.stringify(configComponents.Devices[i].Components[j].ComponentName)
				    	+ '},';
				    }

	    		// Bulid Send Components Message
	    		var messageSendComponents =  '{"Header":{'
					+ '"MessageType":7,'
					+ '"ConnectorId":' + config.distributor.ConnectorId + ','
					+ '"SequenceNr":' + (sequenceNr + 1) +','
					+ '"AcknowledgeNr":0,'
					+ '"Status":0,'
					+ '"Timestamp":' + timestamp + '},'
					+ '"DeviceId":' + deviceId + ',' 
					+ '"Components":' + JSON.stringify(configComponents.Devices[i].Components)
					+ '}';

				// Parse messageSendComponents to JSON object
				messageSendComponents = JSON.parse(messageSendComponents);

				// Set the state from component in JSON object
				for (var i = 0; i < messageSendComponents.Components.length; i++){
					var component = messageSendComponents.Components[i].ComponentName;
			
					//Replace true/false with 1/0
					if(component == "on"){
						if(result.state[component]){
							messageSendComponents.Components[i].Value  = 1;
						}else if(result.state[component] == false){
							messageSendComponents.Components[i].Value  = 0;
						}
					}
					//convert brightness in percentage
					else if(component == "bri"){
						messageSendComponents.Components[i].Value = Math.round(result.state[component]/2.55);
					}else{
						messageSendComponents.Components[i].Value = result.state[component];

					}
					messageSendComponents.Components[i].Timestamp = timestamp;
				}
	    	}
	    	else{
	    		console.log("Device type not on configComponents.json");
	    	}
		}
		//Delete last "," from string components
		components = components.substr(0,components.length-1);
		components += ']';

		//Add components to devices
		devices.Devices[devicesPoint].Components = JSON.parse(components);

		//Callback 
		cb(JSON.stringify(messageSendComponents));
	});
};

var connect = function(){
	var client = new WebSocketClient();

	//Handle MessageType: Confirm Connection
	var confirmConnection = function(message){
	    config.distributor.ConnectorId = message.Header.ConnectorId;
	    config.distributor.Password = message.Password;
	    saveConfig();
	};

	//Handle MessageType: Confirm Devices
	var confirmDevices = function(message){
	    for (var i = 0; i < devices.Devices.length; i++){
	    	
	    	// Serach the Devices with the same names
	    	if (message.Devices[0].DeviceName == devices.Devices[i].DeviceName){
	    		devices.Devices[i].DeviceId = message.Devices[0].DeviceId;

	    		// Device found, end for
	    		i = devices.Devices.length;
	    		//saveDevices();
	    	}
	    }
	};

	//Handle MessageType: ConfirmDevice Components
	var confirmDeviceComponents = function(message){
	    for (var i = 0; i < devices.Devices.length; i++){

	    	//Search the same Device Id in message and devices
	    	if(message.DeviceId == devices.Devices[i].DeviceId){
		    	for(var j = 0; j < devices.Devices[i].Components.length; j++){

			    	// Serach the components with the same name
			    	if (message.Components[0].ComponentName == devices.Devices[i].Components[j].ComponentName){
			    		devices.Devices[i].Components[j].DeviceComponentId = message.Components[0].DeviceComponentId;

			    		//Component found, end for
			    		j = devices.Devices[i].Components.length;
			    	}	
		    	}
		    	//Device found, end for
		    	i = devices.Devices.length;
	   		 }
	    }

		saveDevices();
	};

	var requestConnection = function(cb) {

		var timestamp = new Date().getTime();
		//Build JSON for RequerstConnection 
    	var messageRequerstConnection =  '{'
				+ '"Header":{'
				+ '"MessageType":1,'
				+ '"ConnectorId":-1,'
				+ '"SequenceNr":0,'
				+ '"AcknowledgeNr":0,'
				+ '"Status":0,'
				+ '"Timestamp":' + timestamp
				+ '},'
				+ '"ConnectorName":"BOese-Phillips-HUE"'
				+ '}';

		cb(messageRequerstConnection);
    };


	client.on('connectFailed', function(error) {
	    console.log('Connect Error: ' + error.toString());
	});

	client.on('connect', function(connection) {
	    console.log('Connected: ws://'+config.distributor.ipaddress+':'+config.distributor.port+'/events/');

	    connection.on('error', function(error) {
	        console.log("Connection Error: " + error.toString());
	    });

	    connection.on('close', function() {
	        console.log('echo-protocol Connection Closed');
	    });

	    connection.on('message', function(message) {
	        if (message.type === 'utf8') {

	            var jsonMessage = JSON.parse(message.utf8Data);
	            //sequenceNr = jsonMessage.Header.SequenceNr + 1;
	            sequenceNr++;

	            //Check receives messages
	            switch(jsonMessage.Header.MessageType) {
	                case 2:
	                    console.log("MessageType: ConfirmConnection");
	                        confirmConnection(jsonMessage);
	                    break;
	                case 3:
	                    console.log("MessageType: RequestAllDevices");
						getDevices(function(messageSendDevices) {
							if (connection.connected) {
								connection.send(JSON.stringify(messageSendDevices));
						    	console.log("Send: '" + JSON.stringify(messageSendDevices) + "'");
						    }    
						});		                    
						break;
					case 5:
                    	console.log("MessageType: ConfirmDevices");
                        confirmDevices(jsonMessage);
                    	break;
                    case 6:
                    	console.log("MessageType: RequestDeviceComonents");
                        getComponents(jsonMessage.DeviceId,function(messageSendDevices) {
                        	if (connection.connected) {
								connection.send(messageSendDevices);
							}
						    console.log("Send: '" + messageSendDevices + "'");    
						});	
                    	break;
                    case 8:
                    	console.log("MessageType: ConfirmDeviceComponents");
                        confirmDeviceComponents(jsonMessage);
                    	break;
                    case 9:
                    	console.log("MessageType: SendValue");
                        setValue(jsonMessage);
                    	break;
                  	case 10:
                    	console.log("MessageType: ConfirmeValue");
                    	break;
                    case 11:
                    	console.log("MessageType: RequestValue");
                    	//Todo
                    	break;
	                default:
	                    console.log("MessageType unknow: ");
	            }

	            //Get received message on consol
	           	console.log("Received: '" + message.utf8Data + "'");
	        }

	    });
		
		//Send Message: RequestConnection
		console.log("MessageType: RequestConnection");
            requestConnection(function(messageRequestConnection) {
            	if (connection.connected) {
					connection.send(messageRequestConnection);
				}
			    console.log("Send: '" + messageRequestConnection + "'");    
			});
	});

	//Connect to Distributor
	client.connect('ws://'+config.distributor.ipaddress+':'+config.distributor.port+'/events/', null, null, null, {closeTimeout :5000000});
};

var checkUserConfig = function (){
	// Check if user in config
	if (config.bridge.username == null){
		createUser();
	}
	else{
		connect();
	}
};

//Check if ipaddress in config.json
var checkIpaddress = function(){
	if (config.bridge.ipaddress == null){
		//Search the ipaddress from the HUE Bridge
		hue.nupnpSearch(function(err, result) {
    		if (err) throw err;
    		console.log("Hue Bridge Found: " + JSON.stringify(result));

    		//Save ipadress in config
   		 	config.bridge.ipaddress = result[0].ipaddress;

   			//Save ipaddress in config.json
   			saveConfig();

   			//Check if Username in config.json
   			checkUserConfig();
		});
	} else{
		//Check if Username in config.json
		checkUserConfig();
	}
};
//hueSetBrightness(12, 80);
checkIpaddress();