//Dont' even try to read and understand this code. It's such an ungodly mess of require, async and pain

 //protip: look for " to see stolen code (It is mostly rewritten though, just the image fetching part is the same)
 //actually forget that, I've written/rewritten so much code it's not really a copy anymore
 //help

//scratch the above comments, I rewrote it to work with the other stuff

//scratch everything. this has expanded/changed so much there's no more stolen code lol

//aaaaaaaaaa
// -RoadCrosser, one of the times he spammed 'a'

/*jshint esversion: 6*/ //I fucking love es6
/*jshint loopfunc: true */ //shh no tears (Also it's not my fault I'm stuck using callbacks in a loop because node goes async all the way)

var Discord = require("discord.js");
var request = require("request");
var fs = require('fs-extra');
var base64 = require('node-base64-image'); //image to base64 for avy changes
var parseString = require('xml2js').parseString; //for XML apis (Gelbooru pls)

var Auth = require("./auth.json");
var settings = require('./settings.json'); //Blacklists, Users...
var defaultSettings = require('./defaultSettings.json'); //empty settings used to initialize
var sites = require('./sites.json'); //aliases, nsfw? for sites
var aliases = require('./aliases.json'); //aliases for tags
var helpDocs = require('./helpDocs.json'); //help docs
var path = require('path'); //'.' is relative to the working dir, not the script, so I need to do this because otherwise 'node Booru-Discord/booru.js' breaks (and so does forever)

var getSiteRegex = /=([^\s]*)/;
var getChannelRegex = /<#(\d+)>/;
var serverId = ''; //global vars woo
var avyChance = 0.05; //in %

var bot = new Discord.Client();

var inviteLink = 'http://discordapp.com/oauth2/authorize?client_id=204721731162734592&scope=bot&permissions=0';

bot.on("ready", () => {
  console.log("===\nTime for porn!\n===");
  bot.user.setStatus('online', '=help');
  changeAvy(); //random avy
});

bot.on('disconnect', () => {
  console.log('Disconnected... time to kms');
  process.exit(1);
});

bot.on("message", (message) => {
  if (message.channel.guild !== undefined) {
    serverId = message.channel.guild.id;
  } else {
    serverId = 'dm' + message.author.id; //Settings for DMs (user specific)
  }

  if (message.author.equals(bot.user) || message.author.bot || //Don't reply to itself or bots
      message.content.indexOf('=') !== 0 || //Don't bother replying if = isn't at the start
      !botCanSpeak(message) //Check if the bot can speak
    ) {return;}

  createServerSettings(serverId); //Create settings if none exist (also DM settings)

  console.log("Treating " + message.content + " from " + message.author + " as command!");

  var siteToSearch = message.content.match(getSiteRegex)[1];

  //alias support for sites, so you don't need to type all of the url ('e6' => 'e621.net')
  message.content = message.content.replace(siteToSearch, expandSite(siteToSearch));
  siteToSearch = expandSite(siteToSearch);
  //alias support for tags because reasons
  message.content = expandTags(message.content);
  console.log(message.content);

  /*jshint evil: true*/
    if (message.content.indexOf('=eval') === 0) {
      if (message.author.id !== Auth.ownerID) { //ain't nobody else runnin' eval on my watch
          return;
      }
      var content = message.content.replace('=eval', '');
      try {
          var result = eval(content);
          console.log(result);
          message.channel.sendMessage('`' + result + '`');
      } catch (err) {
          console.log(err);
          message.channel.sendMessage('`' + err + '`');
      }
      return;
    }

  //Block other commands (but allow people to edit the blacklist)
  if (blacklistContainsChannel(message.channel.id) && !canEditBlacklist(message)) {
    if (!settings[serverId].options.silentBlacklist) { //Should the bot warn if the channel's blacklisted
      message.channel.sendMessage('This channel\'s blacklisted! Sorry!');
    }
    console.log('Channel\'s blacklisted!');
    return;
  }

  if (message.content.indexOf('=blacklist') === 0) {
    if (canEditBlacklist(message) && message.content.substring('=blacklist '.length) !== '') { //only let certain users modify the blacklist
      blacklist(message);
      return;
    } else {
      if (message.content.substring('=blacklist '.length) === ''){
        message.channel.sendMessage('```xl\nCurrently blacklisted: \n' +
          ((settings[serverId].blacklist.tags[0] !== undefined) ?
            'Tags: ' + settings[serverId].blacklist.tags + '\n' :
            '') +
          ((settings[serverId].blacklist.channels[0] !== undefined) ?
            'Channels: ' + blacklistFormatChannels() + '\n' :
            '') +
          ((settings[serverId].blacklist.sites[0] !== undefined) ?
            'Sites: ' + settings[serverId].blacklist.sites + '\n' :
            '') +
          '```');
        return;
      }
    }
  }

  if (message.content.indexOf('=whitelist') === 0) {
    if (canEditBlacklist(message)) { //only let certain users modify the blacklist
      whitelist(message);
      return;
    } else {
      message.channel.sendMessage(':no_entry_sign: No, you can\'t get around the blacklist like that');
      return;
    }
  }

  if (message.content.indexOf('=add') === 0) {
    if (canEditBlacklist(message)) { //only let certain users modify the blacklist
      blacklistAddUser(message);
      return;
    } else {
      message.channel.sendMessage(':no_entry_sign: Yeah... No');
      return;
    }
  }

  if (message.content.indexOf('=remove') === 0) {
    if (canEditBlacklist(message)) { //only let certain users modify the blacklist
      blacklistRemoveUser(message);
      return;
    } else {
      message.channel.sendMessage(':no_entry_sign: I won\'t let you');
      return;
    }
  }

  if (message.content.indexOf('=setting') === 0 && canEditBlacklist(message)) {
    settingsEdit(message);
    return;
  }

  //Block other commands (for everyone, managers included)
  if (blacklistContainsChannel(message.channel.id)) {
    if (!settings[serverId].options.silentBlacklist) { //Should the bot warn if the channel's blacklisted
      message.channel.sendMessage('This channel\'s blacklisted! Sorry!');
    }
    console.log('Channel\'s blacklisted!');
    return;
  }

  if (message.content.indexOf('=help') === 0) {
    help(message);
    return;
  }

  if (message.content.indexOf('=avy') === 0) {
    changeAvy();
    message.channel.sendMessage('New avy set!');
    return;
  }

  if (message.content.indexOf('=invite') === 0) {
    message.channel.sendMessage(inviteLink);
    return;
  }

  if (settings[serverId].blacklist.sites.indexOf(siteToSearch) !== -1) {
    message.channel.sendMessage(':no_entry_sign: As much as I\'d love to search that, that site\'s blacklisted here!');
    return;
  }

  if (Object.keys(sites).indexOf(siteToSearch) === -1 && siteToSearch.indexOf('rand') === -1) return; //not a supported site, don't bother searching

  if (message.content.indexOf('=rand') === 0) {
    message.content = message.content.replace(message.content.split(' ')[0], '=random');
  }

  message.channel.startTyping(); //since the rest is image searching (and that takes quite a bit sometimes)
  //keeps people from thinking the bot died

  beginSearch(message); //actually start searching

  message.channel.stopTyping();
});


