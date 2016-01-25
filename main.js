#!/usr/bin/env node
try {
	var config = require('./config/config.json');
}catch (e) {
	 var config = '{'
		 	+ '"hue": {'
		 	+ '"ipaddress": null,'
		 	+ '"username": null'
			+ '},'
			+ '"distributor":{'
			+ '"ipaddress": "localhost",'
			+ '"port": 8081,'
			+ '"tls": false,'
			+ '"ConnectorId": -1,'
			+ '"Password": null'
			+ '}'
			+ '}';
	 
	 config = JSON.parse(config);
}
	
var WebSocketClient = require('websocket').client;
var JSPath = require('jspath');


var hue = require("node-hue-api"),
    HueApi = hue.HueApi,
    lightState = hue.lightState;

var api = new HueApi(config.hue.ipaddress, config.hue.username);

var state = lightState.create();

/**
 * @description Save the configuration to a JSON file.
 */
var saveConfig = function(){
	var jsonfile = require('jsonfile');
	var file = './config/config.json';

	jsonfile.writeFile(file, config, {spaces: 2}, displayError);
	console.log("Config saved: " + file);
	console.log(config);
};

if (process.argv.length > 2) {
    var i = 2;
    while (i < process.argv.length) {
        switch (process.argv[i]) {
            case '-h': // Help
                console.log('BOese SmartHome Philips Hue connector');
                console.log('This is a node js based connector for the BOese SmartHome.');
                console.log('\tnode main.js [options]');
                console.log('If called without options it is assumed, that the distributor runs on localhost');
                console.log('\toptions:');
                console.log('\t\t-u\t\tURL of distributor (e.g. 192.168.0.1, localhost)');
                console.log('\t\t-p\t\tPort of distributor(e.g. 8081)');
                console.log('\t\t-tls\t\tConnection to distributor uses tls encryption');
                console.log('\t\t-hueIP\t\tThe IP-Address of the Hue bridge');
                console.log('\t\t-hueUser\tThe IP-Address of the Hue bridge');
                process.exit(0);
                break;
            case '-u': // URL
                if ((i + 1) < process.argv.length) {
                    // console.log(process.argv[i] + ' : ' + process.argv[i+1]);
                    config.distributor.ipaddress = process.argv[++i];
                } else {}
                break;
            case '-p': // Port
                if ((i + 1) < process.argv.length) {
                    // console.log(process.argv[i] + ' : ' + process.argv[i+1]);
                	config.distributor.port = process.argv[++i];
                } else {}
                break;
            case '-tls': // Connection use tls encryption
            	config.distributor.tls = true;
                break;
            case '-hueIP': // IP of hue bridge
                if ((i + 1) < process.argv.length) {
                    // console.log(process.argv[i] + ' : ' + process.argv[i+1]);
                	config.hue.ipaddress = process.argv[++i];
                } else {}
                break;
            case '-hueUser': // IP of hue bridge
                if ((i + 1) < process.argv.length) {
                    // console.log(process.argv[i] + ' : ' + process.argv[i+1]);
                	config.hue.username = process.argv[++i];
                } else {}
                break;
        }
        i++;
    }
    saveConfig();
}
var distributorURI = config.distributor.tls ? 'wss://' : 'ws://';
distributorURI += config.distributor.ipaddress + ':' + config.distributor.port + '/events/';

/**
 * @description Display the result on the console.
 *
 * @param {string} result - The result message.
 */

var displayResult = function(result) {
	if(result != null){
    	console.log(result);
    }
};

try {
	var devices = require('./storage/devices.json');
}catch (e) {
	displayResult("No old Hue devices found.");
	var devices = {};
}

/**
 * @description Display the error on the console.
 *
 * @param {string} err - The result message.
 */
var displayError = function(err) {
	if(err != null){
		console.log("Error: " + err);
	}
};



/**
 * @description Save the devices to a JSON file.
 *
 */
