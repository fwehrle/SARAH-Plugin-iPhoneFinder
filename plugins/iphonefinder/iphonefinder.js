const gs_debug=0;
const gs_default_emailicloud="[Email iCloud]";
const gs_default_passwordicloud="[Mot de passe iCloud]";
const gs_libiphonefinder="./lib/iphone-finder.js";

var g_total=0;
var g_xml1="";
var g_xml2="";
var g_xml3="";
var g_listiPhone=new Array();

var bf=require("./basicfunctions.js");
var loc=require("./customloc.js").init(__dirname);
	
///////////////////////////////////////////////////
// TODO:
//	 battery level & recharge...
//	 Chromeless & crash with googlemap loc. (Chromelessa alternative)
///////////////////////////////////////////////////

exports.init=function(SARAH)
{
	var config=SARAH.ConfigManager.getConfig();
	config=config.modules.iphonefinder;
	// Comment the next line when configuration setted
	showAllDevicesAndUpdateXML(config, SARAH);
}

exports.action = function(data, callback, config, SARAH)
{
	var config = config.modules.iphonefinder;
	var iPhoneFinder = require(gs_libiphonefinder);
	var iCloudUser = config.api_login1;
	var iCloudPass = config.api_password1;
	var iCloudDevice = 0;
	var latitude_sarah = config.latitude_sarah;
	var longitude_sarah = config.longitude_sarah;
	var distance = 0;
	var location = "formatted_address";
	var acc = 0;
	
	if (typeof data.mode!=="undefined" && data.mode=="guessit")
	{
	  var spk=bf.getSpeaker(data, true);
	  if (spk!=NULL)
		for (i=0;i<g_listiPhone.length;i++)
		  if (g_listiPhone[i].name.search(new RegExp(spk, "i"))!=-1)
		  {
			data.account=g_listiPhone[i].account;
			data.index=g_listiPhone[i].index;
			break;
		  }
	}
	switch(parseInt(data.account))
	{
		case 1:
			iCloudUser = config.api_login1;
			iCloudPass = config.api_password1;
			break;	
		case 2:
			iCloudUser = config.api_login2;
			iCloudPass = config.api_password2;
			break;
		case 3:
			iCloudUser = config.api_login3;
			iCloudPass = config.api_password3;
			break;
	}

	if ((!config.api_login1)||(!config.api_password1)) 
		return callback({ 'tts': loc.getLocalString("INVALIDCONFIG")});
	else if ((iCloudUser == gs_default_emailicloud) || (iCloudUser == gs_default_passwordicloud))
		return callback({ 'tts': loc.getLocalString("PLEASECONFIGURE")});

	//Selection du device selon utilisateur
	iCloudDevice = data.index;
	
	switch(data.what)
	{
		case "Msg":
			alarm = false;
			subject = data.msg;
			msg = "Envoye par SARAH"; //N'est pas visible?
			iPhoneFinder.sendMsgToDevice(iCloudUser, iCloudPass, iCloudDevice, alarm, subject, msg, 
										function(err, body) 
										{
											//devices.forEach(outputDevice);
											//outputDevice(devices[iCloudDevice]);
											//console.log(body);
											callback({'tts' : loc.getLocalString("MSGSENDED")});
										});
			break;
		case "Alarm":
			alarm = true;
			subject = loc.getLocalString("IPHONELOCATOR");
			msg = "Envoye par SARAH"; //N'est pas visible?
			iPhoneFinder.sendMsgToDevice(iCloudUser, iCloudPass, iCloudDevice, alarm, subject, msg, 
										function(err, body)
										{
											callback({'tts' : loc.getLocalString("ALARMSENDED")});
										});
			break;
		case "Showme":
		default:
			iPhoneFinder.findAllDevices(iCloudUser, iCloudPass,
										function(err, devices) 
										{
											//devices.forEach(outputDevice);
											if ((gs_debug&4)!=0)
												console.log('Localisation Device '+iCloudDevice);
											outputDevice(devices[iCloudDevice]);
										});
			break;
	}


	function outputDevice(device) 
	{
		var retour = "Erreur";
		if ((gs_debug&2)!=0)
			console.log(device);
		if(device===null)
			return callback({'tts' : loc.getLocalString("NOIPHONEFOUND")});
		if(device.location===null)
			return callback({'tts' : loc.getLocalString("NOLOCATIONINFO")});
		// Output device information
		if ((gs_debug&2)!=0)
		{
			console.log('Device id: ' + device.id);
			console.log('Device Name: ' + device.name+', Type: ' + device.modelDisplayName);
		}
		// Output location (latitude and longitude)
		var lat = device.location.latitude;
		var lon = device.location.longitude;
		if ((gs_debug&2)!=0)
		{
			console.log('Lat/Long: ' + lat + ' / ' + lon);
			console.log('View on Map: http://maps.google.com/maps?z=15&t=m&q=loc:' + lat + '+' + lon);
		}
		switch(data.what)
		{
			case 'City':
				getAddress(lat, lon, "locality", -1);
				break;
			case 'Address':
				getAddress(lat, lon, "formatted_address", -1);
				break;
			case 'Distance':
				if(!checkHome(config)) 
					return callback({ 'tts': loc.getLocalString("NOLOCATIONCONFIG")});
				distance = getDistanceFrom(parseFloat(latitude_sarah), parseFloat(longitude_sarah), 0, lat, lon, acc);
				loc.addDictEntry("IPHONE", data.name);
				retour=formatLocationMessage(distance);
				return callback({'tts' : retour});
				break;
			case 'Mix':
				if(!checkHome(config)) 
					return callback({ 'tts': loc.getLocalString("NOLOCATIONCONFIG")});
				distance = getDistanceFrom(parseFloat(latitude_sarah), parseFloat(longitude_sarah), 0, lat, lon, acc);
				getAddress(lat, lon, "locality", distance); //with distance
				break;
			case 'Showme':
				SARAH.chromeless("http://maps.google.com/maps?z=15&t=m&q=loc:" + lat + "+" + lon, 80);
				break;
		}
	}
	
	var formatLocationMessage=function(distance)
	{
		var txt="";
		if (distance<=10)
			txt=loc.getLocalString("IPHONEDIST1");
		else
			if (distance<=1000)
			{
				loc.addDictEntry("DISTANCE", distance);
				txt=loc.getLocalString("IPHONEDIST2");
			}
			else
			{
				loc.addDictEntry("DISTANCE", (distance/1000));
				txt=loc.getLocalString("IPHONEDIST3");
			}				
		return txt;
	}

	function getAddress(lat, lng, location, distance) 
	{
		var retourTts = loc.getLocalString("LOCERROR");
		var url = 'http://maps.googleapis.com/maps/api/geocode/json?latlng='+lat+','+lng+'&sensor=false';
		var request = require('request');
		request({ 'uri' : url }, 
					function (err, response, body)
					{
						if (err || response.statusCode != 200) 
							return callback({'tts' : loc.getLocalString("APPLESITEERROR")});
						if ((gs_debug&1)!=0)
							console.log("Reverse Geocoding...");
						var result = JSON.parse(body);
						if (typeof result != 'undefined')
						{
							if (result.status=="OK")
							{
								var results = result.results;
								var locationFound = '';
								if (results[0]) 
								{
									//formatted address
									if(location=="formatted_address")
										locationFound = results[0].formatted_address;
									else
									{
										//find country name
										for (var i=0; i<results[0].address_components.length; i++)
											for (var b=0;b<results[0].address_components[i].types.length;b++)
												if (results[0].address_components[i].types[b] == location) //"locality") { //"neighborhood" ""administrative_area_level_1") {
												{
													locationFound= results[0].address_components[i].long_name;
													break;
												}
									}
									if ((gs_debug&2)!=0)
										console.log('Adresse: '+locationFound);
									loc.addDictEntry("PHONE", data.name);
									loc.addDictEntry("LOCATION", locationFound);
									if (location=="formatted_address")
										retourTts=loc.getLocalString("IPHONELOC1");
									else
										retourTts=loc.getLocalString("IPHONELOC2");
//									retourTts = data.name +" se trouve "+(location=="formatted_address"?" au ":" à ")+locationFound;
									if(distance>=0)
										retourTts=formatLocationMessage(distance);
									return callback({'tts' : retourTts});
									
								}
								else
									return callback({'tts' : loc.getLocalString("ERRORLOC")});
							}
							else
								return callback({'tts' : loc.getLocalString("ERRORGETLOC")});
						}
						else
							return callback({'tts' : loc.getLocalString("NOLOCRESULT")});
						//callback({'tts' : retourTts});
						
					});
					//returnCallback(retourTts);
	}

	function checkHome(config)
	{
		if ((!config.latitude_sarah) || (!config.longitude_sarah))
			return false;
		else if ((config.latitude_sarah == "") || (config.longitude_sarah == ""))
			return false;
		else
			return true;
	}

	function getDistanceFrom(fromLat, fromLng, fromAcc, lat, lng, acc)
	{
		var delta_lat = fromLat - lat;
		var delta_lon = fromLng - lng;
		var distance  = Math.sin(deg2rad(lat)) * Math.sin(deg2rad(fromLat)) + Math.cos(deg2rad(lat)) * Math.cos(deg2rad(fromLat)) * Math.cos(deg2rad(delta_lon));
		distance  = Math.acos(distance);
		distance  = rad2deg(distance);
		distance  = distance * 60 * 1.1515;
		distance  = distance * 1.609344; //Miles in KM
		distance  = Math.round(distance, 4)*1000; //in meters
		if ((gs_debug&4)!=0)
			console.log("Distance="+distance+"m");
		return distance;
	}

	function deg2rad(angle) 
	{
		// http://kevin.vanzonneveld.net
		// +	 original by: Enrique Gonzalez
		// +	   improved by: Thomas Grainger (http://graingert.co.uk)
		// *	   example 1: deg2rad(45);
		// *	   returns 1: 0.7853981633974483
		return angle * .017453292519943295; // (angle / 180) * Math.PI;
	}
	function rad2deg(angle) 
	{
		// http://kevin.vanzonneveld.net
		// +	 original by: Enrique Gonzalez
		// +		improved by: Brett Zamir (http://brett-zamir.me)
		// *	   example 1: rad2deg(3.141592653589793);
		// *	   returns 1: 180
		return angle * 57.29577951308232; // angle / Math.PI * 180
	}
}