function beginSearch(message) {
  var siteToSearch = message.content.match(getSiteRegex)[1];
  var messageToSend = false;

  if (siteToSearch === 'random') {
    if (settings[serverId].blacklist.sites.length == Object.keys(sites).length) {
      message.channel.sendMessage('All sites are blacklisted...');
      bot.stopTyping(message.channel);
      return;
    }

    var index = randomSite(); //returns the index of a random, non-blacklisted site
    var originalMessage = message.content;

    randSearch(message, originalMessage, index, 0, function(result) {
      if (result !== false) {
        if (Math.random() < avyChance) changeAvy(); //hardcoded because reasons
        message.channel.sendMessage(result);
        console.log('sentMessage');
      } else {
        message.channel.sendMessage('No images found. On *any* website. Impressive.');
        return;
      }
    });

  } else {
    booruSearch(message, function(result) {
      if (result === undefined) result = false;
      if (result !== false) {
        if (Math.random() < avyChance) changeAvy(); //hardcoded because reasons
        message.channel.sendMessage(result);
        console.log('sentMessage');
        return;
      } else {
        message.channel.sendMessage('No images found. Try different tags ¯\\_(ツ)_/¯');
        return;
      }
    });
  }
}
/*









*/

function randSearch(message, originalMessage, index, sitesSearched, callback) {
  if (sitesSearched > Object.keys(sites).length) {
    callback(false);
    return;
  }

  if (Object.keys(sites)[index] === undefined) index = 0;

  siteToSearch = Object.keys(sites)[index];

  if (settings[serverId].blacklist.sites.indexOf(siteToSearch) !== -1) {
    index++;
    sitesSearched++;
    randSearch(message, originalMessage, index, sitesSearched, (result) => callback(result));
    return;
  }

  message.content = originalMessage.replace('=random', '=' + siteToSearch);
  console.log('Random! ' + siteToSearch);

  booruSearch(message, function(result) {
    if (result !== false && result !== undefined && result.indexOf('ERROR:') !== 0) {
      callback(result);
      console.log('rand callback');
    } else {
      index++; //increase index and continue
      sitesSearched++;
      randSearch(message, originalMessage, index, sitesSearched, (result) => callback(result));
    }
  });

}