var saveDevices = function(){
	var jsonfile = require('jsonfile');
	var file = './storage/devices.json';

	jsonfile.writeFile(file, devices, {spaces: 2}, displayError);
	console.log("Devices saved: "+file);
};

/**
 * @description Search the DeviceId from the device by HueID.
 *
 * @param {integer} deviceId - The DeviceId from the device.
 * @return {integer} - Returns the DeviceName from the device.
 */
var convertDeviceIdToHueId = function(deviceId, cbHueId){
	cbHueId(JSPath.apply('.Devices.{.DeviceId === ' + deviceId + '}.HueId', devices)[0]);

};

/**
 * @description Search the deviceComponentId from the device by ComponentName.
 *
 * @param {integer} deviceComponentId - The DeviceId from the Device.
 * @return {integer} - Returns the ComponentName from the device.
 */
var convertDeviceComponentIdToHueId = function(deviceComponentId, cbComponentName){
	cbComponentName(JSPath.apply('.Devices.Components{.DeviceComponentId === ' + deviceComponentId + '}.ComponentName', devices)[0]);
};

/**
 * @description Search the devices wich connectet with the Hue bridge.
 *
 * @return {objekt} - Returns the devices from the Hue bridge.
 */
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

/**
 * @description Search the components from the device wich connectet with the Hue bridge by DeviceId.
 *
 * @param {integer} deviceId - The DeviceId from the Device.
 * @return {objekt} - Returns the devices from the Hue bridge.
 */
