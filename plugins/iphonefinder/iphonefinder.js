///////////////////////////////////////////////////
// TODO:
//	 Chromeless & crash with googlemap loc. (Chromelessa alternative)
///////////////////////////////////////////////////

const gs_debug=1;
const gs_default_emailicloud="[Email iCloud]";
const gs_default_passwordicloud="[Mot de passe iCloud]";
const gs_libiphonefinder="./lib/iphone-finder.js";
// Pull info each 60 minutes
const gs_crontimer=60;
const gs_minbatterylevel=0.10;

var g_total=0;
var g_xml1="";
var g_xml2="";
var g_listiPhone=new Array();
var g_listiDevice=new Array();

var bf=require("./basicfunctions.js");
var loc=require("./customloc.js").init(__dirname);

exports.init=function(SARAH)
{
    var config=SARAH.ConfigManager.getConfig();
    config=config.modules.iphonefinder;
    // Comment the next line when configuration setted
    showAllDevicesAndUpdateXML(config, SARAH);
    if (config.monitorbatterylvl==1)
        setInterval(function(){cronFunc(config, SARAH);}, gs_crontimer*60*1000);
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
        if (spk!="")
            for (var i=0;i<g_listiPhone.length;i++)
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
        default:
            iCloudUser = config.api_login1;
            iCloudPass = config.api_password1;
            break;
    }

    if ((!config.api_login1)||(!config.api_password1))
        return callback({ 'tts': loc.getLocalString("INVALIDCONFIG")});
    else if ((iCloudUser == gs_default_emailicloud) || (iCloudUser == gs_default_passwordicloud))
        return callback({ 'tts': loc.getLocalString("PLEASECONFIGURE")});

    if(data.name==undefined)
        return callback({ 'tts': loc.getLocalString("INVALIDNAME")});

    //Selection du device selon utilisateur
    if(data.index==undefined)
        iCloudDevice = 0;
    else
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
            subject = loc.getLocalString("IDEVICELOCATOR");
            msg = "Envoye par SARAH"; //N'est pas visible?
            iPhoneFinder.sendMsgToDevice(iCloudUser, iCloudPass, iCloudDevice, alarm, subject, msg,
                function(err, body)
                {
                    callback({'tts' : loc.getLocalString("ALARMSENDED")});
                });
            break;
        case "Battery":
            iPhoneFinder.findAllDevices(iCloudUser, iCloudPass,
                function(err, devices)
                {
                    loc.addDictEntry("IDEVICE", translateIDevice(devices[iCloudDevice].modelDisplayName));
                    loc.addDictEntry("VALUE", new Number(devices[iCloudDevice].batteryLevel*100).toPrecision(2));
                    bf.speak(loc.getLocalString("BATTERYLEVEL"), SARAH);
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
        var tssReturn = "Erreur";
        if ((gs_debug&2)!=0)
            console.log(device);
        if((device===null)||(device===undefined))
            return callback({'tts' : loc.getLocalString("NOIDEVICEFOUND")});
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
            //console.log('View on Map: http://maps.google.com/maps?z=15&t=m&q=loc:' + lat + '+' + lon);
        }
        var ttsReturn = "";
        switch(data.what)
        {
            case 'City':
                getAddress(lat, lon, latitude_sarah, longitude_sarah, "locality", "", -1);
                break;
            case 'Address':
                getAddress(lat, lon, latitude_sarah, longitude_sarah, "formatted_address", "", -1);
                break;
            case 'Distance':
                if(!checkHome(config))
                    return callback({ 'tts': loc.getLocalString("NOLOCATIONCONFIG")});
                distance = getDistanceFrom(parseFloat(latitude_sarah), parseFloat(longitude_sarah), 0, lat, lon, acc);
                loc.addDictEntry("IDEVICE",	 translateIDevice(data.name));
                return callback({'tts' : formatLocationMessage(distance)});
                break;
            case 'Duration':
                if(!checkHome(config))
                    return callback({ 'tts': loc.getLocalString("NOLOCATIONCONFIG")});
                getDirection(lat, lon,latitude_sarah, longitude_sarah, "duration", -1, ""); //with distance
                //getAddress(lat, lon, latitude_sarah, longitude_sarah, "locality", "duration", distance);
                break;
            case 'DurationDistance':
                if(!checkHome(config))
                    return callback({ 'tts': loc.getLocalString("NOLOCATIONCONFIG")});
                distance = getDistanceFrom(parseFloat(latitude_sarah), parseFloat(longitude_sarah), 0, lat, lon, acc);
                getDirection(lat, lon,latitude_sarah, longitude_sarah, "duration", distance, ""); //with distance
                //getAddress(lat, lon, latitude_sarah, longitude_sarah, "locality", "duration", distance);
                break;
            case 'Mix':
                if(!checkHome(config))
                    return callback({ 'tts': loc.getLocalString("NOLOCATIONCONFIG")});
                distance = getDistanceFrom(parseFloat(latitude_sarah), parseFloat(longitude_sarah), 0, lat, lon, acc);
                getAddress(lat, lon, latitude_sarah, longitude_sarah, "locality", "", distance); //with distance
                break;
            case 'MixDuration':
                if(!checkHome(config))
                    return callback({ 'tts': loc.getLocalString("NOLOCATIONCONFIG")});
                distance = getDistanceFrom(parseFloat(latitude_sarah), parseFloat(longitude_sarah), 0, lat, lon, acc);
                getAddress(lat, lon, latitude_sarah, longitude_sarah, "locality", "duration", distance); //with distance
                break;
            case 'Showme':
                var url ="https://maps.google.com/maps?z=15&t=m&q=loc:" + lat + "+" + lon+"&output=embed";
                console.log("URL="+url);
                //url="http://maps.google.com/?q=strasbourg&amp;ie=UTF8&amp;hq=&amp;hnear=Strasbourg,+Bas-Rhin,+Alsace,+France&amp;t=h&amp;z=11&amp;ll=48.583148,7.747882&amp;output=embed";
                SARAH.chromeless(url, 80);
                //return callback({ 'tts': loc.getLocalString("SHOWMEMSG")});
                return callback({});
                break;
        }
    }

    var formatLocationMessage=function(distance, pTxt)
    {
        var add="";
        var txt = "";
        if(pTxt!=undefined){
            if(pTxt!=""){
                txt=pTxt+" ";
                add="add";
            }else{
                txt=pTxt;
            }
        }else{
            txt="";
        }
        if (distance<=10)
            txt+=loc.getLocalString("IDEVICEDIST1"+add);
        else
        if (distance<=1000)
        {
            loc.addDictEntry("DISTANCE", distance);
            txt+=loc.getLocalString("IDEVICEDIST2"+add);
        }
        else
        {
            loc.addDictEntry("DISTANCE", (distance/1000));
            txt+=loc.getLocalString("IDEVICEDIST3"+add);
        }
        return txt;
    }

    function getDirection(from_lat, from_lng,to_lat, to_lng, directionMode, distance, retourTts){
        var url = 'http://maps.googleapis.com/maps/api/directions/json?origin='+from_lat+','+from_lng+'&destination='+to_lat+','+to_lng+'&sensor=false';
        if ((gs_debug&1)!=0) console.log(url);
        var request = require('request');
        request({ 'uri' : url },
            function (err, response, body)
            {
                var errorMsg = "";

                if (err || response.statusCode != 200){
                    errorMsg = loc.getLocalString("GOOGLESITEERROR");
                }else{
                    if ((gs_debug&1)!=0) console.log("getting Traffic infos...");
                    var result = JSON.parse(body);
                    if (typeof result != 'undefined')
                    {
                        if (result.status=="OK")
                        {
                            var results = result.routes;
                            var durationFound = -1;
                            if(results === undefined){
                                errorMsg = loc.getLocalString("ERRORDIR");
                            }else{
                                if (results[0])
                                {
                                    //locationFound= results[0].routes[0].legs[0].distance.value; //duration.value
                                    durationFound= results[0].legs[0].duration.text; //duration.value
                                    if ((gs_debug&1)!=0) console.log('Duration: '+durationFound);

                                    loc.addDictEntry("IDEVICE",	 translateIDevice(data.name));
                                    //durationFound=durationFound.replace("mins", " minutes");
                                    durationFound=durationFound.replace("min", " minute");
                                    //durationFound=durationFound.replace("mn", " minute");
                                    
                                    loc.addDictEntry("DURATION", durationFound);
                                    if(distance>=0){
                                        retourTts=formatLocationMessage(distance, retourTts);
                                    }
                                    if(retourTts!=""){//Forme courte
                                        retourTts+=" "+loc.getLocalString("IDEVICEDIR2");
                                    }else{
                                        retourTts+=" "+loc.getLocalString("IDEVICEDIR1");
                                        return callback({'tts' : retourTts});
                                    }
                                }
                                else
                                    errorMsg = loc.getLocalString("ERRORDIR");
                            }
                        }
                        else
                            errorMsg = loc.getLocalString("ERRORGETDUR");
                    }
                    else
                        errorMsg = loc.getLocalString("NORESULT");
                }
                if(errorMsg!="") console.log("ERROR:"+errorMsg);
                if(retourTts!=""){ //On renvoit quand meme le texte d'origine si erreur
                    return callback({'tts' : retourTts});
                }else{
                    return callback({'tts' : errorMsg});
                }
            });


    }
    function getAddress(lat, lng, to_lat, to_lng, locationMode, directionMode, distance)
    {
        var retourTts = loc.getLocalString("LOCERROR");
        var url = 'http://maps.googleapis.com/maps/api/geocode/json?latlng='+lat+','+lng+'&sensor=false';
        var request = require('request');
        request({ 'uri' : url },
            function (err, response, body)
            {
                if (err || response.statusCode != 200)
                    return callback({'tts' : loc.getLocalString("APPLESITEERROR")});
                if ((gs_debug&1)!=0) console.log("Reverse Geocoding...");
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
                            if(locationMode=="formatted_address")
                                locationFound = results[0].formatted_address;
                            else
                            { //find country name
                                for (var i=0; i<results[0].address_components.length; i++)
                                    for (var b=0;b<results[0].address_components[i].types.length;b++)
                                        if (results[0].address_components[i].types[b] == locationMode) //"locality") { //"neighborhood" ""administrative_area_level_1") {
                                        {
                                            locationFound= results[0].address_components[i].long_name;
                                            break;
                                        }
                            }
                            if ((gs_debug&2)!=0) console.log('Adresse: '+locationFound);

                            loc.addDictEntry("IDEVICE",	 translateIDevice(data.name));
                            loc.addDictEntry("LOCATION", locationFound);
                            console.log(locationFound);
                            if (locationMode=="formatted_address")
                                retourTts=loc.getLocalString("IDEVICELOC1");
                            else
                                retourTts=loc.getLocalString("IDEVICELOC2");
                            if(distance>=0){
                                console.log("R1="+retourTts);
                                retourTts=formatLocationMessage(distance, retourTts);
                                console.log("R2="+retourTts);
                            }

                            if(directionMode != ""){
                                if ((gs_debug&2)!=0) console.log('directionMode: '+directionMode);
                                getDirection(lat, lng, to_lat, to_lng, directionMode, -1, retourTts); //On ne revocalise pas la distance
                                //return callback({'tts' : retourTts});
                            }else{
                                return callback({'tts' : retourTts});
                            }
                        }
                        else
                            return callback({'tts' : loc.getLocalString("ERRORLOC")});
                    }
                    else
                        return callback({'tts' : loc.getLocalString("ERRORGETLOC")});
                }
                else
                    return callback({'tts' : loc.getLocalString("NOLOCRESULT")});

            });
        //return callback(retourTts);
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
    g_xml1="";
    g_xml2="		<one-of>\n";
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
                // g_xml2 only fill by iphone devices
                if (devices[j].modelDisplayName=="iPhone")
                {
                    g_xml2+=line1+line2;
                    // save list of iphone for futur use (guessit mode need it !)
                    g_listiPhone.push({'name':name, 'account':account+1, 'index':j, 'model': devices[j].modelDisplayName, 'displayname': devices[j].deviceDisplayName});
                }
                else
                // also save idevices list for futur use...
                    g_listiDevice.push({'name':name, 'account':account+1, 'index':j, 'model':devices[j].modelDisplayName, 'displayname': devices[j].deviceDisplayName});
                if ((gs_debug&4)!=0)
                    console.log(devices[j]);
            }
            g_total--;
            if (g_total==0)
            {
                g_xml1+="";
                g_xml2+="		</one-of>\n";
                bf.replaceSectionInFile(__dirname+"\\iphonefinder.xml", __dirname+"\\iphonefinder.xml", 1, g_xml1);
                bf.replaceSectionInFile(__dirname+"\\iphonefinder.xml", __dirname+"\\iphonefinder.xml", 2, g_xml2);
                bf.replaceSectionInFile(__dirname+"\\iphonefinder.xml", __dirname+"\\iphonefinder.xml", 3, g_xml1);
            }
        });
}

