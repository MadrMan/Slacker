import logger from 'winston';
import apikeys from './apikeys.js';
import https from 'https';

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

export default {
	"name": "translate",
	"author": "MadrMan",
	"commands": {
		"t": handleTranslate
	}
};