function booruSearch(message, callback) {
  console.log('Searching...');
  var messageToSend = false;
  var siteToSearch = message.content.match(getSiteRegex)[1];
  console.log(siteToSearch);

  switch (siteToSearch) {
    case '': //if there's no site just give up
      messageToSend = false;
      help(message);
    break;

    ///    /post/index.json

    case 'e621.net': //e6
    case 'hypnohub.net': //hh
    case 'lolibooru.moe': //lb
      messageToSend = searchPostsIndex(message, function(result) {
        if (result !== false && result !== undefined) messageToSend = result;
        console.log('Got image? (Booru ) ' + messageToSend);
        callback(messageToSend);
        return;
      });
    break;

    ///    /posts.json

    case 'danbooru.donmai.us': //db
      messageToSend = searchPostsJSON(message, function(result) {
        if (result !== false && result !== undefined) messageToSend = result;
        console.log('Got image? (Booru ) ' + messageToSend);
        callback(messageToSend);
        return;
      });
    break;

    ///    /post.json

    case 'konachan.com': //kc
    case 'konachan.net': //kn
    case 'yande.re': //yd
      messageToSend = searchPostJSON(message, function(result) {
        if (result !== false && result !== undefined) messageToSend = result;
        console.log('Got image? (Booru ) ' + messageToSend);
        callback(messageToSend);
        return;
      });
    break;

    ///    /index.php?page=dapi&s=post&q=index (xml)

    case 'gelbooru.com': //gb
    case 'rule34.xxx': //r34
    case 'safebooru.org': //sb
    case 'tbib.org': //tbib
    case 'xbooru.com': //xb
    case 'youhate.us': //yh
      searchIndexPHP(message, function(result) {
        if (result !== false && result !== undefined) messageToSend = result;
        console.log('Got image? (Booru ) ' + messageToSend);
        callback(messageToSend);
        return;
      });
    break;

    ///     /api/danbooru/find_posts/index.xml

    case 'dollbooru.org': //do
    case 'rule34.paheal.net': //pa
      searchDanbooruAPI(message, function(result) {
        if (result !== false && result !== undefined) messageToSend = result;
        console.log('Got image? (Booru ) ' + messageToSend);
        callback(messageToSend);
        return;
      });
    break;

    default: //give up
      return;
  }
}

function searchPostsIndex (message, callback) {
  var tagsFormatted = formatTags(message);
  var messageToSend = false;
  if (tagsFormatted === false) return;

  console.log('http://' +  message.content.match(getSiteRegex)[1] + '/post/index.json?tags=order:random+' + tagsFormatted);

  var header = {
    url: 'http://' +  message.content.match(getSiteRegex)[1] + '/post/index.json?tags=order:random+' + tagsFormatted,
    headers: {
      'User-Agent': 'Imageboard Bot for Discord by AtlasTheBot (@lasthebot)'
    }
  };

  request(header, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var images = JSON.parse(body);
      var index = 0;

      getImagePostsIndex(index, images, message, function(result) {
        if (result !== false) messageToSend = result;
        console.log('Got image? (Search) ' + messageToSend);
        callback(messageToSend);
        return;
      });

    } else {
      parseError(response, body, message, function(result) {
        if (result !== false) messageToSend = result;
        console.log('fug got an error! ' + messageToSend);
        callback(messageToSend);
        return;
      });
    }
  });
}

function searchPostsJSON  (message, callback) {
  var tagsFormatted = formatTags(message);
  var messageToSend = false;
  if (tagsFormatted === false) return;

  var header = {
    url: 'http://' + message.content.match(getSiteRegex)[1] + '/posts.json?tags=order:random+' + tagsFormatted,
    headers: {
    'User-Agent': 'Imageboard Bot for Discord by AtlasTheBot (@lasthebot)'
    }
  };

  request(header, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var images = JSON.parse(body);
      var index = 0;

      getImagePostsJSON(index, images, message, function(result) {
        if (result !== false) messageToSend = result;
        console.log('Got image? (Search) ' + messageToSend);
        callback(messageToSend);
        return;
      });

    } else {
      parseError(response, body, message, function(result) {
        if (result !== false) messageToSend = result;
        console.log('fug got an error! ' + messageToSend);
        callback(messageToSend);
        return;
      });
    }
  });
}

function searchPostJSON   (message, callback) {
  var tagsFormatted = formatTags(message);
  var messageToSend = false;
  if (tagsFormatted === false) return;

  var header = {
    url: 'http://' + message.content.match(getSiteRegex)[1] + '/post.json?tags=order:random+' + tagsFormatted,
    headers: {
    'User-Agent': 'Imageboard Bot for Discord by AtlasTheBot (@lasthebot)'
    }
  };

  request(header, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var images = JSON.parse(body);
      var index = 0;

      getImagePostJSON(index, images, message, function(result) {
        if (result !== false) messageToSend = result;
        console.log('Got image? (Search) ' + messageToSend);
        callback(messageToSend);
        return;
      });
    } else {
      parseError(response, body, message, function(result) {
        if (result !== false) messageToSend = result;
        console.log('fug got an error! ' + messageToSend);
        callback(messageToSend);
        return;
      });
    }
  });
}

function searchIndexPHP   (message, callback) {
  console.log('IndexPHP...');
  var tagsFormatted = formatTags(message);
  var messageToSend = false;
  if (tagsFormatted === false) return;

  var header = {
    url: 'http://' + message.content.match(getSiteRegex)[1] + '/index.php?page=dapi&s=post&q=index&tags=' + tagsFormatted,
    headers: {
      'User-Agent': 'Imageboard Bot for Discord by AtlasTheBot (@lasthebot)'
    }
  };

  request(header, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      parseString(body, function (err, result) {
        images = result;
      });

      var index = 0;

      getImagesIndexPHP(index, images, message, function(result) {
        if (result !== false) messageToSend = result;
        console.log('Got image? (Search) ' + messageToSend);
        callback(messageToSend);
        return;
      });

    } else {
      parseError(response, body, message, function(result) {
        if (result !== false) messageToSend = result;
        console.log('fug got an error! ' + messageToSend);
        callback(messageToSend);
        return;
      });
    }
  });
}

