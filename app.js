"use strict";

var port = process.env.PORT || 1337;

var express = require('express');
var NodeCache = require('node-cache');
var markdown = require('markdown').markdown;

var config = {
	microsoftAccounts: require("./microsoft-github-accounts.json").accounts
};

if(process.env.GITHUB_TOKEN) {
	config.githubToken = process.env.GITHUB_TOKEN;
}

var wicgData = require('./wicg-data')(config);

var DAYS45 = 1000 * 60 * 60 * 24 * 45; // ms in 45 days

var app = express();
app.set('views', __dirname + '/views'); 
app.set('view engine', 'ejs'); 
app.use(express.static(__dirname + '/public'));

var dataCache = new NodeCache({
	stdTTL: 300,
	checkPeriod: 60
});

app.get('/',
	function(req, res) {
		res.redirect('wicg-updates');
	});

app.get('/wicg-updates',
  function(req, res) {
  	dataCache.get('updates',(err,data)=>{
  		if(!err && data) {
  			// data came from cache - render page
  			data.markdown = markdown;
		    res.render('home', data);
  		} else {
  			// data is not in cache - retrieve from GitHub
			var since = new Date(Date.now() - DAYS45).toISOString().substr(0,11) + "00:00:00Z"; //'2016-03-01T00:00:00';
			wicgData.getRecentUpdates(since).then(results => {
				// store in cache
				data = { retrieved: Date.now(), contributions: results, since: since };
				dataCache.set('updates', data);

				// render page
				data.markdown = markdown;
			    res.render('home', data);
			}).catch(err=>{ console.error('Error ' + err)});
  		}
  	});
  });

app.listen(port);
