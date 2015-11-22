var config = require('./config.json');
var devices = require('./devices.json');

var WebSocketClient = require('websocket').client;
var JSPath = require('jspath');


var hue = require("node-hue-api"),
    HueApi = hue.HueApi,
    lightState = hue.lightState;

var api = new HueApi(config.bridge.ipaddress, config.bridge.username);

var state = lightState.create();

var timestamp = new Date();

var color2 = 0;

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

/**
 * Serch the DeviceId from the device by HueID
 *
 * @param {integer} deviceId - The DeviceId from the Device.
 * @return {integer} - Returns the DeviceName from the device.
 */
var convertDeviceIdToHueId = function(deviceId, cbHueId){
	cbHueId(JSPath.apply('.Devices.{.DeviceId === ' + deviceId + '}.HueId', devices)[0]);

};

/**
 * Serch the deviceComponentId from the device by ComponentName
 *
 * @param {integer} deviceComponentId - The DeviceId from the Device.
 * @return {integer} - Returns the ComponentName from the device.
 */
var convertDeviceComponentIdToHueId = function(deviceComponentId, cbComponentName){
	cbComponentName(JSPath.apply('.Devices.Components{.DeviceComponentId === ' + deviceComponentId + '}.ComponentName', devices)[0]);
};


var hueGetDevices = function(cbDevices){
	api.lights(function(err, device) {
   		if (err) throw err;
		if(devices.Devices === undefined) {
			devices = JSON.parse('{"Devices":[]}');
			var noKnowDevices = true;
		}else{
			var noKnowDevices = false;
		}

		for(var i = 0; i < device.lights.length; i++){
			if(noKnowDevices){
				devices.Devices.push({"DeviceName": device.lights[i].name, "HueId": parseInt(device.lights[i].id), "DeviceId": -1, "Components":[]});
			}else{
				// Checks if HueID available in devices, 
				if(!JSPath.apply('.Devices.{.HueId === ' + device.lights[i].id + '}', devices)[0]){
					devices.Devices.push({"DeviceName": device.lights[i].name, "HueId": parseInt(device.lights[i].id), "DeviceId":-1, "Components":[]});	
				} 
			}
		}
		cbDevices(devices);
		saveDevices();  	
	});
};

var hueGetComponents = function(deviceId, cbDevices){
	convertDeviceIdToHueId(deviceId, function(hueId){
		api.lightStatus(hueId, function(err, result) {
	   		if (err) throw err;
	   		if(!JSPath.apply('.Devices.{.DeviceId === ' + deviceId + '}.Components', devices)[0]){
		   	 	var configComponents = require('./config/configComponents.json');
		   	 	for(var i = 0; i < devices.Devices.length; i++){
					if(devices.Devices[i].DeviceId == deviceId){
						for(var j = 0; j < JSPath.apply('.Devices.{.Type === "' + result.type + '"}.Components.ComponentName', configComponents).length; j++){
							devices.Devices[i].Components.push({"DeviceComponentId": -1, "ComponentName": JSPath.apply('.Devices.{.Type === "' + result.type + '"}.Components.ComponentName', configComponents)[j], "Description": JSPath.apply('.Devices.{.Type === "' + result.type + '"}.Components.Description', configComponents)[j], "Unit": JSPath.apply('.Devices.{.Type === "' + result.type + '"}.Components.Unit', configComponents)[j], "Actor": JSPath.apply('.Devices.{.Type === "' + result.type + '"}.Components.Actor', configComponents)[j]});
						}
					break;
					}
				}
			}
			cbDevices(devices);
		});
	
	});
};

/**
 * Serch the DeviceName from the device by DeviceId
 *
 * @param {integer} deviceId - The DeviceId from the Device.
 * @return {string} - Returns the DeviceName from the device.
 */
var getDeviceName = function(deviceId, cbDeviceName){
	cbDeviceName(JSPath.apply('.Devices.{.DeviceId === ' + deviceId + '}.DeviceName', devices)[0]);
}; 

/**
 * Set the brightness from 0% to 100% (0% is not off) for a device
 *
 * @param {integer} deviceId - The DeviceId from the Device.
 * @param {integer} brightness - The value for the brightness in %. Only values from 0 to 100.  
 */
var hueSetBrightness = function(deviceId, brightness, cbDone){
	getDeviceName(deviceId, function(deviceName){
		if(brightness >= 0 && brightness <= 100){
			convertDeviceIdToHueId(deviceId, function(hueId){
				api.setLightState(hueId, state.brightness(brightness), function(err, result) {
					if (err) throw err;
					displayResult("Set " + deviceName + " brightness: " + brightness + "%");
					cbDone(true);	
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
	    	cbBrightness(Math.round(result.state.bri/2.54));
		});
	});
};

/**
 * Set the color f
 *
 * @param {integer} deviceId - The DeviceId from the Device.
 * @param {integer} color - The value for the color in rgb.  
 */
var hueSetColor = function(deviceId, color, cbDone){
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
					color2 = color;
					console.log("Farbe: " + color);
					cbDone(true);	
				});
			});
		}else{
			displayError("Set " + deviceName + " color: Value not between 0 and 16777215: " + color);
		}
	});	
};

