var http = require('http');
var https = require('https');
var logger = require('winston');
var google = require('google');
var MathParse = require('expr-eval').Parser;
var imdb = require('imdb-api');
var apikeys = require('./apikeys');

google.resultsPerPage = 2;

function getWeatherForLatLong(r, callback, address, lat, lng)
{
	var url = "http://api.openweathermap.org/data/2.5/weather?lat=" + lat + "&lon=" + lng + "&APPID=" + apikeys.openweathermapAPIKey;
	logger.error(url);

	http.get(url, function(res) {
		var body = '';
		res.on('data', (data) => body += data);
		res.on('end', () =>
		{
			var apijson = JSON.parse(body);
			logger.error(apijson);
			var status = apijson.cod;
			if (status == "200")
			{
				var weather = apijson.weather[0];
				var wind = apijson.wind;
				var main = apijson.main;
				var celsius = parseFloat(main.temp) - 273.15;
				var prettyDesc = weather.description.charAt(0).toUpperCase() + weather.description.slice(1);
				var prettyAddress = address + " | " + apijson.name;
				var windSpeed = parseFloat(wind.speed) * 3.6;
				var windSpeedMph = windSpeed * 0.621371192;
				var windDirection = 'Wind';
				
				if (windSpeed > 1)
				{
					var windDirections = [ 'North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest' ];
					var currentQuadrant = Math.round(parseFloat(wind.deg) / (360.0 / windDirections.length));
					windDirection = windDirections[currentQuadrant % windDirections.length] + ' wind';
				}

				r.text = prettyAddress + " | " + prettyDesc + ", " + celsius.toFixed(1) + '\xB0C (' + (celsius * 1.8 + 32).toFixed(1) + '\xB0F) | ' + windDirection + ' ' + windSpeed.toFixed(1) + ' km/h (' + windSpeedMph.toFixed(1) + ' mph)';
				r.icon = 'http://openweathermap.org/img/w/' + weather.icon + '.png';
			}
			else
			{
				r.text = "OpenWeatherMap ERROR: " + apijson.message;
			}
			callback(r);
		});
	});
}

function handleWeather(r, text, callback)
{
	if (!text) return;

	https.get("https://maps.googleapis.com/maps/api/geocode/json?address=" + encodeURIComponent(text) + "&key=" + apikeys.googleAPIKey, function(res)
	{
		var body = '';
		res.on('data', (data) => body += data);
		res.on('end', () =>
		{
			var apires = JSON.parse(body);
			if (apires.results.length > 0)
			{
				apires = apires.results[0];
				getWeatherForLatLong(r, callback, apires.formatted_address, apires.geometry.location.lat, apires.geometry.location.lng);
			}
			else
			{
				r.text = "Google GeoCode ERROR: " + apires.status;
				callback(r);
			}
		});
	});
}

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

function handleRoll(r, text, callback)
{
	if(!text) return;

	var p = text.split(/[d\-\+]/);
	var dice = p.length > 1 ? parseInt(p[0]) : 1;
	var sides = p.length > 1 ? parseInt(p[1]) : parseInt(p[0]);
	var base = p.length > 2 ? parseInt(p[2]) : 1;
	if(text.indexOf('-') > -1) base *= -1;
	var v = base * dice + Math.floor(Math.random() * dice * (sides - 1));
	
	r.command = "Roll";
	r.text = "You rolled: " + v;
	r.icon = "http://homepage.hispeed.ch/~grrds_games/Dice/images/dice.png";
	callback(r);
}

function handleSource(r, text, callback)
{
	r.command = "Source";
	r.text = "https://github.com/MadrMan/Slacker";
	r.icon = "https://assets-cdn.github.com/images/modules/logos_page/Octocat.png";

	callback(r);
}

function handleCalc(r, text, callback) 
{
	if(!text) return;

	try {
		var expr = MathParse.parse(text);
		r.text = expr.toString() + " = " + expr.evaluate({});
	} catch(err) {
		r.text = text + " = [" + err + "]";
	}

	r.command = "Calc";
	r.icon = "https://i.vimeocdn.com/portrait/9922894_300x300";
	callback(r);
}

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

function handleImdb(r, text, callback)
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

	imdb.getReq(req, (err, things) => {
		r.command = "IMDb";
		r.icon = "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/IMDB_Logo_2016.svg/1200px-IMDB_Logo_2016.svg.png";

		if(err) {
			r.text = err.message;
		} else {
			prettyPrintImdb(r, things);
		}

		callback(r);
	});
}

