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
					"windDirection": 'Wind'
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
				getWeatherForLatLong(
					(err, data) => {
						r.text = data.text;
						r.icon = data.icon;
						callback( r );
					},
					apires.formatted_address,
					apires.geometry.location.lat,
					apires.geometry.location.lng );
			}
			else
			{
				r.text = "Google GeoCode ERROR: " + apires.status;
				callback(r);
			}
		});
	});
}

module.exports = {
	"name": "weather",
	"author": "MadrMan, John Vidler",
	"commands": {
		"weather": handleWeather
	}
}