function searchDanbooruAPI(message, callback) {
  var tagsFormatted = formatTags(message);
  var messageToSend = false;
  if (tagsFormatted === false) return;

  var header = {
    url: 'http://' + message.content.match(getSiteRegex)[1] + '/api/danbooru/find_posts/index.xml?tags=' + tagsFormatted,
    headers: {
      'User-Agent': 'Imageboard Bot for Discord by AtlasTheBot (@lasthebot)'
    }
  };

  request(header, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      parseString(body, function (err, result) {
        images = result;
      });

      var index = 0;

      getImageDanbooruAPI(index, images, message, function(result) {
        if (result !== false) messageToSend = result;
        console.log('Got image? (Search) ' + messageToSend);
        callback(messageToSend);
        return;
      });

    } else {
      parseError(response, body, message, function(result) {
        if (result !== false) messageToSend = result;
        console.log('fug got an error! ' + messageToSend);
        callback(messageToSend);
        return;
      });
    }
  });
}
/*









*/

function getImagePostsIndex (index, images, message, callback) {
  var timeToStop = false;
  var messageToSend = false;

  if (typeof (images[index]) != "undefined") {

    settings[serverId].blacklist.tags.forEach(function(element) {
      if (images[index].tags.indexOf(element) !== -1) {
        console.log('Image found has blacklisted tag: `' + element + '`');
        timeToStop = true;
        return;
      }
    });

    if (timeToStop) {
      index++;
      getImagePostsIndex(index, images, message, callback);
      callback(messageToSend);
      return;
    }

    if (message.content.match(getSiteRegex)[1] === 'e621.net') {
      //message.channel.sendMessage(images[index].file_url.toString() +
      //  '\nhttp://' + message.content.match(getSiteRegex)[1] + '/post/show/' + images[index].id.toString());
      messageToSend = images[index].file_url.toString() + '\nhttp://' + message.content.match(getSiteRegex)[1] + '/post/show/' + images[index].id.toString();
    } else {
      //message.channel.sendMessage('http://' + message.content.match(getSiteRegex)[1] + '/post/show/' + images[index].id.toString());
      messageToSend = 'http://' + message.content.match(getSiteRegex)[1] + '/post/show/' + images[index].id.toString();
    }

  }
  console.log('Got image? (Images) ' + messageToSend);
  callback(messageToSend);
  return;
}

function getImagePostsJSON  (index, images, message, callback) {
  var timeToStop = false;
  var messageToSend = false;

  if (typeof (images[index]) != "undefined") {

    settings[serverId].blacklist.tags.forEach(function(element) {
      if (images[index].tag_string.indexOf(element) !== -1) {
        console.log('Image found has blacklisted tag: `' + element + '`');
        timeToStop = true;
        return;
      }
    });

    if (timeToStop) {
      index++;
      getImagePostsJSON(index, images, message, callback);
      return;
    }

      //danbooru embeds!
      //message.channel.sendMessage('http://' + message.content.match(getSiteRegex)[1] + images[index].file_url.toString());
      //message.channel.sendMessage('http://' + message.content.match(getSiteRegex)[1] + '/posts/' + images[index].id.toString());
      messageToSend = 'http://' + message.content.match(getSiteRegex)[1] + '/posts/' + images[index].id.toString();
    }
    console.log('Got image? (Images) ' + messageToSend);
    callback(messageToSend);
    return;
}

function getImagePostJSON   (index, images, message, callback) {
  var timeToStop = false;
  var messageToSend = false;

  if (typeof (images[index]) != "undefined") {

    settings[serverId].blacklist.tags.forEach(function(element) {
      if (images[index].tags.indexOf(element) !== -1) {
        console.log('Image found has blacklisted tag: `' + element + '`');
        timeToStop = true;
        return;
      }
    });

    if (timeToStop) {
      index++;
      getImagePostJSON(index, images, message, callback);
      return;
    }

    messageToSend = 'http://' + message.content.match(getSiteRegex)[1] + '/post/show/' + images[index].id.toString();
  }
  callback(messageToSend);
}

function getImagesIndexPHP  (index, images, message, callback) {
  //images.posts.post[0].$;
  var timeToStop = false;
  var messageToSend = false;
  var numResults;

  if (images.posts.post !== undefined) {
    if (images.posts.post[index] === undefined) { //lazy shitty fix ()
      return messageToSend;
    }

    if (images.posts.$.count < 100) {
      numResults = images.posts.$.count;
    } else {
      numResults = 100;
    }

    index = Math.floor(Math.random()*numResults); //Randomly select an image
	
    settings[serverId].blacklist.tags.forEach(function(element) {
      if (images.posts.post[index].$.tags.indexOf(element) !== -1) {
        console.log('Image found has blacklisted tag: `' + element + '`');
        timeToStop = true;
        return;
      }
    });

    if (timeToStop) {
      index++;
      getImagesIndexPHP(index, images, message, callback);
      return;
    }

    if (message.content.match(getSiteRegex)[1] !== 'rule34.xxx') { //r34 you cuck
      messageToSend = images.posts.post[index].$.file_url + '\nhttp://' + message.content.match(getSiteRegex)[1] + '/index.php?page=post&s=view&id=' + images.posts.post[index].$.id.toString();
    } else {
      messageToSend = 'http:' + images.posts.post[index].$.file_url + '\nhttp://' + message.content.match(getSiteRegex)[1] + '/index.php?page=post&s=view&id=' + images.posts.post[index].$.id.toString();
    }
  }
  console.log('Got image? (Images) ' + messageToSend);
  callback(messageToSend);
  return;
}

