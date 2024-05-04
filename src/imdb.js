import logger from './logging.js';
import imdb from 'imdb-api';

function prettyPrintImdb(r, things)
{
	r.text = "\"" + things.title + "\" | Rating: " + things.rating + " | " + things.imdburl;

	r.attachment = {
		"fallback" : r.text,
		"title" : things.title + " (" + things.released.getFullYear() + ")",
		"title_link" : things.imdburl,
		"image_url": things.poster,
		"text": things.plot,
		"fields": [
		{
			"title" : "Actors",
			"value" : things.actors,
			"short" : false
		},
		{
			"title" : "Runtime",
			"value" : things.runtime,
			"short" : true
		},
		{
			"title" : "Genres",
			"value" : things.genres,
			"short" : true
		},
		{
			"title" : "Director",
			"value" : things.director,
			"short" : true
		},
		{
			"title" : "Rating",
			"value" : things.rating,
			"short" : true
		}
		]
	};
}

async function handleImdb(r, text)
{
	if(!text) return;

	var req = { name: text, year: undefined };
	
	var re = /\((\d+)\)/;
	match = text.match(re);
	if(match) {
		var year = parseInt(match[1]);
		req =  { name: text.replace(re, "").trim(), year: year };
	}

	logger.error("Looking up IMDB entry for \"" + req.name + "\", year: " + req.year);

	await new Promise(resolve, reject, () => {
		imdb.getReq(req, (err, things) => {
			r.command = "IMDb";
			r.icon = "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/IMDB_Logo_2016.svg/1200px-IMDB_Logo_2016.svg.png";

			if(err) {
				r.text = err.message;
			} else {
				prettyPrintImdb(r, things);
			}

			resolve();
		});
	});
}

export default {
	"name": "imdb",
	"author": "MadrMan",
	"commands": {
		"imdb" : handleImdb
	}
};