/**
 * Get the color from the Hue Lamp
 *
 * @param {integer} deviceId - The DeviceId from the Device.
 * @return {integer} - The value for the color in rgb  
 */
var hueGetColor = function(deviceId, cbColor){
	// convertDeviceIdToHueId(deviceId, function(hueId){
	// 	api.lightStatus(hueId, function(err, result) {
	//     	if (err) throw err;
	// 		var x = result.state.xy[0]; // the given x value
	// 		var y = result.state.xy[1]; // the given y value
	// 		var z = 1.0 - x - y; 
	// 		var Y = (result.state.bri/2.55); // The given brightness value
	// 		var X = (Y / y) * x;  
	// 		var Z = (Y / y) * z;

	// 		//Convert to RGB using Wide RGB D65 conversion
	// 		var r = X * 1.612 - Y * 0.203 - Z * 0.302;
	// 		var g = -X * 0.509 + Y * 1.412 + Z * 0.066;
	// 		var b = X * 0.026 - Y * 0.072 + Z * 0.962;

	// 		//Apply reverse gamma correction
	// 		r = r <= 0.0031308 ? 12.92 * r : (1.0 + 0.055) * Math.pow(r, (1.0 / 2.4)) - 0.055;
	// 		g = g <= 0.0031308 ? 12.92 * g : (1.0 + 0.055) * Math.pow(g, (1.0 / 2.4)) - 0.055;
	// 		b = b <= 0.0031308 ? 12.92 * b : (1.0 + 0.055) * Math.pow(b, (1.0 / 2.4)) - 0.055;
	   
	// 		var rgb = (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b);

	//     	cbColor(rgb);
	// 	});
	// });
	cbColor(color2);
};

/**
 * Switch the device on or off
 *
 * @param {integer} deviceId - The DeviceId from the Device.
 * @param {integer} stateSwitch - State to switch on or off.  
 */