function getImageDanbooruAPI(index, images, message, callback) {
  //images.posts.post[0].$;
  var timeToStop = false;
  var messageToSend = false;
  var numResults;

  if (images.posts.post !== undefined) {
    if (images.posts.post[index] === undefined) { //lazy shitty fix ()
      return false;
    }

    if (images.posts.$.count < 100) {
      numResults = images.posts.$.count;
    } else {
      numResults = 100;
    }

    index = Math.floor(Math.random()*numResults); //Randomly select an image

    settings[serverId].blacklist.tags.forEach(function(element) {
      if (images.posts.post[index].$.tags.indexOf(element) !== -1) {
        console.log('Image found has blacklisted tag: `' + element + '`');
        timeToStop = true;
        return;
      }
    });

    if (timeToStop) {
      index++;
      getImageDanbooruAPI(index, images, message, callback);
      callback(messageToSend);
      return;
    }

    if (message.content.match(getSiteRegex)[1] === 'dollbooru.org') { //why can't you keep constant apis?
        //message.channel.sendMessage('http://' + message.content.match(getSiteRegex)[1] + images.posts.post[index].$.file_url +
        //  '\nhttp://' + message.content.match(getSiteRegex)[1] + '/post/view/' + images.posts.post[index].$.id.toString());
        messageToSend = 'http://' + message.content.match(getSiteRegex)[1] + images.posts.post[index].$.file_url +
                      '\nhttp://' + message.content.match(getSiteRegex)[1] + '/post/view/' + images.posts.post[index].$.id.toString();
      } else {
        //message.channel.sendMessage(images.posts.post[index].$.file_url +
        //  '\nhttp://' + message.content.match(getSiteRegex)[1] + '/post/view/' + images.posts.post[index].$.id.toString());
        messageToSend = images.posts.post[index].$.file_url + '\nhttp://' + message.content.match(getSiteRegex)[1] + '/post/view/' + images.posts.post[index].$.id.toString();
      }

  }
  console.log('Got image? (Images) ' + messageToSend);
  callback(messageToSend);
  return;
}
/*









*/

function formatTags(message) { //pulls the tags, verifies none is blacklisted, and formats them for urls
  var tags = getTags(message.content.substring(message.content.match(getSiteRegex)[0].length + 1));

  if(containsBlacklistedTag(tags, message)) {
    return false;
  }

  var tagsFormatted = tags.join('+');

  return tagsFormatted;
}

function getTags(content) { //turns comma seperated tags into an array
  var tags;
  if (content.indexOf(',') !== -1) {
    tags = content.replace(/(\s*,\s*)/g, ',').replace(' ', '_').split(','); //.filter() ;^)
    tags = tags.filter(function(e) {return e !== '';}); //clear empty values (be glad it's not a one-liner)
  } else {
    tags = content.split(' '); //.filter() ;^)
    tags = tags.filter(function(e) {return e !== '';}); //clear empty values (be glad it's not a one-liner)
  }
  console.log('Tags: ' + tags);
  return tags;
}

function containsBlacklistedTag(tags, message) { //checks if one of the tags is blacklisted
  var timeToStop = false;

  tags.forEach(function(element) {
    if (settings[serverId].blacklist.tags.indexOf(element) !== -1) {
      timeToStop = true;
      message.channel.sendMessage('`' + element + '` is in the blacklist! ***Kinkshame!***');
      return;
    }
  });

  return timeToStop;
}

/*









*/

function parseError(response, body, message, callback) {
  var messageToSend = false;

  if (response === undefined) {
    messageToSend = 'ERROR: 404! That site doesn\'t exist';
  } else {
    var errorMessage = JSON.parse(body);

    console.log(errorMessage);
    if (errorMessage.sucess === undefined && errorMessage.message === undefined) {
      messageToSend = "ERROR: Something is wrong with the API. Or it's my fault." + '\n```\n' + error + '\n```';
    } else {
      messageToSend = "ERROR: Whelp, I got an error." + '\n```\n' + errorMessage.message + '\n```';
    }
  }
  callback(messageToSend);
  return;
}

/*









*/

