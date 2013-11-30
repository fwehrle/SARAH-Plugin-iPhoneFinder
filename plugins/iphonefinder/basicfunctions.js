/////////////////////////////////////////////
/*
  SARAH project, 
  basic functions for js plugins
  Author:Alban Vidal-Naquet
  Date: 22/11/2013
*/

/////////////////////////////////////////////

// Function speak needed with SARAH v3.X because SARAH.speak function doesn't support concomitant call
function speak(content, SARAH)
{
    if (typeof SARAH.context.isspeaking==="undefined")
	{
		SARAH.context.isspeaking=false;
		SARAH.context.tospeak=new Array();
	}
	if (SARAH.context.isspeaking==true || SARAH.context.tospeak.length>0)
		SARAH.context.tospeak.push(content);
	else
	{
		SARAH.context.isspeaking=true;
		SARAH.speak(content,
					function checkSpeak()
					{
						SARAH.context.isspeaking=false;
						if (SARAH.context.tospeak.length>=1)
						{
							SARAH.context.isspeaking=true;
							var txt=SARAH.context.tospeak[0];
							SARAH.context.tospeak.shift();
							SARAH.speak(txt, checkSpeak);
						}
					});
	}
}

var replaceSectionInFile=function(patternfile, destfile, sectiontagnumber, replacetext)
{
	var fs   = require('fs');
	if (fs.existsSync(patternfile))
	{
		var content    = fs.readFileSync(patternfile,'utf8');
		var tag        = "§"+sectiontagnumber+"[^§]+§"+sectiontagnumber;
		var regexp     = new RegExp(tag,'gm');
		var newcontent = content.replace(regexp, "§" + sectiontagnumber + " -->\n" + replacetext + "<!-- §" + sectiontagnumber);
		fs.writeFileSync(destfile, newcontent, 'utf8');
		return 0;
	}
	return -1;
}

var getSpeaker=function(data, ignoreunknow)
{
  if (typeof data.profile!=="undefined")
  {
    if (ignoreunknow==false){
		return data.profile;
	}else{
	  if (data.profile.search("Unknow")==-1){
	    return data.profile;
	  }
	}
  }
  return "";
}

var sendRequest = function(url, cb, arg, data, callback, config, SARAH)
{
	var request = require('request');
	request({ 'uri' : url, 'headers':{'Accept-Charset':'utf-8'},'encoding':'binary'}, 
			function (err, response, body)
			{
				if (err || response.statusCode != 200) 
				{
					console.log("url " + url + " failed");
					return -1;
				}
				if ((g_debug&1)!=0)
				{
					console.log(url);
				    console.log(body);
				}
				if (typeof cb!=="undefined" && cb!=0)
					cb(arg, body, data, callback, config, SARAH);
			});
	return 0;
}

exports.getSpeaker=getSpeaker;
exports.sendRequest=sendRequest;
exports.replaceSectionInFile=replaceSectionInFile;
exports.speak=speak;