var	 translateIDevice=function(name)
{
    var txt = (name!=undefined?name:"");
    if(txt!=""){
        var re=new RegExp("ipad","i");
        txt=txt.replace(re, loc.getLocalString("TRANSLATEIPAD"));

        re=new RegExp("iphone","i");
        txt = txt.replace(re, loc.getLocalString("TRANSLATEIPHONE"));
    }
    return txt
}

function cronFunc(config, SARAH)
{
    var iCloudUser = config.api_login1;
    var iCloudPass = config.api_password1;
    for (var i=0;i<3;i++)
    {
        switch(i)
        {
            case 0:
                iCloudUser = config.api_login1;
                iCloudPass = config.api_password1;
                break;
            case 1:
                iCloudUser = config.api_login2;
                iCloudPass = config.api_password2;
                break;
            case 2:
                iCloudUser = config.api_login3;
                iCloudPass = config.api_password3;
                break;
        }
        if (iCloudUser!="" && iCloudUser!=gs_default_emailicloud)
        {
            var iPhoneFinder = require(gs_libiphonefinder);
            iPhoneFinder.findAllDevices(iCloudUser, iCloudPass,
                function(err, devices)
                {
                    for (var j=0;j<devices.length;j++)
                    {
                        if (devices[j].batteryLevel<gs_minbatterylevel && devices[j].batteryStatus=="NotCharging")
                        {
                            loc.addDictEntry("IDEVICE", translateIDevice(devices[j].modelDisplayName));
                            loc.addDictEntry("NAME",  translateIDevice(devices[j].name));
                            loc.addDictEntry("VALUE", new Number(devices[j].batteryLevel*100).toPrecision(2));
                            if ((gs_debug&4)!=0)
                                console.log(loc.getLocalString("NOMOREBATTERIES"));
                            bf.speak(loc.getLocalString("NOMOREBATTERIES"), SARAH);
                        }
                    }
                })
        }
    }
}