//Look, I know I could just have a function to do the logic or have one function that takes an extra param to see if it should add/remove from the blacklist
//But I already wrote this and can't be bothered to rewrite something new that might break
//P.S. this is a relic of when the bot only supported e621.net. good times
function blacklist(message) {
  console.log('blacklist');

  var split = message.content.split(' ');

  //=blacklist site safebooru.org
  //['=blacklist', 'site', 'safebooru.org']

  //=blacklist jews
  //['=blacklist', 'jews']

  //=============================

  //=blacklist all nsfw
  //Blacklists all nsfw sites

  //=blacklist all sfw
  //sfw is for the the weak

  //=blacklist all channels/sites
  //Blacklists all channels/sites

  if (split[1] === 'all') {
    var site; //\jshint bitches about it being already declared if I declare it in for()
    switch (split[2]) {
      case 'nsfw':
        for(site in sites) {
          if (sites[site].nsfw === true && settings[serverId].blacklist.sites.indexOf(site) === -1) {
            settings[serverId].blacklist.sites.push(site);
          }
        }
        message.channel.sendMessage('Blacklisted all nsfw sites! ~~pleb~~');
      break;

      case 'sfw':
        for(site in sites) {
          if (sites[site].nsfw === false && settings[serverId].blacklist.sites.indexOf(site) === -1) {
            settings[serverId].blacklist.sites.push(site);
          }
        }
        message.channel.sendMessage('Blacklisted all sfw sites! ~~;^)~~');
      break;

      case 'sites':
        for(site in sites) {
          if (settings[serverId].blacklist.sites.indexOf(site) === -1) {
            settings[serverId].blacklist.sites.push(site);
          }
        }
        message.channel.sendMessage('Blacklisted all sites! ~~But that make me useless :\'(~~');
      break;

      case 'channels':
      //this took way too long to write
      var channel; //woo lazyness
        for(channel of message.guild.channels.array()) {
          if (!blacklistContainsChannel(channel.id) && channel.type === 'text') {
            settings[serverId].blacklist.channels.push({"id" : channel.id, "name": channel.name});
          }
        }
        message.channel.sendMessage('Blacklisted all channels! ~~Now I can\'t do anything~~');
      break;

      case 'tags':
        message.channel.sendMessage('Blacklisted all ta- wait. How am I supposed to know ALL the tags!?');
      break;

      default:
        message.channel.sendMessage('Blacklist all... what?');
    }
    saveSettings();
    return;
  }

  //============================

  if (split[1] === 'site') {
    split[2] = expandSite(split[2]); //turn e6 to e621.net and so forth
  }

  if (split[1] === 'site' && sites[split[2]] === undefined) {
    message.channel.sendMessage('`' + split[2] + '` is NOT supported, so blacklisting it is useless.');
    return;
  }

  //hot mess
  if (split[1] === 'channel') {
    var chanMatch = message.content.match(getChannelRegex);
    var chanId;

    if (chanMatch !== null) {
      chanId = chanMatch[1];
    } else {
      message.channel.sendMessage('You need to supply a channel if you want me to blacklist it...');
      return;
    }

    var chan = bot.channels.find("id", chanId);

    if (chan !== null) {
      if (!blacklistContainsChannel(chan.id)) {
        settings[serverId].blacklist.channels.push({"id": chan.id, "name": chan.name});
        saveSettings();
        message.channel.sendMessage('`#' + chan.name + '` added to blacklist. No searching for them!');
        return;
      } else {
        message.channel.sendMessage('`#' + chan.name + '` is already blacklisted!');
        return;
      }
    } else {
      message.channel.sendMessage('That\'s not a real channel! Try mentionning one.');
      return;
    }
  }

  if (split[2] === undefined) { //see above, we default to blacklisting tags
    split[2] = split[1];
    split[1] = 'tags';
  } else if(settings[serverId].blacklist[split[1] + 's'] !== undefined) {
    split[1] += 's';
  } else {
    message.channel.sendMessage('That\'s not a category');
    return;
  }

  var category = split[1];
  var toAdd = split[2];

  var index = settings[serverId].blacklist[category].indexOf(toAdd);

  if (index !== -1) {
    message.channel.sendMessage('`' + toAdd + '` is already in the blacklist. Lrn 2 read.');
    return;
  }

  if (toAdd === '') {
    message.channel.sendMessage('You want me to... Blacklist *nothing*?');
    return;
  }

  settings[serverId].blacklist[category].push(toAdd);

  saveSettings();

  message.channel.sendMessage('`' + toAdd + '` added to blacklist. Goodbye!');
}

