"use strict";

var port = process.env.PORT || 8880;

var express = require('express');
var NodeCache = require('node-cache');
var marked = require('marked');

var config = {
	microsoftAccounts: require("./microsoft-github-accounts.json").accounts
};

if(process.env.GITHUB_TOKEN) {
	config.githubToken = process.env.GITHUB_TOKEN;
}

var ghData = require('./gh-data')(config);

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

app.get('/wicg-updates.json',
	function(req, res) {
	  	getGHData('wicg').then(data => {
	  		res.type('application/json');
	  		res.set('Access-Control-Allow-Origin','*');
	  		res.json(data);
	  	}).catch(err => {
	  		console.error('Error ' + err);
	  	});
	});

app.get('/wicg-updates',
  function(req, res) {
  	getGHData('wicg').then(data => {
		data.marked = marked;
		data.name = "WICG";
		data.org = 'wicg';
	    res.render('home', data);
  	}).catch(err => {
  		console.error('Error ' + err);
  	});
  });

app.get('/gpuweb-updates.json',
	function(req, res) {
	  	getGHData('gpuweb').then(data => {
	  		res.type('application/json');
	  		res.set('Access-Control-Allow-Origin','*');
	  		res.json(data);
	  	}).catch(err => {
	  		console.error('Error ' + err);
	  	});
	});

app.get('/gpuweb-updates',
  function(req, res) {
  	getGHData('gpuweb').then(data => {
		data.marked = marked;
		data.name = 'GPU for the Web';
		data.org = 'gpuweb';
	    res.render('home', data);
  	}).catch(err => {
  		console.error('Error ' + err);
  	});
  });

function getGHData(org,days) {
	org = org || 'wicg';
	days = days || 45;
	const cacheName = 'updates-' + org;
	return new Promise((resolve,reject) => {
	  	dataCache.get(cacheName,(err,data)=>{
	  		if(!err && data) {
	  			// data came from cache
	  			resolve(data);
	  		} else {
	  			// data is not in cache - retrieve from GitHub
	  			const DAY_IN_MS = 1000 * 60 * 60 * 24;
				var since = new Date(Date.now() - (days*DAY_IN_MS)).toISOString().substr(0,11) + "00:00:00Z";

				ghData.getRecentUpdates(org,since).then(results => {
					// store in cache
					data = { retrieved: Date.now(), contributions: results, since: since };
					dataCache.set(cacheName, data);
					resolve(data);
				}).catch(err=>{
					reject(err);
				});
	  		}
	  	});
	});
}

app.listen(port);
