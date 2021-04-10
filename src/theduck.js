"use strict";

const logger = require('./logging');
const url    = require("url");
const https  = require("https");

const DEFAULT_ICON = "https://www.dropbox.com/s/7bld06j73430799/duck.png?raw=1"; // Stupid duck icon, naturally facing the wrong way :P

const DUCK_API_HOST = "api.duckduckgo.com";
const DUCK_API_PORT = 443;

const WIKI_API_HOST = "en.wikipedia.org";
const WIKI_API_PORT = 443;

function upperCaseFirst( _in ) {
	return _in[0].toUpperCase() + _in.substring(1);
}

function quackipedia( topic, callback ) {
	if( topic == undefined || topic == null )
		return;

	topic = upperCaseFirst( topic.trim() );

	const req = https.request( {
		hostname: WIKI_API_HOST,
		port: WIKI_API_PORT,
		path: `/api/rest_v1/page/summary/${encodeURIComponent(topic)}`,
		method: 'GET'
	}, (res) => {
		let _buffer = "";
		res.on( 'data', (d) => { _buffer += d.toString(); });
		res.on( 'end', () => {
			if( _buffer.length > 0 )
				return callback( null, JSON.parse(_buffer) );

			// Try and de-pluralize as a last resort...
			if( topic.endsWith('s') )
				return quackipedia( topic.substring( 0, topic.length-1 ), callback );

			// Give up :<
			callback( null, null );
		} );
	});

	req.on( 'error', (e) => callback( e, null ) );
	req.end();
}

async function duckQuery( params, callback ) {
	let searchParts = [];
	for( let key in params )
		searchParts.push( encodeURIComponent(key) + "=" + encodeURIComponent(params[key]) );

	const req = https.request( {
		hostname: DUCK_API_HOST,
		port: DUCK_API_PORT,
		path: '/?' +searchParts.join('&'),
		method: 'GET'
	}, (res) => {
		let _buffer = "";
		res.on( 'data', (d) => { _buffer += d.toString(); });
		res.on( 'end', () => callback( null, JSON.parse(_buffer) ) );
	});

	req.on( 'error', (e) => callback( e, null ) );
	req.end();
}

function _question( text, callback ) {
	let composedQuery = text;

	try {
		// Simple (read terrible) subject identifier
		let stripWords = [ "define", "is", "a", "are", "the", "this", "that", "about"];
		let regex = new RegExp(`\\s*(${stripWords.join('|')})\\s+(.*)\\\\?$`);

		let subjectMatch = text.match( regex );
		let subject = subjectMatch[2];

		for( let word in stripWords ) {
			let search = new RegExp(`\\s*(${stripWords[word]}\\s+)`);
			subject = subject.replace( search, "" );
		}
		subject = subject.replace("?", "");

		duckQuery( {
			"q": composedQuery,
			"format": "json",
			"no_html": 1
		}, ( err, data ) => {
			if( err )
				logger.error( err );

			let answer = data.AbstractText || null;
			let image = data.Image || "";

			if( data.AbstractText != undefined && data.AbstractText != null && data.AbstractText !== '' ) {
				return callback( err, {
					"text": "Quack! " +answer,
					"icon": image
				} );
			}

			// Otherwise attempt a wiki query instead
			quackipedia( subject, (err, results) => {
				if( err )
					logger.error( err );

				if( results ) {
					switch( results.type ) {
						case "disambiguation":
							if( results.extract.endsWith(':') ){
								answer = `Quack...\nI'm not familiar with that, perhaps ${results.content_urls.desktop.page} has the information you want?`;
								break;
							}
							answer = `Quack?\nThat can mean several things. ${results.extract}`;
							break;
						default:
							answer = `Quack!\n${results.extract}`;
					}
				}

				callback( err, {
					"text": answer,
					"icon": image
				} );
			} );
			
		} );
	}
	catch( err ) {
		logger.error( err );
		callback( err, {
			"text": "Ow. Quack. Please ask me things as a sentence, otherwise it hurts my brain. (My parser blew up)",
			"icon": DEFAULT_ICON
		} );
	}
}

async function handleQuery( r, text, callback )
{
	if(!text) return;

	r.text = "Question?";
	_question( text.trim(), (err, out) => {
		if( err )
			logger.error( err );
		r.icon = out.icon || DEFAULT_ICON; // URL
		r.command = out.command || "DuckDuckGo";
		r.text = out.text || "Quack?";

		callback(r);
	} );
}

module.exports = {
	"name": "theduck",
	"author": "John Vidler",
	"comments": "Originally just a DuckDuckGo instant answers API, but more than that now.",
	"commands": {
		"duck": handleQuery
	}
};

//handleQuery( {}, process.argv[2], (r) => console.log(r) );