function whitelist(message) {
  console.log('Whitelist');

  var split = message.content.split(' ');
  var index = 0; //used to splice

  //=whitelist site safebooru.org
  //['=whitelist', 'site', 'safebooru.org']

  //=whitelist jews
  //['=whitelist', 'jews']

  //=============================

  //=whitelist all nsfw
  //whitelists all nsfw sites

  //=whitelist all sfw
  //sfw is for the the weak

  //=whitelist all channels/sites
  //whitelists all channels/sites

  if (split[1] === 'all') {
    var site; //\jshint bitches about it being already declared if I declare it in for
    switch (split[2]) {
      case 'nsfw':
        for(site in sites) {
          index = settings[serverId].blacklist.sites.indexOf(site);
          if (sites[site].nsfw === true && index !== -1) {
            settings[serverId].blacklist.sites.splice(index, 1);
          }
        }
        message.channel.sendMessage('Whitelisted all nsfw sites! We all need some lewd sometimes.');
      break;

      case 'sfw':
        for(site in sites) {
          index = settings[serverId].blacklist.sites.indexOf(site);
          if (sites[site].nsfw === false && index !== -1) {
            settings[serverId].blacklist.sites.splice(index, 1);
          }
        }
        message.channel.sendMessage('Whitelisted all sfw sites! Because sometimes you just want art.');
      break;

      case 'sites':
        settings[serverId].blacklist.sites = []; //just empty it, it's the best and easiest way to whitelist all
        message.channel.sendMessage('Whitelisted all sites! Goodbye censorship!');
      break;

      case 'channels':
        settings[serverId].blacklist.channels = [];
        message.channel.sendMessage('Whitelisted all channels! Call me anywhere!');
      break;

      case 'tags':
        settings[serverId].blacklist.tags = [];
        message.channel.sendMessage('Whitelisted all tags! Kinks ahoy!');
      break;

      default:
        message.channel.sendMessage('Whitelist all... things? I need some more info m9.');
    }
    saveSettings();
    return;
  }

  if (split[1] === 'site') {
    split[2] = expandSite(split[2]); //turn e6 to e621.net and so forth
  }

  //hot mess
  if (split[1] === 'channel') {
    var chanMatch = message.content.match(getChannelRegex);
    var chanId;

    if (chanMatch !== null) {
      chanId = chanMatch[1];
    } else {
      message.channel.sendMessage('You need to supply a channel if you want me to whitelist it...');
      return;
    }

    var chan = bot.channels.find("id", chanId);

    if (chan !== null) {
      if (blacklistContainsChannel(chan.id)) {
        index = blacklistContainsChannel(chan.id, true); //true makes it return the index of the match
        settings[serverId].blacklist.channels.splice(index, 1);
        saveSettings();
        message.channel.sendMessage('`#' + chan.name + '` removed from blacklist. More work for me!');
        return;
      } else {
        message.channel.sendMessage('`#' + chan.name + '` is not blacklisted m9');
        return;
      }
    } else {
      message.channel.sendMessage('That\'s not a real channel! Try mentionning one.');
      return;
    }
  }

  if (split[2] === undefined) { //see above, we default to whitelisting tags
      split[2] = split[1];
      split[1] = 'tags';
  } else if(settings[serverId].blacklist[split[1] + 's'] !== undefined) {
      split[1] += 's';
  } else {
      message.channel.sendMessage('That\'s not a category');
      return;
  }

  var category = split[1];
  var toRemove = split[2];

  index = settings[serverId].blacklist[category].indexOf(toRemove);

  if (toRemove === '') {
    message.channel.sendMessage('...whitelist *what*?');
    return;
  }

  if (index !== -1) {
    settings[serverId].blacklist[category].splice(index, 1);
  } else {
    message.channel.sendMessage('`' + toRemove + '` is not in the blacklist (yet)');
    return;
  }

  saveSettings();

  message.channel.sendMessage('`' + toRemove + '` removed from blacklist, now enjoy it');
}

function blacklistAddUser(message) {
  console.log('AddUser');

  var toAdd = message.mentions.users.first();

  if (toAdd.id === undefined) {
    message.channel.sendMessage('No user found! You gotta mention someone');
    return;
  }

  var index = settings[serverId].users.indexOf(toAdd.id);

  if (index === -1) {
    settings[serverId].users.push(toAdd.id);
  } else {
    message.channel.sendMessage('`' + toAdd.username + '` is already in the list m9');
    return;
  }

  saveSettings();

  message.channel.sendMessage('Added `' + toAdd.username + '`, they can edit the blacklist now.');
}

function blacklistRemoveUser(message) {
  console.log('RemoveUser');

  var toRemove = message.mentions.users.first();

  if (toRemove === undefined) {
    message.channel.sendMessage('No user found! You could try mentioning someone, but that\'d be rude');
    return;
  }

  var index = settings[serverId].users.indexOf(toRemove.id);

  if (index !== -1) {
    settings[serverId].users.splice(index, 1);
  } else {
    message.channel.sendMessage('`' + toRemove.username + '` was never in the list in the first place');
    return;
  }

  saveSettings();

  message.channel.sendMessage('`' + toRemove.username + '` removed from blacklist whitelist');
}

/*









*/

function help(message) {
  console.log('Help!');

  var helpText = 'You should never see this';
  var param = message.content.substring('=help '.length);

  if (helpDocs[param] !== undefined) {
    helpText = helpDocs[param];
  } else {
    helpText = 'I can\'t offer you help with... whatever ' +  param + ' is.';
  }

  message.channel.sendMessage(helpText);
}

function changeAvy() {
  console.log('New Avy');
  var fileNames = fs.readdirSync(path.join(__dirname, 'avys')); //Images in a folder called "avys" in the same folder as the script
  //fileNames is an array of file names

  var fileChosen = fileNames[Math.floor(Math.random() * fileNames.length)]; //Randomly choose one

  base64.encode(path.join(__dirname, 'avys', fileChosen), {"local": true}, function(err, response) {
    if (err) {
      console.log(err + '\nError while setting avy\n');
    } else {
      bot.user.setAvatar(response); //Set avy
    }
  });
}

/*









*/

function blacklistContainsChannel(channelId, returnIndex) {
  var containsChannel = false;
  var containsIndex = -1;

  settings[serverId].blacklist.channels.forEach(function(chan, index) {
    if (chan.id === channelId) {
      containsChannel = true;
      containsIndex = index;
      return;
    }
  });
  if (returnIndex !== undefined) {
    return containsIndex;
  } else {
    return containsChannel;
  }
}

