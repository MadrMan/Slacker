const { Client, Intents } = require("discord.js")
const logger = require("./logging")
const https = require('https');

const mentionRegex = /<@!(\w+)>/g//

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

            let files = msg.attachments.map(f => new Promise((resolve, reject) => {
                https.get(f.url, res => {
                    if (res.statusCode !== 200) {
                        reject("Failed to download");
                        return;
                    }

                    let data = [];
                    res.on("data", chunk => data.push(chunk));
                    res.on('end', () => resolve({
                        file: Buffer.concat(data),
                        name: f.name,
                        original_url: f.url
                    }));
                    res.on("error", err => reject(err));
                });
            }));

            const that = this;
            const replaceMentions = function(message) {
                const arr = [...message.matchAll(mentionRegex)];
                const clientPromises = arr.map(match => that.client.users.fetch(match[1]).then(user => [user, match[0]]));

                return Promise.all(clientPromises).then((replacing) => {
                    let modifiedMessage = message;
                    replacing.map(replace => {
                        const [user, match] = replace;
                        modifiedMessage = modifiedMessage.replace(match, `@${user.username}`);
                    })
                    return modifiedMessage;
                });
            }

            replaceMentions(msg.content).then((content) => {
                that.messageReceived(this, msg.member ? msg.member.displayName : msg.author.username, {
                    channel: channel,
                    files: files,
                    user_icon: msg.author.displayAvatarURL({
                        format: 'png'
                    }),
                    discord: {
                        channel: msg.channel
                    }}, content);
            })
        });

        this.client.login(this.config.token);
    }

    async getWebhookForChannel(mappedChannel, guildChannel) {
        if (!mappedChannel.webhook) {
            mappedChannel.webhook = (async() => {
                let hooks = await guildChannel.fetchWebhooks();
                let webhook = hooks.find(v => v.owner.id === this.client.user.id);

                if (webhook) {
                    return webhook;
                }

                return guildChannel.createWebhook(this.client.user.username, {
                    reason: "Bridging channel"
                });
            })();
        }

        return mappedChannel.webhook;
    }

    sendChannelMessage(channel, webhook, message) {
        Promise.all(message.context.files ? message.context.files : []).then(files => {
            let sender = message.command ? message.command : message.username;
            let attach = files?.map(f => {
                return {
                    attachment: f.file,
                    name: f.name
                }
            });

            if (webhook) {
                webhook.send(message.text, {
                    username: sender,
                    avatarURL: message.icon ? message.icon : message.context.user_icon,
                    files: attach
                });
            } else {
                channel.send({
                    content: `<${sender}> ${message.text ? message.text : ""}`,
                    files: attach
                })
            }
        }).catch(logger.error);
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

                        let webhook = this.getWebhookForChannel(mappedChannel, guildChannel);
                        webhook.then(hook => this.sendChannelMessage(guildChannel, hook, message));
                    }
                }).catch(logger.error);
            }
        } else {
            this.sendChannelMessage(message.context.discord.channel, undefined, message);
        }
    }
}

module.exports = DiscordBot;