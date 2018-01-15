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
				r.text = "Google GeoCode ERROR: " + apires.status;
				callback(r, null);
			}
		});
	});
}

function handleWeather(r, text, callback)
{
	if (!text) return;

	let targets = [];

	for( let i=0; i<text.split("vs"); i++ )
		targets.push( text[i].trim() );

	async.parallel(
		[
			(next) => { getWeatherData() }
		],
		(err) => {
			//
		}
	);
	getWeatherData( text, (err, data) => { r.text = data.text; r.icon = data.icon; callback( r ); } );
}

module.exports = {
	"name": "weather",
	"author": "MadrMan, John Vidler",
	"commands": {
		"weather": handleWeather
	}
}


let text = " Lancaster,UK vs London,UK vs Manchester,UK ".trim();
let locations = text.split("vs");
if( locations.length > 1 ) {
	let targets = [];

	for( let i=0; i<locations.length; i++ )
		targets.push( locations[i].trim() );

	async.eachOf(
		targets,
		(item, index, _next) => {
			console.log( item );
			/*getWeatherData( item, (err,data) => {
				targets[index] = data;
				_next();
			} );*/
			_next();
		},
		(err) => {
			if( err ) {
				console.log( "Unable to query one or more location :(" );
				return;
			}

			// Dummy Data
			for( let i=0; i<targets.length; i++ ) {
				let loc = targets[i];
				targets[i] = {};
				targets[i].name = `Location ${i}`;
				targets[i].prettyAddress = `${loc}`;
				targets[i].valueA = Math.random() * 10;
				targets[i].valueB = Math.random() * 10;
				targets[i].valueC = Math.random() * 10;
				targets[i].score = 0;
			}

			for( let k in targets[0] ) {
				if( k == "score" )
					continue;

				let winner = targets[0];

				for( let i=1; i<targets.length; i++ ) {
					let a = parseFloat(targets[i][k], 10);
					let b = parseFloat(winner[k], 10);

					console.log( a, b, (a > b?targets[i].name:winner.name) );

					if( !isNaN(a) && !isNaN(b) && a > b )
						winner = targets[i];
				}
				winner.score++;
			}

			console.log( targets );

			let winner = targets[0];
			for( let i=1; i<targets.length; i++ ) {
				if( targets[i].score > winner.score )
					winner = targets[i];
			}

			console.log( `Winner: ${winner.prettyAddress} with ${winner.score} points!` );
		}
	);
}