function makeTwitchOptions(url)
{
	var options = {
		host: 'api.twitch.tv',
		port: 443,
		path: url,
		method: 'GET',
		headers: {
			'Client-ID': apikeys.twitchClientID
		}
	}

	return options;
}

function prettyPrintTwitch(r, userLogin, userDisplay, stream)
{
	var streamUrl = "https://twitch.tv/" + userLogin;
	var announce = userDisplay + " is now streaming!";
	r.text = announce + " [ " + streamUrl + " ]";

	r.attachment = {
		"fallback" : r.text,
		"title" : announce,
		"title_link" : streamUrl,
		"image_url": stream.thumbnail_url.replace("{width}", "512").replace("{height}", "288"),
		"text": stream.title,
		"color": "#6441A5"
		//"fields": 
		//[
		//	{
		// 		"title" : "Viewers",
		//		"value" : stream.viewer_count,
		//		"short" : false
		//	}
		//]
	};
}

function printTwitchUpdateForStream(r, data, callback)
{
	var options = makeTwitchOptions("/helix/users?id=" + data.user_id);
	https.get(options, function(res) {
		var body = '';
		res.on('data', (data) => body += data);
		// res.on('error', (e) => console.error(e));
		res.on('end', () => {
			var apires = JSON.parse(body);
			logger.error(apires);

			if (res.statusCode == 200) {
				prettyPrintTwitch(r, apires.data[0].login, apires.data[0].display_name, data);
				callback(r);
			} else {
				// Something blew up
			}
		});
	});
}

twitchOnlineStreams =[];
// twitchUserList = [ "madflux", "tuireanntv", "thothonegan" ];
twitchUserList = [ "tuireanntv", "thothonegan" ];

function twitchOnlineCheck(r, text, callback)
{
	r.icon = "https://vignette3.wikia.nocookie.net/logopedia/images/8/83/Twitch_icon.svg/revision/latest?cb=20140727180700";

	var isManualCheck = (text != null);
	var usersToCheck;
	if (isManualCheck) {
		usersToCheck = [ text ];
	} else {
		usersToCheck = twitchUserList;
	}

	var url = "/helix/streams?";
	usersToCheck.forEach(function(user) {
		url += "&user_login=" + user;
	});

	https.get(makeTwitchOptions(url), function(res) {	
		var body = '';
		res.on('data', (data) => body += data);
		// res.on('error', (e) => console.error(e));
		res.on('end', () => {
			var apires = JSON.parse(body);
			logger.error(res.statusCode);
			logger.error(apires);
			if (res.statusCode == 200) {
				if (apires.data.length == 0 && isManualCheck) {
					r.text = usersToCheck[0] + " is offline";
					callback(r);
				} else {
					var currentOnlineStreams = [];

					apires.data.forEach(function(stream)  {
						currentOnlineStreams.push(stream.id);

						if (!twitchOnlineStreams.includes(stream.id))
						{
							// New stream, show update
							printTwitchUpdateForStream(r, stream, callback);
						}
					});

					twitchOnlineStreams = currentOnlineStreams;	
				}
			} else {
				// Something blew up
			}
		});
	});
}

var commandList = {
	"weather": handleWeather,
	"g": handleGoogle,
	"t": handleTranslate,
	"roll" : handleRoll,
	"calc" : handleCalc,
	"imdb" : handleImdb,
	"twitch" : twitchOnlineCheck,
	"source" : handleSource
};

function makeR(cmd)
{
	var prettyCommand = cmd.charAt(0).toUpperCase() + cmd.slice(1);

	return {
		command: prettyCommand,
		icon: null,
 		text: '<empty>'
	};
}

exports.initializeIntervals = function(callback)
{
	logger.debug("Setting up bot interval-based checks...");

	setInterval(function() {
		// logger.debug("Performing twitch check...");

		twitchOnlineCheck(makeR("twitch"), null, function(r) {
			callback(r, "#lobby");
		});
	}, 60 * 1000);
}

exports.processUserCommand = function(text, callback)
{
	if(text[0] != '!') return;

	var sep = text.toLowerCase();
	var space = sep.indexOf(' ');
	sep = (space == -1) ? [ sep ] : [ sep.substr(0, space), sep.substr(space + 1) ];
	sep[0] = sep[0].slice(1); // strip '!'

	var r = makeR(sep[0]);
	var handler = commandList[sep[0]];
	if (handler)
	{
		logger.error("Handling command: " + sep[0]);
		handler(r, sep.length > 1 ? sep[1] : null, callback);
	}
}