var hueGetComponents = function(deviceId, cbDevices){
	convertDeviceIdToHueId(deviceId, function(hueId){
		api.lightStatus(hueId, function(err, result) {
	   		if (err) throw err;
	   		if(!JSPath.apply('.Devices.{.DeviceId === ' + deviceId + '}.Components', devices)[0]){
		   	 	var configComponents = require('./config/configComponents.json');
		   	 	for(var i = 0; i < devices.Devices.length; i++){
					if(devices.Devices[i].DeviceId == deviceId){
						for(var j = 0; j < JSPath.apply('.Devices.{.Type === "' + result.type + '"}.Components.ComponentName', configComponents).length; j++){
							devices.Devices[i].Components.push({"DeviceComponentId": -1, "ComponentName": JSPath.apply('.Devices.{.Type === "' + result.type + '"}.Components.ComponentName', configComponents)[j], "Description": JSPath.apply('.Devices.{.Type === "' + result.type + '"}.Components.Description', configComponents)[j], "Unit": JSPath.apply('.Devices.{.Type === "' + result.type + '"}.Components.Unit', configComponents)[j],  "Value": JSPath.apply('.Devices.{.Type === "' + result.type + '"}.Components.Value', configComponents)[j], "Actor": JSPath.apply('.Devices.{.Type === "' + result.type + '"}.Components.Actor', configComponents)[j]});
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
 * @description Search the DeviceName from the device by DeviceId.
 *
 * @param {integer} deviceId - The DeviceId from the Device.
 * @return {string} - Returns the DeviceName from the device.
 */
var getDeviceName = function(deviceId, cbDeviceName){
	cbDeviceName(JSPath.apply('.Devices.{.DeviceId === ' + deviceId + '}.DeviceName', devices)[0]);
}; 

/**
 * @description Set the brightness from 0% to 100% (0% is not off) for a device.
 *
 * @param {integer} deviceId - The DeviceId from the Device.
 * @param {integer} brightness - The value for the brightness in %. Only values from 0 to 100.  
 */
var hueSetBrightness = function(deviceId, brightness, cbDone){
	getDeviceName(deviceId, function(deviceName){
		if(brightness >= 0 && brightness <= 100){
			hueGetSwitch(deviceId, function(on){
				if(on){
					convertDeviceIdToHueId(deviceId, function(hueId){
						api.setLightState(hueId, state.brightness(brightness), function(err, result) {
							if (err) throw err;
							displayResult("Set " + deviceName + " brightness: " + brightness + "%");
							cbDone(true);	
						});
					});
				}else{
					displayError("Set " + deviceName + " brightness: Device is not on");
				}
			});	
		}else{
			displayError("Set " + deviceName + " brightness: Value not between 0 and 100: " + brightness);
		}
	});		
};

/**
 * @description Get the brightness from 0% to 100% (0% is not off) for a device.
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
 * @description Set the color to the value by DeviceId.
 *
 * @param {integer} deviceId - The DeviceId from the Device.
 * @param {integer} color - The value for the color in rgb bitshift integer.
 * @return {boolean} - The value if it done.  
 */
var hueSetColor = function(deviceId, color, cbDone){
	console.log("Farbe ändern");
	getDeviceName(deviceId, function(deviceName){
		if(color >= 0 && color <= 16777215){
			//Convert color to r, g, b
			var r = (color >> 16) & 0xFF; 
			var g = (color >> 8) & 0xFF;
			var b = color & 0xFF;
			hueGetSwitch(deviceId, function(on){
				if(on){
					convertDeviceIdToHueId(deviceId, function(hueId){
						api.setLightState(hueId, state.rgb(r, g, b), function(err, result) {
							if (err) throw err;
							displayResult("Set " + deviceName + " color: R: " + r + " G: " + g + " B:" + b);
							cbDone(true);	
						});
					});
				}else{
					displayError("Set " + deviceName + " color: Device is not on");
				}
			});
		}else{
			displayError("Set " + deviceName + " color: Value not between 0 and 16777215: " + color);
		}
	});	
};

/**
 * @description Get the color from the Hue lamp.
 *
 * @param {integer} deviceId - The DeviceId from the Device.
 * @return {integer} - The value for the color in rgb  
 */
var hueGetColor = function(deviceId, cbColor){
	cbColor(JSPath.apply('.Devices{.DeviceId === ' + deviceId + '}.Components{.ComponentName === "xy" }.Value', devices)[0]);
};

/**
 * @description Switch the device on or off.
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

					//Set the color to the old value --> bug in the node-hue-api
					hueSetColor(deviceId, JSPath.apply('.Devices{.DeviceId === ' + deviceId + '}.Components{.ComponentName === "xy" }.Value', devices)[0], function(done){
						cbDone(done);
					});

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
 * @description Get the state from switch for a device.
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
 * @description Search the right ComponentName the deviceId an call the right function to set the value.
 *
 * @param {integer} deviceId - The DeviceId from the Device.
 * @param {integer} deviceComponentId - The DeviceComponentId from the Device.
 * @param {double} value - The value where is set for the compononent.
 * @return {boolean} - The value if it done.
 */
var setValue = function(deviceId, deviceComponentId, value, cbDone){
	switch(JSPath.apply('.Devices.Components{.DeviceComponentId === ' + deviceComponentId + '}.ComponentName', devices)[0]) {
		case "on":
			hueSetSwitch(deviceId, value, function(done){
				cbDone(done);
			});
			break;
		case "bri":
			//Set the color to the right value --> bug in node-hue-api
			hueSetColor(deviceId, JSPath.apply('.Devices{.DeviceId === ' + deviceId + '}.Components{.ComponentName === "xy" }.Value', devices)[0], function(done){
				hueSetBrightness(deviceId, value, function(done2){
					cbDone(done2);
				});
				cbDone(done);
			});
    		break;
    	case "xy":
			hueSetColor(deviceId, value, function(done){
				for(var i = 0; i < devices.Devices.length; i++){
					if( devices.Devices[i].DeviceId == deviceId){
						for(var j = 0; j < devices.Devices[i].Components.length; j++){
							if(devices.Devices[i].Components[j].ComponentName == "xy"){
								devices.Devices[i].Components[j].Value = value;
								break;
							console.log(j);
							}
						}
						break;
					}
				}
				cbDone(done);
			});
    		break;
    	default:
    		displayError("setValue: " + JSPath.apply('.Devices.Components{.DeviceComponentId === ' + deviceComponentId + '}.ComponentName', devices)[0]);
    }
};

/**
 * @description Search the right ComponentName the deviceId an call the right function to get the value.
 *
 * @param {integer} deviceId - The DeviceId from the Device.
 * @param {integer} deviceComponentId - The DeviceComponentId from the Device.
 * @param {double} value - The value where is set for the compononent.
 * @return {doulbe} - The value für the deviceComponentId.
 */
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

/**
 * @description Get the message RequestConnection for the distributor.
 *
 * @return {string} - The JSON SendDevices message.
 */
var boeseRequestConnection = function(cbMessageRequerstConnection) {
	var messageRequerstConnection =  '{'
			+ '"Header":{'
			+ '"MessageType":1,'
			+ '"ConnectorId":' + (config.distributor.ConnectorId ? config.distributor.ConnectorId : -1) + ','
			+ '"Status":0,'
			+ '"Timestamp":' + new Date().getTime()
			+ '},'
			+ '"ConnectorName":"BOese-Philips-Hue"';
			if(config.distributor.Password){
				messageRequerstConnection += ',"Password":"' + config.distributor.Password + '"}';
			}else{
				messageRequerstConnection += '}';
			}
	cbMessageRequerstConnection(messageRequerstConnection);
};

/**
 * @description Get the message SendDevices for the distributor.
 *
 * @return {objekt} - The JSON SendDevices message
 */
var boeseSendDevices = function(cbMessageSendDevices){
	hueGetDevices(function(devices) {

		var messageSendDevices = JSON.parse('{"Header":{'
						+ '"MessageType":4,'
						+ '"ConnectorId":' + config.distributor.ConnectorId + ','
						+ '"Status":0,'
						+ '"Timestamp":' + new Date().getTime()
						+ '},'
						+ '"Devices":[]}');

		if(devices.Devices.length){	

			for(var i = 0; i < devices.Devices.length; i++){
				messageSendDevices.Devices.push({"DeviceName": devices.Devices[i].DeviceName, "DeviceId":devices.Devices[i].DeviceId});
			}

		}
		cbMessageSendDevices(messageSendDevices);
	});	
};

/**
 * @description Get the message SendDevices for the distributor.
 *
 * @return {string} - The JSON SendDevices message
 */
var boeseSendComponents = function(deviceId, cbMessageSendComponents){
	hueGetComponents(deviceId, function(devices) {

		for(var i = 0; i < devices.Devices.length; i++){
			if(devices.Devices[i].DeviceId == deviceId){

				var messageSendComponents = JSON.parse('{"Header":{'
						+ '"MessageType":7,'
						+ '"ConnectorId":' + config.distributor.ConnectorId + ','
						+ '"Status":0,'
						+ '"Timestamp":' + new Date().getTime()
						+ '},'
						+ '"DeviceId":' + deviceId + ',' 
						+ '"Components":' + JSON.stringify(devices.Devices[i].Components)
						+ '}');

				for(var j = 0; j < devices.Devices[i].Components.length; j++){
				  	//messageSendComponents.Components[j].Value = 0;
					messageSendComponents.Components[j].Timestamp = new Date().getTime();
				 }
				cbMessageSendComponents(JSON.stringify(messageSendComponents));
				break;	
			}
		}		
	});	
};

/**
 * Get the message SendValue for the distributor
 *
 * @return {string} - The JSON SendDevices message
 */
var boeseSendValue = function(deviceId, deviceComponentId, cbMessageSendValue){
	getValue(deviceId, deviceComponentId, function(value){
		var messageSendValue =  '{"Header":{'
			+ '"MessageType":9,'
			+ '"ConnectorId":' + config.distributor.ConnectorId + ','
			+ '"Status":0,'
			+ '"Timestamp":' + new Date().getTime() + '},'
			+ '"DeviceId":' + deviceId + ',' 
			+ '"DeviceComponentId":' + deviceComponentId + ',' 
			+ '"Value":' + value + ','
			+ '"Timestamp":' + new Date().getTime() + '}';
		cbMessageSendValue(messageSendValue);		
	});
};

/**
 * @description Connect to the disitributor an handle the messages.
 */
var connect = function(){
	var client = new WebSocketClient();

	/**
 	* @description Handle the confirmConnection message.
 	*
 	* @param {objekt} message - The message for confirmConnection.
 	*/
	var confirmConnection = function(message){
	    config.distributor.ConnectorId = message.Header.ConnectorId;
	    config.distributor.Password = message.Password;
	    saveConfig();
	};

	/**
 	* @description Handle the confirmDevices message.
 	*
 	* @param {objekt} message - The message for confirmDevices.
 	*/
	var confirmDevices = function(message){
	    for (var i = 0; i < devices.Devices.length; i++){
	    	
	    	// Search the Devices with the same names
	    	if (message.Devices[0].DeviceName == devices.Devices[i].DeviceName){
	    		devices.Devices[i].DeviceId = message.Devices[0].DeviceId;
	    		break;
	    	}
	    }
	};

	/**
 	* @description Handle the confirmDeviceComponents message.
 	*
 	* @param {objekt} message - The message for confirmDeviceComponents.
 	*/
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
		    	break;
	   		 }
	    }
		saveDevices();
	};


	client.on('connectFailed', function(error) {
	    console.log('Connect Error: ' + error.toString());
	});

	client.on('connect', function(connection) {
	    console.log('Connected: ' + distributorURI);

	    connection.on('error', function(error) {
	        console.log("Connection Error: " + error.toString());
	    });

	    connection.on('close', function() {
	        console.log('echo-protocol Connection Closed');
	        client.connect(distributorURI, null, null, null, config.distributor.tls ? {rejectUnauthorized : false} : {});
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
	client.connect(distributorURI, null, null, null, config.distributor.tls ? {rejectUnauthorized : false} : {});
};

var timeoutcounter = 0;

/**
* @description Create an new user on the hue bridge.
*/
var hueCreateUser = function (){
	
	//var HueApi = require("node-hue-api").HueApi;
	var hue = new HueApi();
	
	try{
		hue.createUser(config.hue.ipaddress, function(err, user) {
		    if (err) {
		    	process.stdout.write(".");
		    	if (timeoutcounter++ < 100) {
					setTimeout(hueCreateUser(), 1000);
				}
		    } else {
		    	displayResult("\nNew user created: " + user);
			    config.hue.username = user;
			    saveConfig();
			    connect();
		    }
		});	
	}
	catch (e) {	
		if (timeoutcounter++ < 100) {
			setTimeout(hueCreateUser(), 1000);
		}
	}	
};

/**
* @description Check is user save in the config.
*/
var checkHueUserConfig = function (){
	// Check if user in config
	if (config.hue.username == null){
		displayResult("Press the button on the Philips Hue bridge to create an new user.");
		//while(config.hue.username == null){
			setTimeout(hueCreateUser(), 1000);
		//}
	} else{
		connect();
	}
	
};

/**
* @description Check is the Hue bridge ipaddress save in the config.
*/
var checkHueIpAddress = function(){
	if (config.hue.ipaddress === null){
		//Search the ipaddress from the HUE Bridge
		hue.nupnpSearch(function(err, result) {
    		if (err) throw err;
    		displayResult("Hue bridge found: " + JSON.stringify(result));

    		//Save ipadress in config
   		 	config.hue.ipaddress = result[0].ipaddress;

   			//Save ipaddress in config.json
   			saveConfig();

   			//Check if Username in config.json
   			checkHueUserConfig();
		});
	} else{
		//Check if Username in config.json
		checkHueUserConfig();
	}
};

checkHueIpAddress();