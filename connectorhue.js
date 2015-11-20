var config = require('./config.json');
var devices = require('./devices.json');

var WebSocketClient = require('websocket').client;
var jsonQuery = require('json-query');
var JSPath = require('jspath');

var hue = require("node-hue-api"),
    HueApi = hue.HueApi,
    lightState = hue.lightState;

var api = new HueApi(config.bridge.ipaddress, config.bridge.username);

var state = lightState.create();

var timestamp = new Date();

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
	console.log("Config saved: " + file);
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
		}
	}
};

var hueGetDevices = function(){
	api.lights(function(err, device) {
   		if (err) throw err;

		if(devices == null){
			devices =  '{"Devices":[]}';
			var noKnowDevices = true;
		}else{
			var noKnowDevices = false;
		}

		for(var i = 0; i < device.lights.length; i++){
			if(noKnowDevices){
				devices.Devices.push({"DeviceName": device.lights[i].name, "HueId":device.lights[i].id,"DeviceId":-1,"Components":[]});
			}else{
				// Checks if HueID available in devices, 
				if(!jsonQuery('Devices[HueId='+device.lights[i].id+']', {data: devices}).value){
					devices.Devices.push({"DeviceName": device.lights[i].name, "HueId":device.lights[i].id,"DeviceId":-1,"Components":[]});
				} 
			}
		}
		saveDevices();  	
	});
};

var hueGetComponents = function(){
	// api.lights(function(err, device) {
 //   		if (err) throw err;

	// 	for(var i = 0; i < device.lights.length; i++){
	// 		if(noKnowDevices){
	// 			devices.Devices.push({"DeviceName": device.lights[i].name, "HueId":device.lights[i].id,"DeviceId":-1,"Components":[]});
	// 		}else{
	// 			// Checks if HueID available in devices, 
	// 			if(!jsonQuery('Devices[HueId='+device.lights[i].id+']', {data: devices}).value){
	// 				devices.Devices.push({"DeviceName": device.lights[i].name, "HueId":device.lights[i].id,"DeviceId":-1,"Components":[]});
	// 			} 
	// 		}
	// 	}
	// 	saveDevices();  	
	// });
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
	getDeviceName(deviceId, function(deviceName){
		if(brightness >= 0 && brightness <= 100){
			convertDeviceIdToHueId(deviceId, function(hueId){
				api.setLightState(hueId, state.brightness(brightness), function(err, result) {
					if (err) throw err;
					displayResult("Set " + deviceName + " brightness: " + brightness + "%");	
				});
			});
		}else{
			displayError("Set " + deviceName + " brightness: Value not between 0 and 100: " + brightness);
		}
	});	
};

/**
 * Get the brightness from 0% to 100% (0% is not off) for a device
 *
 * @param {integer} deviceId - The DeviceId from the Device.
 * @return {integer} - The value for the brightness in %. Only values from 0 to 100.  
 */
var hueGetBrightness = function(deviceId, cbBrightness){
	convertDeviceIdToHueId(deviceId, function(hueId){
		api.lightStatus(hueId, function(err, result) {
	    	if (err) throw err;
	    	cbBrightness(result.state.bri);
		});
	});
};

/**
 * Set the color f
 *
 * @param {integer} deviceId - The DeviceId from the Device.
 * @param {integer} color - The value for the color in rgb.  
 */
var hueSetColor = function(deviceId, color){
	getDeviceName(deviceId, function(deviceName){
		if(color >= 0 && color <= 16777215){
			//Convert color to r, g, b
			var r = (color >> 16) & 0xFF; 
			var g = (color >> 8) & 0xFF;
			var b = color & 0xFF;
			convertDeviceIdToHueId(deviceId, function(hueId){
				api.setLightState(hueId, state.rgb(r, g, b), function(err, result) {
					if (err) throw err;
					displayResult("Set " + deviceName + " color: R: " + r + " G: " + g + " B:" + b);	
				});
			});
		}else{
			displayError("Set " + deviceName + " color: Value not between 0 and 16777215: " + color);
		}
		hueGetColor(deviceId, function(value){
			boeseSendValue(deviceComponentId, value);
		});
	});	
};

/**
 * Get the color 
 *
 * @param {integer} deviceId - The DeviceId from the Device.
 * @return {integer} - The value for the color in rgb  
 */