function blacklistFormatChannels() {
  var channelNames = [];
  settings[serverId].blacklist.channels.forEach(function(chan) {
    channelNames.push('#' + chan.name);
  });
  return channelNames;
}

//takes the content and expands it to the full url (if an alias exsists)
function expandSite(content) {
  for(var site in sites){
    if(sites[site].aliases.indexOf(content) !== -1) {
      console.log('Expanding ' + content + ' to ' + site);
      content = site;
      break;
    }
  }
  return content;
}

//alias support for tags
function expandTags(content) {
  for(var alias in aliases) {
    if(content.indexOf(alias) !== -1) {
      console.log('Expanding ' + alias + ' to ' + aliases[alias]);
      content = content.replace(alias, aliases[alias]);
    }
  }
  return content;
}

function randomSite() {
  var index = Math.floor(Math.random()*Object.keys(sites).length);
  var siteToSearch = Object.keys(sites)[index]; //I stopped caring that you very much
  if (settings[serverId].blacklist.sites.indexOf(siteToSearch) !== -1) index = randomSite();
  console.log('Random Index: ' + index);
  return index;
}

function canEditBlacklist(message) {
  var canEdit = false;

  //You can edit the blacklist if:
  //a) You're in the user whitelist
  //b) You have the 'manageServer' permission
  //c) You're in a dm with the bot
  //You can probably figure that out without the comments but whatever

  if (settings[serverId].users.indexOf(message.author.id) !== -1 ||
      (message.member.hasPermission('MANAGE_GUILD') || message.member.hasPermission('MANAGE_MESSAGES') || serverId.indexOf('dm') === 0) || //True if they have the MANAGE_GUILD, MANAGE_MESSAGES or in a DM
      message.author.id === Auth.ownerID) { //cheap, I know, but it's there so I can control my bot from discord (Also I can use =eval or just edit the .json file /shrug)
    canEdit = true;
  }

  return canEdit;
}

function botCanSpeak(message) {
  if (serverId.indexOf('dm') === 0) return true; //how can you mute someone in a DM?
  var canSpeak = message.channel.permissionsFor(bot.user).hasPermission('SEND_MESSAGES'); //sadly not the longest line in this
  return canSpeak;
}

function settingsEdit(message) {
  console.log('Settings called');
  var split = message.content.split(' ');
  var setting; //declare setting
  var messageToSend = '';
  console.log(split);

  if (split[1] === undefined) {
    console.log('Show settings...');
    messageToSend = '```\n';
    for (setting in settings[serverId].options) {
      messageToSend += setting + ': ' + settings[serverId].options[setting] + '\n';
    }
    messageToSend += '```';
  } else if (split[2] === undefined) {
    if (settings[serverId].options[split[1]] !== undefined) {
      messageToSend = '`' + split[1] + '` is currently set to `' + settings[serverId].options[split[1]] + '`';
    } else {
      messageToSend = 'That\'s not a valid option!';
    }
  } else if (split[2] !== undefined) {

    if (split[2] === 'true' || split[2] === 'false') {
      split[2] = ((split[2] === 'true') ? true : false);
      console.log('Converted to bool (' + split[2] + ')');
    }

    if (!isNaN(parseInt(split[2], 10))) {
      split[2] = parseInt(split[2], 10);
      console.log('Converted to number (' + split[2] + ')');
    }

    if (settings[serverId].options[split[1]] !== undefined) {
      if (typeof settings[serverId].options[split[1]] === typeof split[2]) {
        settings[serverId].options[split[1]] = split[2];
        messageToSend = '`' + split[1] + '` is now set to `' + split[2] + '`';
        saveSettings();
      } else {
        messageToSend = 'Hey! You need a ' + (typeof settings[serverId].options[split[1]]) + '!';
      }
    } else {
      messageToSend = 'That\'s not a valid option!';
    }
  }

  message.channel.sendMessage(messageToSend);
  return;
}

function createServerSettings(serverId) {
  if (settings[serverId] === undefined) {
    console.log('Server has no settings, creating settings for: ' + serverId);
    settings[serverId] = defaultSettings;

    fs.writeFile('./settings.json', JSON.stringify(settings, null, 4), function (err) {
      if (err) {
          console.log(err + '\n===\nError while creating settings');
      } else {
          console.log('Settings Created');
      }
    });
  }
}

function saveSettings() {
	
	fs.copySync(path.resolve(__dirname,'./settings.json'), 'settings.json.bak');
	
	fs.writeFile('./settings.json', JSON.stringify(settings, null, 2), function(err) {
		if(err) {
			console.log(err + '\nError while saving settings\n');
		} else {
			console.log('Settings saved');
		}
  });
}

/*









*/
//Login stuff

if (Auth.token !== '') {
  console.log('Logged in with token!');
  bot.login(Auth.token);
} else if (Auth.email !== '' && Auth.password !== '') {
  console.log('Logged in with email + pass!');
  bot.login(Auth.email, Auth.password);
} else {
  console.log('No authentication details found!');
  process.exit(1);
}

//Congrats! You read all of this bs!
//Or you scrolled all the way down, either way you didn't give up at the start