var showAllDevicesAndUpdateXML=function(config, SARAH)
{
	var marr=new Array();
	if (config.api_login1!="" && config.api_login1!=gs_default_emailicloud)
		marr.push({'login': config.api_login1, 'password': config.api_password1});
	if (config.api_login2!="" && config.api_login2!=gs_default_emailicloud)
		marr.push({'login': config.api_login2, 'password': config.api_password2});
	if (config.api_login3="" && config.api_login3!=gs_default_emailicloud)
		marr.push({'login': config.api_login3, 'password': config.api_password3});
	g_total=marr.length;
	g_xml1="		<one-of>\n";
	g_xml2="		<one-of>\n";
	g_xml3="		<one-of>\n";
	for (var i=0;i<g_total;i++)
		findAllDevices(i, marr);
	return 0;
}

var findAllDevices=function(account, marr)
{
	var ipf = require(gs_libiphonefinder);
	ipf.findAllDevices(marr[account].login, marr[account].password, 
					   function(err,devices)
					   {
							var first_iphone=-1;  
							console.log("***Showing devices for account "+(account+1));
							for (var j=0;j<devices.length;j++)
							{
								console.log('  Device #'+j+' Name: ' + devices[j].name + ' Type: '+devices[j].modelDisplayName);
								var re=new RegExp(loc.getLocalString("IPHONEPATTERN"), "i");
								var name=devices[j].name.replace(re, "");
								var line1="			<item>"+devices[j].name+"<tag>out.action.account=\""+(account+1)+"\";out.action.index=\""+j+"\";out.action.name=\""+name+"\";</tag></item>\n";
								var line2="";
								if (devices[j].name!=name)
									line2="			<item>"+name+"<tag>out.action.account=\""+(account+1)+"\";out.action.index=\""+j+"\";out.action.name=\""+name+"\";</tag></item>\n";
								g_xml1+=line1+line2;
								g_xml3+=line1+line2;
								if (devices[j].modelDisplayName=="iPhone")
								{
									if (first_iphone==-1)
										first_iphone=j;
									g_xml2+=line1+line2;
									g_listiPhone.push({'name':name,'account':account+1,'index':j});
								}
									if ((gs_debug&4)!=0)
										console.log(devices[j]);
							}
							if (account==0 && first_iphone!=-1)
							{
								var txt="			<item>"+loc.getLocalString("MYPHONE")+"<tag>out.action.account=\""+(account+1)+"\";out.action.index=\""+first_iphone+"\";out.action.name=\""+loc.getLocalString("YOURPHONE")+"\";out.action.mode=\"guessit\";</tag></item>\n";
								g_xml3+=txt;
								g_xml1+=txt;
							}
							g_total--;
							if (g_total==0)
							{
								g_xml1+="		</one-of>\n";
								g_xml2+="		</one-of>\n";
								g_xml3+="		</one-of>\n";
								bf.replaceSectionInFile(__dirname+"\\iphonefinder.xml", __dirname+"\\iphonefinder.xml", 1, g_xml1);
								bf.replaceSectionInFile(__dirname+"\\iphonefinder.xml", __dirname+"\\iphonefinder.xml", 2, g_xml2);
								bf.replaceSectionInFile(__dirname+"\\iphonefinder.xml", __dirname+"\\iphonefinder.xml", 3, g_xml3);
							}
						});
}