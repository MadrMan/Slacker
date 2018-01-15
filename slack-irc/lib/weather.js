var async = require('async');
var http = require('http');
var https = require('https');
var apikeys = require('./apikeys');

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
				let data = {
					"weather":       apijson.weather[0],
					"wind":          apijson.wind,
					"main":          apijson.main,
					"celsius":       parseFloat(main.temp) - 273.15,
					"prettyDesc":    weather.description.charAt(0).toUpperCase() + weather.description.slice(1),
					"prettyAddress": address + " | " + apijson.name,
					"windSpeed":     parseFloat(wind.speed) * 3.6,
					"windSpeedMph":  windSpeed * 0.621371192,
					"windDirection": 'Wind',
					"score":         0        // Dummy value for if we're doing a 'Top Trumps' thing with this data - saves iterating over it later... -John
				};
				
				if (data.windSpeed > 1)
				{
					let windDirections = [ 'North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest' ];
					let currentQuadrant = Math.round(parseFloat(wind.deg) / (360.0 / windDirections.length));
					data.windDirection = windDirections[currentQuadrant % windDirections.length] + ' wind';
				}

				data.text = prettyAddress + " | " + prettyDesc + ", " + celsius.toFixed(1) + '\xB0C (' + (celsius * 1.8 + 32).toFixed(1) + '\xB0F) | ' + windDirection + ' ' + windSpeed.toFixed(1) + ' km/h (' + windSpeedMph.toFixed(1) + ' mph)';
				data.icon = 'http://openweathermap.org/img/w/' + weather.icon + '.png';
			}
			else
			{
				callback( "OpenWeatherMap ERROR: " + apijson.message, null);
			}
			callback(null, data);
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

module.exports = {
	"name": "weather",
	"author": "MadrMan, John Vidler",
	"commands": {
		"weather": handleWeather
	}
}
