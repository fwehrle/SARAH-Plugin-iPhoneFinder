exports.action = function(data, callback, config, SARAH) {
  var config = config.modules.iphonefinder;
  var exec = require('child_process').exec;
  var util = require('util');
	var iPhoneFinder = require('./lib/iphone-finder.js');
	var iCloudUser = config.api_login;
	var iCloudPass = config.api_password;
	var iCloudDevice = 0;
	var latitude_sarah = config.latitude_sarah;
	var longitude_sarah = config.longitude_sarah;
	var distance = 0;
	var location = "formatted_address";
	var acc = 0;
	
	if ((!config.api_login)||(!config.api_password)) {
        return callback({ 'tts': 'Configuration invalide' });
    }else if ((iCloudUser == "[Email iCloud]") || (iCloudUser == "[Mot de passe iCloud]")){
		return callback({ 'tts': 'Veuillez configurer le module' });
	}
	
	console.log("Connexion "+iCloudUser);
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
	if(data.what=='Msg'){
		alarm = false;
		subject = (!data.msg?"Hello! C'est SARAH.":data.msg);
		msg = "message"; //N'est pas visible?
		iPhoneFinder.sendMsgToDevice(iCloudUser, iCloudPass, iCloudDevice, alarm, subject, msg, function(err, body) {
			//devices.forEach(outputDevice);
			//outputDevice(devices[iCloudDevice]);
			//console.log(body);
			callback({'tts' : "J'ai envoyé le message."});
		});
	}else if (data.what=="Alarm"){
		alarm = true;
		subject = "ALARM";
		msg = "ALARM."; //N'est pas visible?
		iPhoneFinder.sendMsgToDevice(iCloudUser, iCloudPass, iCloudDevice, alarm, subject, msg, function(err, body) {
			callback({'tts' : "J'ai envoyé une alarme."});
		});
	}else{
		iPhoneFinder.findAllDevices(iCloudUser, iCloudPass, function(err, devices) {
			//devices.forEach(outputDevice);
			console.log('Localisation Device '+iCloudDevice);
			outputDevice(devices[iCloudDevice]);
		});
	}
	//sendDeviceMsg
// Output device type, name and location. Includes link to google maps with long/lat set
function outputDevice(device) {
if(device===null){
	return callback({'tts' : "Aucun téléphone récupéré."});
}
if(device.location===null){
	return callback({'tts' : "Aucune information de localisation disponible."});
}
	var retour = "Erreur";
    // Output device information
    console.log('Device Name: ' + device.name+', Type: ' + device.modelDisplayName);
	//console.log('Device id: ' + device.id);
   // console.log('Device Type: ' + device.modelDisplayName);
    // Output location (latitude and longitude)
    var lat = device.location.latitude;
    var lon = device.location.longitude;
    console.log('Lat/Long: ' + lat + ' / ' + lon);

    //console.log('View on Map: http://maps.google.com/maps?z=15&t=m&q=loc:' + lat + '+' + lon);
	switch(data.what)
	{
		case 'City':
			getAddress(lat, lon, "locality", -1);
			break;
		case 'Address':
			getAddress(lat, lon, "formatted_address", -1);
			break;
		case 'Distance':
			if(!checkHome(config)) return callback({ 'tts': 'Veuillez configurer votre position pour utiliser cette fonction.' });
			distance = getDistanceFrom(parseFloat(latitude_sarah), parseFloat(longitude_sarah), 0, lat, lon, acc);
			retour = user+(distance<=10?" ne se trouve pas très loin.": " est à "+(distance<=1000?distance+" mètres":(distance/1000)+" kilomètres"));
			return callback({'tts' : retour});
			break;
		case 'Mix':
			if(!checkHome(config)) return callback({ 'tts': 'Veuillez configurer votre position pour utiliser cette fonction.' });
			distance = getDistanceFrom(parseFloat(latitude_sarah), parseFloat(longitude_sarah), 0, lat, lon, acc);
			getAddress(lat, lon, "locality", distance); //with distance
			break;
	}
}

function getAddress(lat, lng, location, distance) {
	var retourTts = "Erreur de localisation";
	var url = 'http://maps.googleapis.com/maps/api/geocode/json?latlng='+lat+','+lng+'&sensor=false';
	var request = require('request');
	  request({ 'uri' : url }, function (err, response, body){
		
		if (err || response.statusCode != 200) {
		  //callback({'tts': "L'action a échoué"});
		  //return;
		  return callback({'tts' : "Je n'ai pas réussi à me connecter aux serveur d'Apple"});
		}
		//console.log("Reverse Geocoding...");
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
					if(distance>=0){
						retourTts = retourTts + (distance<=10?" pas très loin.": " à "+(distance<=1000?distance+" mètres.":(distance/1000)+" kilomètres."))
					}
					return callback({'tts' : retourTts});
					
				} else {
					return callback({'tts' : "Aucun emplacement trouvé pour la localisation"});
				}
			}else{
				return callback({'tts' : "Erreur de récupération de l'adresse"});
			}
		}else{
			return callback({'tts' : "Aucun resultat"});
		}
		
		//callback({'tts' : retourTts});
		
	  });
	//returnCallback(retourTts);
}

function checkHome(config){
	if ((!config.latitude_sarah) || (!config.longitude_sarah)){
		return false;
	}else if ((config.latitude_sarah == "") || (config.longitude_sarah == "")){
		return false;
	}else{
		return true;
	}
}

function getDistanceFrom(fromLat, fromLng, fromAcc, lat, lng, acc){
	var delta_lat = fromLat - lat;
	var delta_lon = fromLng - lng;
	var distance  = Math.sin(deg2rad(lat)) * Math.sin(deg2rad(fromLat)) + Math.cos(deg2rad(lat)) * Math.cos(deg2rad(fromLat)) * Math.cos(deg2rad(delta_lon));
	distance  = Math.acos(distance);
	distance  = rad2deg(distance);
	distance  = distance * 60 * 1.1515;
	distance  = distance * 1.609344; //Miles in KM
	distance  = Math.round(distance, 4)*1000; //in meters
	console.log("Distance="+distance+"m");
	return distance;
}

function deg2rad (angle) {
  // http://kevin.vanzonneveld.net
  // +   original by: Enrique Gonzalez
  // +     improved by: Thomas Grainger (http://graingert.co.uk)
  // *     example 1: deg2rad(45);
  // *     returns 1: 0.7853981633974483
  return angle * .017453292519943295; // (angle / 180) * Math.PI;
}
function rad2deg (angle) {
  // http://kevin.vanzonneveld.net
  // +   original by: Enrique Gonzalez
  // +      improved by: Brett Zamir (http://brett-zamir.me)
  // *     example 1: rad2deg(3.141592653589793);
  // *     returns 1: 180
  return angle * 57.29577951308232; // angle / Math.PI * 180
}

}