import logger from './logging.js';
import { exec } from 'child_process';

var commandList = {}

commandList.source = async function handleSource(r, text, callback) {
	r.text = "https://github.com/MadrMan/Slacker";
	r.icon = "https://assets-cdn.github.com/images/modules/logos_page/Octocat.png";

	await callback(r);
}

commandList.echo = async function handleEcho(r, text, callback) {
	r.text = text;

	await callback(r);
}

commandList.help = async function handleHelp(r, text, callback) {
	r.text = `Available commands: ${Object.keys(commandList).map(c => `!${c}`).join(", ")}`
	r.icon = "https://www.pngfind.com/pngs/m/686-6865480_transparent-man-symbol-png-man-question-mark-icon.png";

	await callback(r);
}

commandList.pull = async function handlePull(r, text, callback) {
	r.icon = "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Octicons-git-pull-request.svg/200px-Octicons-git-pull-request.svg.png";

	exec("git pull --ff-only", (err, stdout, stderr) => {
		if (err)
		{
			r.text = "```ERROR:\n" + err + "```";
			callback(r);

			return;
		}

		if (stderr)
		{
			r.text = "```ERROR:\n" + stderr + "```";
		}
		else
		{
			r.text = "```" + stdout + "```";
		}

		callback(r);

		// We assume we're in a forever loop
		// We wait for the above reply to send, then restart
		setTimeout(process.exit, 2001, 0);
	});
}

commandList.status = async function handleStatus(r, text, callback) {
	r.text = "NO idea";
	r.icon = "https://image.flaticon.com/icons/png/512/36/36601.png";

	await callback(r);
}

var lastError;
commandList.error = async function handleError(r, text, callback) {
	r.icon = "http://webiconspng.com/wp-content/uploads/2017/09/Explosion-PNG-Image-63024.png";
	r.text = "No logged error for last command";
	if (lastError)
		r.text = "ERROR: " + lastError;
	await callback(r);
}

const modules = [];

async function registerCommandModule( moduleFile ) {
	modules.push((await import(moduleFile)).default);
}

async function loadCommandModules() {
	await Promise.all([
		//registerCommandModule( './google.js' ),
		registerCommandModule( './translate.js' ),
		registerCommandModule( './calculator.js' ),
		registerCommandModule( './dice.js' ),
		registerCommandModule( './imdb.js' ),
		registerCommandModule( './twitch.js' ),
		registerCommandModule( './weather.js' ),
		registerCommandModule( './theduck.js' ),
		registerCommandModule( './brexit.js' ),
		registerCommandModule( './geocode.js' )
	]);

	for (let m of modules) {
		for( let k in m.commands ) {
			if( commandList[k] != undefined && commandList[k] != null ) {
				logger.warn( `Module ${m.name} overrides command ${k}!` );
			}

			commandList[k] = m.commands[k];
		}
	}

	logger.error("Registered a total of " + modules.length + " modules with " + Object.keys(commandList).length + " commands");
}

loadCommandModules();

function makeR(cmd) {
	var prettyCommand = cmd.charAt(0).toUpperCase() + cmd.slice(1);

	return {
		command: prettyCommand,
		icon: null,
 		text: '<empty>',
		error: null
	};
}

export function initializeIntervals(callback) {
	logger.debug("Setting up bot interval-based checks...");

	for (let module in modules) {
		if (module.initializeIntervals) {
			module.initializeIntervals(callback);
		}
	}
}

export async function processUserCommand(text, callback) {
	if(!text || text[0] != '!') return false;

	var sep = text.toLowerCase();
	var space = sep.indexOf(' ');
	sep = (space == -1) ? [ sep ] : [ sep.substr(0, space), sep.substr(space + 1) ];
	sep[0] = sep[0].slice(1); // strip '!'

	var r = makeR(sep[0]);
	var handler = commandList[sep[0]];
	if (handler)
	{
		logger.error("Handling command: " + sep[0]);
		await handler(r, sep.length > 1 ? sep[1] : null, async r => {
			lastError = r.error;
			if (r.error) logger.error(r.error);
			await callback(r);
		});

		return true;
	}

	return false;
}
