const botcommands = require('./botcommands');
const logger = require('./logging');

class Bridge
{
    constructor() {
        this.bots = [];
    }

    addBot(bot) {
        this.bots.push(bot);
    }

    async start() {
        for (let bot of this.bots) {
            bot.messageReceived = this.messageReceived.bind(this);
            await bot.start();
        }

        botcommands.initializeIntervals(async response => {
            await messageOut(undefined, response);
        });
    }

    async messageReceived(bot, username, context, message) {
        logger.debug(`Got message in ${context.channel ? context.channel : "pm"}: <${username}> ${message}`)

        if (context.channel)
        {
            // Echo it everywhere

            let response = {
                username: username,
                context: context,
                text: message,
                bridge: true
            };

            await this.messageOut(bot, response);
        }

        // Then try to process it as a command
        botcommands.processUserCommand(message, async response => {
            response.context = context;
            await this.messageOut(bot, response);
        });
    }

    async messageOut(bot, response) {
        if (!response.context.channel) {
            await bot.sendMessage(response);
        } else {
            for (let bot of this.bots) {
                await bot.sendMessage(response);
            }
        }
    }
}

module.exports = Bridge;