var hueGetColor = function(deviceId, cbColor){
	convertDeviceIdToHueId(deviceId, function(hueId){
		api.lightStatus(hueId, function(err, result) {
	    	if (err) throw err;
			var x = result.state.xy[0]; // the given x value
			var y = result.state.xy[1]; // the given y value
			var z = 1.0 - x - y; 
			var Y = (result.state.bri/2.55); // The given brightness value
			var X = (Y / y) * x;  
			var Z = (Y / y) * z;

			//Convert to RGB using Wide RGB D65 conversion
			var r = X * 1.612 - Y * 0.203 - Z * 0.302;
			var g = -X * 0.509 + Y * 1.412 + Z * 0.066;
			var b = X * 0.026 - Y * 0.072 + Z * 0.962;

			//Apply reverse gamma correction
			r = r <= 0.0031308 ? 12.92 * r : (1.0 + 0.055) * Math.pow(r, (1.0 / 2.4)) - 0.055;
			g = g <= 0.0031308 ? 12.92 * g : (1.0 + 0.055) * Math.pow(g, (1.0 / 2.4)) - 0.055;
			b = b <= 0.0031308 ? 12.92 * b : (1.0 + 0.055) * Math.pow(b, (1.0 / 2.4)) - 0.055;

			
		        
		        // var cap = function (x) {
		        //     return Math.max(0, Math.min(1, x));
		        // };
		        // return {
		        //     r: cap(r),
		        //     g: cap(g),
		        //     b: cap(b)
		        // };
		   

			var rgb = (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b);

	    	cbColor(rgb);
		});
	});
};

/**
 * Switch the device on or off
 *
 * @param {integer} deviceId - The DeviceId from the Device.
 * @param {integer} stateSwitch - State to switch on or off.  
 */
var hueSetSwitch = function(deviceId, stateSwitch){
	getDeviceName(deviceId, function(deviceName){
		if(stateSwitch){
			convertDeviceIdToHueId(deviceId, function(hueId){
				api.setLightState(hueId, state.on(), function(err, result) {
					if (err) throw err;
					displayResult("Switch " + deviceName + " on. ");	
				});
			});
		}else if(stateSwitch == 0){
			convertDeviceIdToHueId(deviceId, function(hueId){
				api.setLightState(hueId, state.off(), function(err, result) {
					if (err) throw err;
					displayResult("Switch " + deviceName + " off. ");	
				});
			})
			
		}else{
			displayError("Switch " + deviceName + ": Value not 0 or 1: " + stateSwitch);
		}
	});	
};

/**
 * Get the state from switch for a device
 *
 * @param {integer} deviceId - The DeviceId from the Device.
 * @return {integer} - The state of the switch.
 */
var hueGetSwitch = function(deviceId, cbSwitch){
	convertDeviceIdToHueId(deviceId, function(hueId){
		api.lightStatus(hueId, function(err, result) {
	    	if (err) throw err;
	    	cbSwitch(result.state.on ? 1 : 0);
		});
	});
};

