exports.action = function(data, callback, config, SARAH) {
  
  var exec = require('child_process').exec;
  var util = require('util');
	var iPhoneFinder = require('./lib/iphone-finder.js');
	config=config.modules.iphonefinder;

	var iCloudUser = config.api_login;
	var iCloudPass = config.api_password;
	var iCloudDevice = 0;

	if ((!iCloudUser)||(!iCloudPass)) {
        return callback({ 'tts': 'Configuration invalide' });
    }

	//Selection du device selon utilisateur
	var user = data.who;
	switch(user)
	{
		case 'Franck':
		case 'iPhone':
			iCloudDevice = 0;
			break;
		case 'Maison':
		case 'iPad':
			iCloudDevice = 1;
			break;
		default:
			return callback({ 'tts': 'Utilisateur '+user+' non reconnu' });
	}
	//if (!iCloudDevice) iCloudDevice = 0;
	var location = "formatted_address";
	switch(data.what)
	{
		case 'City':
			location = "locality";
			break;
		case 'Address':
			location = "formatted_address";
			break;
		case 'Distance':
			//location = "formatted_address";
			break;
		default:
			location = "formatted_address";
	}
	
	console.log("Connexion "+iCloudUser+"..");
	// Find all devices the user owns
	iPhoneFinder.findAllDevices(iCloudUser, iCloudPass, function(err, devices) {
    //devices.forEach(outputDevice);
	outputDevice(devices[iCloudDevice]);
});

// Output device type, name and location. Includes link to google maps with long/lat set
function outputDevice(device) {
    // Output device information
    console.log('Device Name: ' + device.name);
    console.log('Device Type: ' + device.modelDisplayName);

    // Output location (latitude and longitude)
    var lat = device.location.latitude;
    var lon = device.location.longitude;
    console.log('Lat/Long: ' + lat + ' / ' + lon);

    // Output a url that shows the device location on google maps
    //console.log('View on Map: http://maps.google.com/maps?z=15&t=m&q=loc:' + lat + '+' + lon);
	if(location!="Distance"){
		getAddress(lat, lon);
	}else{
		//Todo
		callback({'tts' : "Calcul de distance pas encore implémenté. Désolé."});
	}
}

function getAddress(lat, lng) {

	var retourTts = "Erreur de localisation";
	var url = 'http://maps.googleapis.com/maps/api/geocode/json?latlng='+lat+','+lng+'&sensor=false';
	var request = require('request');
	  request({ 'uri' : url }, function (err, response, body){
		
		if (err || response.statusCode != 200) {
		  callback({'tts': "L'action a échoué"});
		  return;
		}
			
		console.log("Reverse Geocoding...");
		var result = JSON.parse(body);
		if(typeof result != 'undefined'){
			if(result.status=="OK"){
				var results = result.results;
				var locationFound = '';
				if (results[0]) {
					//formatted address
					if(location=="formatted_address"){
						locationFound = results[0].formatted_address;
					}else{
						//find country name
						for (var i=0; i<results[0].address_components.length; i++) {
							for (var b=0;b<results[0].address_components[i].types.length;b++) {
								if (results[0].address_components[i].types[b] == location){ //"locality") { //"neighborhood" ""administrative_area_level_1") {
									locationFound= results[0].address_components[i].long_name;
									break;
								}
							}
						}
					}
					console.log('Adresse: '+locationFound);
					retourTts = user+" se trouve "+(location=="formatted_address"?" au ":" à ")+locationFound;
					
				} else {
					retourTts = "Aucun emplacement trouvé pour la localisation";
					console.log(retourTts);
				}
				
			}else{
				retourTts = "Erreur de récupération de l'adresse";
				console.log(retourTts);
			}
		}else{
			retourTts = "Aucun resultat";
			console.log(retourTts);
		}
		
		callback({'tts' : retourTts});
		
		
		
		
	  });
	
		
}
	
	

  
  
}