var hueSetSwitch = function(deviceId, stateSwitch, cbDone){
	getDeviceName(deviceId, function(deviceName){
		if(stateSwitch){
			convertDeviceIdToHueId(deviceId, function(hueId){
				api.setLightState(hueId, state.on(), function(err, result) {
					if (err) throw err;
					displayResult("Switch " + deviceName + " on. ");
					cbDone(true);	
				});
			});
		}else if(stateSwitch == 0){
			convertDeviceIdToHueId(deviceId, function(hueId){
				api.setLightState(hueId, state.off(), function(err, result) {
					if (err) throw err;
					displayResult("Switch " + deviceName + " off. ");
					cbDone(true);	
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

/**
 * Matching the DeviceComponentId to the Hue Device an call the function tu set the value
 *
 * @param {integer} deviceId - The DeviceId from the Device.
 * @param {integer} deviceComponentId - The DeviceComponentId from the Device.
 * 
 */
var setValue = function(deviceId, deviceComponentId, value, cbDone){
	switch(JSPath.apply('.Devices.Components{.DeviceComponentId === ' + deviceComponentId + '}.ComponentName', devices)[0]) {
		case "on":
			hueSetSwitch(deviceId, value, function(done){
				cbDone(done);
			});
			break;
		case "bri":
			hueSetBrightness(deviceId, value, function(done){
				cbDone(done);
			});
    		break;
    	case "xy":
			hueSetColor(deviceId,value, function(done){
				cbDone(done);
			});
    		break;
    	default:
    		displayError("setValue: " + JSPath.apply('.Devices.Components{.DeviceComponentId === ' + deviceComponentId + '}.ComponentName', devices)[0]);
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
	var messageRequerstConnection =  '{'
			+ '"Header":{'
			+ '"MessageType":1,'
			+ '"ConnectorId":' + (config.distributor.ConnectorId ? config.distributor.ConnectorId : -1) + ','
			+ '"Status":0,'
			+ '"Timestamp":' + timestamp.getTime()
			+ '},'
			+ '"ConnectorName":"BOese-Phillips-HUE"';
			if(config.distributor.Password){
				messageRequerstConnection += ',"Password":"' + config.distributor.Password + '"}';
			}else{
				messageRequerstConnection += '}';
			}
	cbMessageRequerstConnection(messageRequerstConnection);
};

/**
 * Get the message SendDevices for the distributor
 *
 * @return {objekt} - The JSON SendDevices message
 */
var boeseSendDevices = function(cbMessageSendDevices){
	hueGetDevices(function(devices) {
		if(devices.Devices.length){
			var messageSendDevices = JSON.parse('{"Header":{'
						+ '"MessageType":4,'
						+ '"ConnectorId":' + config.distributor.ConnectorId + ','
						+ '"Status":0,'
						+ '"Timestamp":' + timestamp.getTime()
						+ '},'
						+ '"Devices":[]}');
			for(var i = 0; i < devices.Devices.length; i++){
				messageSendDevices.Devices.push({"DeviceName": devices.Devices[i].DeviceName, "DeviceId":devices.Devices[i].DeviceId});
			}
			cbMessageSendDevices(messageSendDevices);
		}else{
			cbMessageSendDevices(false);
		}
	});	
};

/**
 * Get the message SendDevices for the distributor
 *
 * @return {objekt} - The JSON SendDevices message
 */
var boeseSendComponents = function(deviceId, cbMessageSendComponents){
	hueGetComponents(deviceId, function(devices) {

		for(var i = 0; i < devices.Devices.length; i++){
			if(devices.Devices[i].DeviceId == deviceId){

				var messageSendComponents = JSON.parse('{"Header":{'
						+ '"MessageType":7,'
						+ '"ConnectorId":' + config.distributor.ConnectorId + ','
						+ '"Status":0,'
						+ '"Timestamp":' + timestamp.getTime()
						+ '},'
						+ '"DeviceId":' + deviceId + ',' 
						+ '"Components":' + JSON.stringify(devices.Devices[i].Components)
						+ '}');

				for(var j = 0; j < devices.Devices[i].Components.length; j++){

					
				// 	switch(devices.Devices[i].Components[j].ComponentName) {
				// 		case "on":
				// 			console.log("Valiue: "+hueGetSwitch2(deviceId));
				// 			messageSendComponents.Components[j].Value = hueGetSwitch2(deviceId);
				// 			// hueGetSwitch(deviceId, function(value){
				// 			// 	console.log("test" +value);
				// 			// 	//var value2=value;
				// 			// 	//messageSendComponents.Components[j]. = 1;
				// 			// 	messageSendComponents.Components[j].Timestamp = timestamp.getTime();
				// 			// });
				// 			break;
				// // 		case "bri":
				// // 			hueGetBrightness(deviceId, function(value){
				// // 				var value2=value;
				// // 				//messageSendComponents.Components[j].Value = 2;
				// // 			});
				// //     		break;
				// //     	case "xy":
				// // 			hueGetColor(deviceId, function(value){
				// // 				var value2=value;
				// // 				//messageSendComponents.Components[j].Value = 3;
				// // 			});
				// //     		break;
				//     	default:
				//     		displayError("todo" +j);
				//     }
				// //     messageSendComponents.Components[j].Value = value2;
				  	messageSendComponents.Components[j].Value = 0;
					messageSendComponents.Components[j].Timestamp = timestamp.getTime();
				 }
				cbMessageSendComponents(JSON.stringify(messageSendComponents));
				break;	
			}
		}

		
			
	});	
};

var boeseSendValue = function(deviceId, deviceComponentId, cbMessageSendValue){
	getValue(deviceId, deviceComponentId, function(value){
		var messageSendValue =  '{"Header":{'
			+ '"MessageType":9,'
			+ '"ConnectorId":' + config.distributor.ConnectorId + ','
			+ '"Status":0,'
			+ '"Timestamp":' + timestamp.getTime() + '},'
			+ '"DeviceId":' + deviceId + ',' 
			+ '"DeviceComponentId":' + deviceComponentId + ',' 
			+ '"Value":' + value + ','
			+ '"Timestamp":' + timestamp.getTime() + '}';
		cbMessageSendValue(messageSendValue);		
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

					if(jsonMessage.Header.MessageType != undefined) {

		            //Check receives messages
		            switch(jsonMessage.Header.MessageType) {
		                case 2:
		                    console.log("MessageType: ConfirmConnection");
		                        confirmConnection(jsonMessage);
		                    break;
		                case 3:
		                    console.log("MessageType: RequestAllDevices");
							boeseSendDevices(function(messageSendDevices) {
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
	                        boeseSendComponents(jsonMessage.DeviceId,function(messageSendDevices) {
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
	                        setValue(jsonMessage.DeviceId, jsonMessage.DeviceComponentId, jsonMessage.Value, function(done){
	                        	console.log("boeseSendValue");
	                        	boeseSendValue(jsonMessage.DeviceId, jsonMessage.DeviceComponentId, function(messageSendValue){
	                        		if (connection.connected) {
									connection.send(messageSendValue);
								}
							    console.log("Send: '" + messageSendValue + "'");   

	                        	});
	                        });
	       //                  console.log("boeseSendValue");
	       //                  	boeseSendValue(jsonMessage.DeviceId, jsonMessage.DeviceComponentId, function(messageSendValue){
	       //                  		if (connection.connected) {
								// 	connection.send(messageSendValue);
								// }
							 //    console.log("Send: '" + messageSendValue + "'");   

	       //                  	});
	                    	break;
	                  	case 10:
	                    	console.log("MessageType: ConfirmValue");
	                    	break;
	                    case 11:
	                    	console.log("MessageType: RequestValue");
	                    	//Todo
	                    	break;
	                    case 120:
	                    	console.log("MessageType: HeartBeat");
					       	if (connection.connected) {
								connection.send(JSON.stringify(jsonMessage));
							}
							console.log("Send: '" + JSON.stringify(jsonMessage) + "'");  
	                    	break;
		                default:
		                    console.log("MessageType unknow: ");
		            }

		            //Get received message on consol
		           	console.log("Received: '" + message.utf8Data + "'");
		    	}
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



// boeseSendComponents(27,function(messageSendDevices) {
							
// 					    	console.log(messageSendDevices);
						  
//  						});		