var setValue = function(message){
	for (var i = 0; i < devices.Devices.length; i++){
    	//Search the same Device Id in message and devices
    	if(message.DeviceId == devices.Devices[i].DeviceId){
	    	for(var j = 0; j < devices.Devices[i].Components.length; j++){

		    	// Serach the components with the same DeviceComponentId
		    	if (message.DeviceComponentId == devices.Devices[i].Components[j].DeviceComponentId){
		    		console.log("setValue: " +devices.Devices[i].Components[j].ComponentName);
		    		switch(devices.Devices[i].Components[j].ComponentName) {
                		case "on":
                			hueSetSwitch(message.DeviceId, message.Value);
                			break;
                		case "bri":
                			hueSetBrightness(message.DeviceId, message.Value);
                    		break;
                    	
                    	case "xy":
                			hueSetColor(message.DeviceId, message.Value);
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

var getValue = function (deviceId, deviceComponentId, cbValue){
	switch(JSPath.apply('.Devices.Components{.DeviceComponentId === ' + deviceComponentId + '}.ComponentName', devices)[0]) {
		case "on":
			hueGetSwitch(deviceId, function(value){
				cbValue(value);
			});
			break;
		case "bri":
			hueGetBrightness(deviceId, function(value){
				cbValue(value);
			});
    		break;
    	case "xy":
			hueGetColor(deviceId, function(value){
				cbValue(value);
			});
    		break;
    	default:
    		displayError("getValue: " + JSPath.apply('.Devices.Components{.DeviceComponentId === ' + deviceComponentId + '}.ComponentName', devices)[0]);
    	}	    	
};

var boeseRequestConnection = function(cbMessageRequerstConnection) {

	//Build JSON for RequerstConnection 
	var messageRequerstConnection =  '{'
			+ '"Header":{'
			+ '"MessageType":1,'
			+ '"ConnectorId":' + (config.distributor.ConnectorId ? config.distributor.ConnectorId : -1) + ','
			+ '"Status":0,'
			+ '"Timestamp":' + timestamp.getTime()
			+ '},'
			+ '"ConnectorName":"BOese-Phillips-HUE"'
			+ '}';

	cbMessageRequerstConnection(messageRequerstConnection);
};

/**
 * Get the message SendDevices for the distributor
 *
 * @return {objekt} - The JSON SendDevices message
 */
var boeseSendDevices = function(cbMessageSendDevices){

	//var newDevices = JSPath.apply('.Devices{.DeviceId === -1}', devices);

	// if(Object.keys(newDevices).length){
	// 	var messageSendDevices = JSON.parse('{"Header":{'
	// 				+ '"MessageType":4,'
	// 				+ '"ConnectorId":' + config.distributor.ConnectorId + ','
	// 				+ '"Status":0,'
	// 				+ '"Timestamp":' + timestamp.getTime()
	// 				+ '},'
	// 				+ '"Devices":[]}');
	// 	for(var i = 0; i < newDevices.length; i++){
	// 		messageSendDevices.Devices.push({"DeviceName": newDevices[i].DeviceName, "DeviceId":-1});
	// 	}
	// 	cbMessageSendDevices(messageSendDevices);
	// }else{
	// 	cbMessageSendDevices(false);
	// }
		if(device.Devices.length){
		var messageSendDevices = JSON.parse('{"Header":{'
					+ '"MessageType":4,'
					+ '"ConnectorId":' + config.distributor.ConnectorId + ','
					+ '"Status":0,'
					+ '"Timestamp":' + timestamp.getTime()
					+ '},'
					+ '"Devices":[]}');
		for(var i = 0; i < device.Devices.length; i++){
			messageSendDevices.Devices.push({"DeviceName": device.Devices[i].DeviceName, "DeviceId":device.Devices[i].DeviceId});
		}
		cbMessageSendDevices(messageSendDevices);
	}else{
		cbMessageSendDevices(false);
	}
};

var boeseSendValue = function(deviceId, deviceComponentId, cbMessageSendValue){
	console.log("boeseSendValue: deviceComponetId" + deviceComponentId);

	getValue(deviceId, deviceComponentId, function(value){
	
		var messageSendValue =  '{"Header":{'
			+ '"MessageType":9,'
			+ '"ConnectorId":' + config.distributor.ConnectorId + ','
			+ '"Status":0,'
			+ '"Timestamp":' + timestamp.getTime() + '},'
			+ '"DeviceId":' + deviceId + ',' 
			+ '"DeviceComponentId":' + deviceComponentId + ',' 
			+ '"Value":' + value + '}';
		cbMessageSendValue(messageSendValue);

		console.log("Test:" +value+"\t"+messageSendValue);
	});
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
			break;
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

	    		//Bulid component devices for id's
	    		for(var j = 0; j < configComponents.Devices[i].Components.length; j++){

					components += '{'
						+ '"DeviceComponentId":' + JSON.stringify(configComponents.Devices[i].Components[j].DeviceComponentId) + ','
				        + '"ComponentName":' + JSON.stringify(configComponents.Devices[i].Components[j].ComponentName)
				    	+ '},';
				    }

	    		// Bulid Send Components Message
	    		var messageSendComponents =  '{"Header":{'
					+ '"MessageType":7,'
					+ '"ConnectorId":' + config.distributor.ConnectorId + ','
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
	    		break;
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
		    	break;
	   		 }
	    }

		saveDevices();
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
                    	console.log("MessageType: RequestDeviceComponents");
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
                        setValue(jsonMessage, function(){
                        	console.log("boeseSendValue");
                        	boeseSendValue(jsonMessage.DeviceId, jsonMessage.DeviceComponentId, function(messageSendValue){
                        		if (connection.connected) {
								connection.send(messageSendValue);
							}
						    console.log("Send: '" + messageSendValue + "'");   

                        	});
                        });
                        console.log("boeseSendValue");
                        	boeseSendValue(jsonMessage.DeviceId, jsonMessage.DeviceComponentId, function(messageSendValue){
                        		if (connection.connected) {
								connection.send(messageSendValue);
							}
						    console.log("Send: '" + messageSendValue + "'");   

                        	});
                    	break;
                  	case 10:
                    	console.log("MessageType: ConfirmValue");
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
            boeseRequestConnection(function(messageRequestConnection) {
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
checkIpaddress();

//boeseSendDevices();
