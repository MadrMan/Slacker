var _ = require('lodash');

var errors = require('./errors');
var validateChannelMapping = require('./validators').validateChannelMapping;
var emojis = require('./emoji');

var ALLOWED_SUBTYPES = ['me_message'];
var REQUIRED_FIELDS = ['server', 'nickname', 'channelMapping', 'token'];

/**
 * An IRC bot, works as a middleman for all communication
 * @param {object} options - server, nickname, channelMapping, outgoingToken, incomingURL
 */
function Bot(options) {
  REQUIRED_FIELDS.forEach(function(field) {
    if (!options[field]) {
      throw new errors.ConfigurationError('Missing configuration field ' + field);
    }
  });

  logger.error(" === STARTUP === ");

  validateChannelMapping(options.channelMapping);
  
  this.server = options.server;
  this.nickname = options.nickname;
  this.ircOptions = options.ircOptions;
  this.commandCharacters = options.commandCharacters || [];
  this.channels = _.values(options.channelMapping);
  this.ircConnected = false;

  this.channelMapping = options.channelMapping;

  // Remove channel passwords from the mapping and lowercase IRC channel names
  _.forOwn(this.channelMapping, function(ircChan, slackChan, mapping) {
    logger.debug('Mapping ' + ircChan + ' -> ' + slackChan);
    mapping[slackChan] = ircChan.split(' ')[0].toLowerCase();
  }, this);

  logger.debug(this.channelMapping);

  this.invertedMapping = _.invert(this.channelMapping);

  this.autoSendCommands = options.autoSendCommands || [];
}

Bot.prototype.connect = function() {
  logger.debug('Connecting to IRC and Slack');
  this.slack.start();

  var ircOptions = _.assign({
    userName: this.nickname,
    realName: this.nickname,
    channels: this.channels,
    floodProtection: true,
    floodProtectionDelay: 500
  }, this.ircOptions);

  this.ircClient = new irc.Client(this.server, this.nickname, ircOptions);
  this.attachListeners();
};

Bot.prototype.attachListeners = function() {
  this.ircClient.on('registered', function(message) {
    logger.debug('Registered event: ', message);
    this.autoSendCommands.forEach(function(element) {
      this.ircClient.send.apply(this.ircClient, element);
    }, this);
    this.ircConnected = true;
  }.bind(this));

  this.ircClient.on('error', function(error) {
    logger.error('Received error event from IRC', error);
  });

  this.ircClient.on('message', function(author, to, text) {
	 this.sendToSlack(author, to, text);
	 this.processCommand(author, to, text, true);
  }.bind(this));

  this.ircClient.on('notice', function(author, to, text) {
    var formattedText = '*' + text + '*';
    this.sendToSlack(author, to, formattedText);
  }.bind(this));

  this.ircClient.on('action', function(author, to, text) {
    var formattedText = '_' + text + '_';
    this.sendToSlack(author, to, formattedText);
  }.bind(this));

  this.ircClient.on('invite', function(channel, from) {
    logger.debug('Received invite:', channel, from);
    if (!this.invertedMapping[channel]) {
      logger.debug('Channel not found in config, not joining:', channel);
    } else {
      this.ircClient.join(channel);
      logger.debug('Joining channel:', channel);
    }
  }.bind(this));
};

Bot.prototype.parseText = function(text) {
  return text
    .replace(/\n|\r\n|\r/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<!channel>/g, '@channel')
    .replace(/<!group>/g, '@group')
    .replace(/<!everyone>/g, '@everyone')
    .replace(/<#(C\w+)\|?(\w+)?>/g, function(match, channelId, readable) {
      return readable || '#' + this.slack.dataStore.getChannelById(channelId).name;
    }.bind(this))
    .replace(/<@(U\w+)\|?(\w+)?>/g, function(match, userId, readable) {
      return readable || '@' + this.slack.dataStore.getUserById(userId).name;
    }.bind(this))
    .replace(/<(?!!)(\S+)>/g, function(match, link) {
      return link;
    })
    .replace(/<!(\w+)\|?(\w+)?>/g, function(match, command, label) {
      if (label) {
        return '<' + label + '>';
      }

      return '<' + command + '>';
    })
    .replace(/\:(\w+)\:/g, function(match, emoji) {
      if (emoji in emojis) {
        return emojis[emoji];
      }

      return match;
    });
};

Bot.prototype.isCommandMessage = function(message) {
  return this.commandCharacters.indexOf(message[0]) !== -1;
};

Bot.prototype.sendToIRC = function(message) {
  if (!this.ircConnected)
  {
    return;
  }
  
  var channel = this.slack.dataStore.getChannelGroupOrDMById(message.channel);
  if (!channel) {
    logger.info('Received message from a channel the bot isn\'t in:',
      message.channel);
    return;
  }

  var channelName = channel.is_channel ? '#' + channel.name : channel.name;
  var ircChannel = this.channelMapping[channelName];
  
  //logger.debug('Channel Mapping', channelName, this.channelMapping[channelName]);
  if (ircChannel) {
    var user = this.slack.dataStore.getUserById(message.user);
    var text = this.parseText(message.text);

    if (this.isCommandMessage(text)) {
      var prelude = 'Command sent from Slack by ' + user.name + ':';
      this.ircClient.say(ircChannel, prelude);
    } else if (!message.subtype) {
      text = '<' + user.name + '> ' + text;
    } else if (message.subtype === 'me_message') {
      text = 'Action: ' + user.name + ' ' + text;
    }

    logger.debug('Sending message to IRC', channelName, text);
    this.ircClient.say(ircChannel, text);
  }
};

Bot.prototype.processCommand = function(author, channelid, text, isirc) {
	botcommands.processUserCommand(text, function(response) {
		this.handleOutwardMessage(response, author, channelid, isirc)
	}.bind(this));
}
	 
Bot.prototype.handleOutwardMessage = function(response, author, channelid, isirc) {
    var slackChannel = null;
    var ircChannel = null;
    if (!isirc)
    {
      slackChannel = this.slack.dataStore.getChannelGroupOrDMById(channelid); // remap to slack channel object

      var channelName = slackChannel.is_channel ? '#' + slackChannel.name : slackChannel.name;
      ircChannel = this.channelMapping[channelName]; // If we come from slack, remap
    }
    else
    {
      ircChannel = channelid;

      slackChannelName = this.invertedMapping[ircChannel.toLowerCase()]; // If we come from irc, remap
      slackChannel = this.slack.dataStore.getChannelOrGroupByName(slackChannelName);
    }

    if (ircChannel && this.ircConnected)
    {
      this.ircClient.say(ircChannel, "[" + response.command + "] " + response.text);
    }


}

Bot.prototype.sendToSlack = function(author, channel, text) {
  var slackChannelName = this.invertedMapping[channel.toLowerCase()];
  if (slackChannelName) {
    var slackChannel = this.slack.dataStore.getChannelOrGroupByName(slackChannelName);

    if (!slackChannel) {
      logger.info('Tried to send a message to a channel the bot isn\'t in: ',
        slackChannelName);
      return;
    }


  }
};

module.exports = Bot;
