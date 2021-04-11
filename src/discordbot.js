const { Client, Intents } = require("discord.js")
const logger = require("./logging")

class DiscordBot {
    constructor(config) {
        this.config = config;
    }

    start() {
        this.client = new Client({
            intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]
        });

        this.client.on('ready', () => {
            logger.info("Discord ready");
        });

        this.client.on('message', msg => {
            // If we found a channel, map it to the mapping
            if  (msg.author.bot || msg.author.id === this.client.user.id) {
                return;
            }

            if (msg.channel) {
                if (msg.guild) {
                    let mappedGuild = this.config.guilds.find(guild => guild.id === msg.guild.id);

                    if (mappedGuild) {
                        let mappedChannel = mappedGuild.channels.find(channel => channel.discord === msg.channel.name);

                        if  (mappedChannel) {
                            var channel = mappedChannel.id;
                        }
                    }
                }
            }

            this.messageReceived(this, msg.member ? msg.member.displayName : msg.author.username, {
                channel: channel,
                user_icon: msg.author.avatarURL({
                    format: 'png'
                }),
                discord: { 
                    channel: msg.channel
                }}, msg.content);
        });

        this.client.login(this.config.token);
    }

    sendChannelMessage(channel, message) {
        Promise.all(message.context.files ? message.context.files : []).then(files =>
            channel.send({
                content: `<${message.command ? message.command : message.username}> ${message.text}`,
                files: files?.map(f => {
                    return {
                        attachment: f.file,
                        name: f.name
                    }
                })
            })
        ).catch(logger.error);
    }

    sendMessage(message) {
        if (message.context.channel) {
            for (let guild of this.config.guilds) {
                let mappedChannel = guild.channels.find(channel => channel.id === message.context.channel);

                this.client.guilds.fetch(guild.id).then(discordGuild => {
                    let guildChannel = discordGuild.channels.cache.find((v, k) => {
                        return v.isText() && v.name === mappedChannel.discord;
                    });

                    if (guildChannel) {
                        if (message.bridge && message.context.discord) {
                            if (guildChannel.id === message.context.discord.channel.id) {
                                // Don't echo back to bridge users
                                return;
                            }
                        }

                        this.sendChannelMessage(guildChannel, message);
                    }
                }).catch(logger.error);
            }
        } else {
            this.sendChannelMessage(message.context.discord.channel, message);
        }
    }
}

module.exports = DiscordBot;