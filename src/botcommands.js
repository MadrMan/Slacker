import logger from './logging.js';
import { exec } from 'child_process';

var commandList = {}

commandList.source = async function handleSource(r, text) {
	r.text = "https://github.com/MadrMan/Slacker";
	r.icon = "https://upload.wikimedia.org/wikipedia/commons/c/c2/GitHub_Invertocat_Logo.svg";
}

commandList.echo = async function handleEcho(r, text) {
	r.text = text;
}

commandList.help = async function handleHelp(r, text) {
	r.text = `Available commands: ${Object.keys(commandList).map(c => `!${c}`).join(", ")}`
	r.icon = "https://www.pngfind.com/pngs/m/686-6865480_transparent-man-symbol-png-man-question-mark-icon.png";
}

commandList.pull = async function handlePull(r, text) {
	r.icon = "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Octicons-git-pull-request.svg/200px-Octicons-git-pull-request.svg.png";

	await new Promise(resolve => {
		exec("git pull --ff-only", (err, stdout, stderr) => {
			if (err)
			{
				r.text = "```ERROR:\n" + err + "```";
				resolve();

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

			resolve();

			// We assume we're in a forever loop
			// We wait for the above reply to send, then restart
			setTimeout(process.exit, 2000, 0);
		});
	});
}

commandList.status = async function handleStatus(r, text) {
	r.text = "NO idea";
	r.icon = "https://cdn-icons-png.flaticon.com/512/1786/1786640.png";
}

var lastError;
commandList.error = async function handleError(r, text) {
	r.icon = "https://icons.iconarchive.com/icons/paomedia/small-n-flat/256/sign-error-icon.png";
	r.text = "No logged error for last command";
	if (lastError)
		r.text = "ERROR: " + lastError;
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
		const content = sep.length > 1 ? sep[1] : null;

		// Call actual command
		try
		{
			await handler(r, content);
			if (r.error) logger.error(r.error);
		} catch (ex) {
			r.error = ex.stack;
			r.text = ex.toString();
			logger.error(ex);
		}

		lastError = r.error;

		// Reply to user
		await callback(r);

		return true;
	}

	return false;
}
