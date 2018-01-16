var http = require('http');
var https = require('https');
var google = require('google');
var logger = require('winston');

google.resultsPerPage = 2;

function handleGoogle(r, text, callback)
{
	if(!text) return;

	google(text, function(err, res)
	{
		r.icon = "https://dl.dropboxusercontent.com/u/314911/img/glogo.png";
		r.command = "Google";
		if(err)
		{
			r.text = "[ERROR] " + err;
		}
		else
		{
			if(res.links.length > 0)
			{
				var link = res.links[0];
				if(link.link == null && res.links.length > 1)
					link = res.links[1];

				r.text = link.link + " | " + link.title;
			}
			else
			{
				r.text = "No results";
			}
		}
		callback(r);
	});
}

function handleTranslate(r, text, callback)
{
	if(!text) return;

	var lang = 'en';
	logger.error(text);
	if(text[0] == '@')
	{
		var sep = text.indexOf(' ');
		if(sep == -1) return;

		lang = text.substr(1, sep - 1);
		text = text.substr(sep);
	}

	logger.error('to: ' + lang);
	var s = 'https://translate.yandex.net/api/v1.5/tr.json/translate?key=' + apikeys.yandexAPIKey + '&lang=' + lang + '&text=' + encodeURIComponent(text);
	logger.error(s);

	https.get(s, function(res)
	{	
		var body = '';
		res.on('data', (data) => body += data);
		res.on('end', () =>
		{
			r.command = "Translate";
			
			var apires = JSON.parse(body);
			logger.error(apires);
			if (res.statusCode == 200)
			{
				r.text = '[' + apires.lang + '] ' + apires.text;
			}
			else
			{
				r.text = 'Error translating (' + apires.message + ')';
			}

			callback(r);
		});
	});	
}

module.exports = {
	"name": "google",
	"author": "MadrMan",
	"commands": {
		"g": handleGoogle,
		"t": handleTranslate
	}
};