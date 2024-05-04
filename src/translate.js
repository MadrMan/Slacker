import logger from 'winston';
import apikeys from './apikeys.js';
import fetch from 'node-fetch';

async function handleTranslate(r, text)
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

	r.command = "Translate";

	logger.error('to: ' + lang);
	var s = 'https://translate.yandex.net/api/v1.5/tr.json/translate?key=' + apikeys.yandexAPIKey + '&lang=' + lang + '&text=' + encodeURIComponent(text);
	logger.error(s);

	const response = await fetch(s);
	const json = await response.json();
	r.text = '[' + json.lang + '] ' + json.text;
	r.text = 'Error translating (' + json.message + ')';
}

export default {
	"name": "translate",
	"author": "MadrMan",
	"commands": {
		"t": handleTranslate
	}
};
