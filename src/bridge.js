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

    start() {
        for (let bot of this.bots) {
            bot.messageReceived = this.messageReceived.bind(this);
            bot.start();
        }

        botcommands.initializeIntervals(response => {
            messageOut(undefined, response);
        });
    }

    messageReceived(bot, username, context, message) {
        logger.debug(`Got message in ${context.channel ? context.channel : "pm"}: <${username}> ${message}`)

        if (!botcommands.processUserCommand(message, response => {
            response.context = context;
            this.messageOut(bot, response);
        })) {
            // No command handled, so this must've been a regular chat command or a PM
            let response = {
                username: username,
                context: context,
                text: message,
                bridge: true
            };

            this.messageOut(bot, response)
        }
    }

    messageOut(bot, response) {
        if (!response.context.channel) {
            bot.sendMessage(response);
        } else {
            for (let bot of this.bots) {
                bot.sendMessage(response);
            }
        }
    }
}

module.exports = Bridge;