var async = require('async');
var http = require('http');
var https = require('https');
var logger = require('winston');
var apikeys = require('./apikeys');
var request = require('request');

const pollen_icons = {
	"Error":     "http://johnvidler.co.uk/icon/pollen/low.png",
	"Default":   "http://johnvidler.co.uk/icon/pollen/low.png",
	"Low":       "http://johnvidler.co.uk/icon/pollen/low.png",
	"Moderate":  "http://johnvidler.co.uk/icon/pollen/moderate.png",
	"High":      "http://johnvidler.co.uk/icon/pollen/high.png",
	"Very High": "http://johnvidler.co.uk/icon/pollen/very-high.png"
}

function getWeatherForLatLong(callback, address, lat, lng)
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
				let weather = apijson.weather[0];
				let windSpeed = parseFloat(apijson.wind.speed) * 3.6;
				let data = {
					"weather":       weather,
					"wind":          apijson.wind,
					"main":          apijson.main,
					"celsius":       parseFloat(apijson.main.temp) - 273.15,
					"prettyDesc":    weather.description.charAt(0).toUpperCase() + weather.description.slice(1),
					"prettyAddress": address + " | " + apijson.name,
					"windSpeed":     windSpeed,
					"windSpeedMph":  windSpeed * 0.621371192,
					"windDirection": 'Wind',
					"score":         0        // Dummy value for if we're doing a 'Top Trumps' thing with this data - saves iterating over it later... -John
				};
				
				if (data.windSpeed > 1)
				{
					let windDirections = [ 'North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest' ];
					let currentQuadrant = Math.round(parseFloat(data.wind.deg) / (360.0 / windDirections.length));
					data.windDirection = windDirections[currentQuadrant % windDirections.length] + ' wind';
				}

				data.text = data.prettyAddress + " | " + data.prettyDesc + ", " + data.celsius.toFixed(1) + '\xB0C (' + (data.celsius * 1.8 + 32).toFixed(1) + '\xB0F) | ' + data.windDirection + ' ' + data.windSpeed.toFixed(1) + ' km/h (' + data.windSpeedMph.toFixed(1) + ' mph)';
				data.icon = 'http://openweathermap.org/img/w/' + weather.icon + '.png';

				callback(null, data);
			}
			else
			{
				callback( "OpenWeatherMap ERROR: " + apijson.message, null);
			}
		});
	});
}

function getWeatherData( location, callback )
{
	https.get("https://maps.googleapis.com/maps/api/geocode/json?address=" + encodeURIComponent(location) + "&key=" + apikeys.googleAPIKey, function(res)
	{
		var body = '';
		res.on('data', (data) => body += data);
		res.on('end', () =>
		{
			var apires = JSON.parse(body);
			if (apires.results.length > 0)
			{
				apires = apires.results[0];
				getWeatherForLatLong( callback,
					apires.formatted_address,
					apires.geometry.location.lat,
					apires.geometry.location.lng );
			}
			else
			{
				callback(`Google GeoCode ERROR: ${apires.status}`, null);
			}
		});
	});
}

function handleWeather(r, text, callback)
{
	if (!text) return;

	text = text.trim(); // Just in case :/
	let locations = text.split("vs");

	if( locations.length == 1 )
		return getWeatherData( text, (err, data) => {
			if( err ) {
				r.text = err;
				return callback( r );
			}
			r.text = data.text;
			r.icon = data.icon;
			callback( r );
		} );

	if( locations.length > 1 ) {
		let targets = [];

		for( let i=0; i<locations.length; i++ )
			targets.push( locations[i].trim() );

		async.eachOf(
			targets,
			(item, index, _next) => {
				getWeatherData( item, (err,data) => {
					targets[index] = data;
					_next( err );
				} );
			},
			(err) => {
				if( err ) {
					r.text = err;
					callback( r );
					return;
				}

				for( let k in targets[0] ) {
					if( k == "score" )
						continue;

					let winner = targets[0];

					for( let i=1; i<targets.length; i++ ) {
						let a = parseFloat(targets[i][k], 10);
						let b = parseFloat(winner[k], 10);

						if( !isNaN(a) && !isNaN(b) && a > b )
							winner = targets[i];
					}
					winner.score++;
				}

				let winner = targets[0];
				for( let i=1; i<targets.length; i++ ) {
					if( targets[i].score > winner.score )
						winner = targets[i];
				}

				r.text = `Winner: ${winner.prettyAddress} with ${winner.score} points! (${winner.text})`;
				r.icon = winner.icon;
				return callback( r );
			}
		);

		return;
	}

	r.text = "Eh, what? Need at least one location to get the weather!";
	return callback( r ); // return by convention, pointless here though. -John.
}

function getPollenLatLng( lat, lng, callback ) {
	lat = lat || '54.0466';
	lng = lng || '2.8007';
	var base_url = 'https://socialpollencount.co.uk/api/forecast?location=';
	var url = base_url+'['+lat+','+lng+']';

	var today = new Date().toISOString().substr(0,10);

	if ( !String.prototype.contains ) {
		String.prototype.contains = function() {
			return String.prototype.indexOf.apply( this, arguments ) !== -1;
		};
	}

	request(
		{
			url: url,
			json: true
		},
		function (error, response, body) {
			if (error)
				return callback( error, null )

			if (response.statusCode === 200) {
				for( let i=0; i<body.forecast.length; i++ ) {
					let item = body.forecast[i];
					if (item.date.contains(today)) {
						return callback( null, item.pollen_count );
					}
				};
			}

			callback( "Web request error", null );
		}
	);
}

function getLatLng( location, callback ) {
	https.get("https://maps.googleapis.com/maps/api/geocode/json?address=" + encodeURIComponent(location) + "&key=" + apikeys.googleAPIKey, function(res)
	{
		var body = '';
		res.on('data', (data) => body += data);
		res.on('end', () =>
		{
			var apires = JSON.parse(body);
			if (apires.results.length > 0)
			{
				apires = apires.results[0];
				return callback( null, apires.formatted_address, apires.geometry.location.lat, apires.geometry.location.lng );
			}
			
			return callback( `Google GeoCode ERROR: ${apires.status}`, null, null, null );
		});
	});
}

function handlePollen(r, text, callback)
{
	if (!text) return;
	text = text.trim();
	r.icon = pollen_icons.Default;

	getLatLng( text, (err, addr, lat, lng) => {
		if( err ) {
			r.text = "Sorry, Google doesn't know where that location is :(";
			r.icon = pollen_icons.Error;
			return callback( r );
		}

		getPollenLatLng( lat, lng, (err, result) => {
			if( err ) {
				r.text = "No data for that location :(";
				r.icon = pollen_icons.Error;
				return callback( r );
			}
			r.text = `Pollen for ${text} is ${result}`;
			if( pollen_icons[text] )
				r.icon = pollen_icons[text];
			return callback( r );
		} )

	} );
}

module.exports = {
	"name": "weather",
	"author": "MadrMan, John Vidler",
	"commands": {
		"weather": handleWeather,
		"pollen": handlePollen
	}
};
