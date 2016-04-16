"use strict";

var GitHubApi = require("github4");

function WICGdata(config) {
	config = config || {};
	if(!config.microsoftAccounts) throw "Must provide microsoftAccounts";

	var _github = new GitHubApi({
	    version: "3.0.0",
	    //debug: true,
	    protocol: "https"
	});

	if(config.githubToken) {
		_github.authenticate({
			type: 'token',
			token: config.githubToken
		});
	}

	this.getRecentUpdates = function(SINCE) {
		return getRepos().then(repos => {
			var pp = [];
			repos.forEach(repo => {
				// Get all commits since SINCE and filter to only Microsoft authors or committers
				pp.push(getCommits(repo.name,SINCE).then(commits => {
					var r1 = filterByMicrosoft(commits,c=>c.author && c.author.login ? c.author.login : "")
						.map(c => mapCommit(c,'commit-author',repo.name,cc=>cc.author,cc=>cc.commit.author.date));
					var r2 = filterByMicrosoft(commits,c=>c.committer && c.committer.login ? c.committer.login : "")
						.map(c => mapCommit(c,'commit-committer',repo.name,cc=>cc.committer,cc=>cc.commit.committer.date))
						.filter(d => r1.filter(x => x.url===d.url).length===0); // this filter removes duplicates where author==committer
					Array.prototype.push.apply(r1,r2);
					return r1;
				}));

				// Get all comments on pull requests since SINCE and filter to only Microsoft commenters
				pp.push(getPRComments(repo.name,SINCE).then(comments => 
					filterByMicrosoft(comments,c=>c.user.login).map(c => ({
						type: 'pr-comment',
						contributor: c.user.login,
						contributorImage: c.user.avatar_url,
						repo: repo.name,
						message: c.body,
						url: c.html_url,
						date: c.created_at
					}))
				));

				// Get all comments on issues since SINCE and filter to only Microsoft commenters
				pp.push(getIssueComments(repo.name,SINCE).then(comments =>
					filterByMicrosoft(comments,c=>c.user.login).map(c => ({
						type: 'issue-comment',
						contributor: c.user.login,
						contributorImage: c.user.avatar_url,
						repo: repo.name,
						message: c.body,
						url: c.html_url,
						date: c.created_at
					}))
				));
			});

			// Gather all the promises and then wait for them all to resolve
			return Promise.all(pp).then(arr => {
				var contributions = [];
				arr.forEach(a => { Array.prototype.push.apply(contributions,a); });

				contributions.sort((a,b) => {
					var ar = a.repo.toLowerCase();
					var br = b.repo.toLowerCase();
					// sort by repo name and then by date
					return ar===br ? (
							a.date < b.date ? -1 : (a.date > b.date ? 1 : 0)
						) : (ar < br ? -1 : 1);
				});

				return contributions;
			});
		});
	};

	function getRepos() {
		return new Promise((resolve,reject) => {
			_github.repos.getForOrg({org:'wicg'},(err,result)=>{
				if(err) {
					reject(err);
				} else {
					resolve(result);
				}
			});
		});
	}

	function getCommits(repo,since) {
		return new Promise((resolve,reject) => {
			_github.repos.getCommits({user:'wicg',repo:repo,since:since},(err,result)=> {
				if(err) {
					reject(err);
				} else {
					resolve(result);
				}
			});
		});
	}

	function getPRComments(repo,since) {
		return new Promise((resolve,reject) => {
			_github.pullRequests.getCommentsForRepo({user:'wicg',repo:repo,since:since},(err,result)=> {
				if(err) {
					reject(err);
				} else {
					resolve(result);
				}
			});
		});
	}

	function getIssueComments(repo,since) {
		return new Promise((resolve,reject) => {
			_github.issues.getCommentsForRepo({user:'wicg',repo:repo,since:since},(err,result)=> {
				if(err) {
					reject(err);
				} else {
					resolve(result);
				}
			});
		});
	}

	function filterByMicrosoft(data,filterFunc) {
		return data.filter(c => config.microsoftAccounts.indexOf(filterFunc(c).toLowerCase()) !== -1);
	}

	function mapCommit(c,type,repoName,userFunc,dateFunc) {
		var user = userFunc(c);
		return {
			type: type,
			contributor: user.login,
			contributorImage: user.avatar_url,
			repo: repoName,
			message: c.commit.message,
			url: c.html_url,
			date: dateFunc(c)
		};
	}

};

module.exports = function(config) {
	return new WICGdata(config);
};