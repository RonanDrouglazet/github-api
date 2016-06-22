var https = require('https'),
btoa = require('btoa'),
atob = require('atob'),
querystring = require('querystring'),
conf = {},
eventHandlers = {},
pollOngoing = {};


/**
 * @static EVENTS GitHub Api event
 * @see https://developer.github.com/v3/activity/events/types/
 */
exports.EVENTS = {
   COMMIT_COMMENT: "CommitCommentEvent",
   CREATE: "CreateEvent",
   DELETE: "DeleteEvent",
   DEPLOY: "DeploymentEvent",
   DEPLOY_STATUS: "DeploymentStatusEvent",
   DOWNLOAD: "DownloadEvent",
   FOLLOW: "FollowEvent",
   FORK: "ForkEvent",
   FORK_APPLY: "ForkApplyEvent",
   GIST: "GistEvent",
   GOLLUM: "GollumEvent",
   ISSUE_COMMENT: "IssueCommentEvent",
   ISSUES: "IssuesEvent",
   MEMBER: "MemberEvent",
   PAGE_BUILD: "PageBuildEvent",
   PUBLIC: "PublicEvent",
   PULL_REQUEST: "PullRequestEvent",
   PULL_REQUEST_REVIEWED: "PullRequestReviewCommentEvent",
   PUSH: "PushEvent",
   RELEASE: "ReleaseEvent",
   STATUS: "StatusEvent",
   TEAM_ADD: "TeamAddEvent",
   WATCH: "WatchEvent"
}

/**
 * @method gitHubApiRequest create https request for github api
 * @param accessToken user's access token get by oauth
 * @param method GET or POST
 * @param path root to call on GH API
 * @param params optional
 * @param headers optional
 * @param done(payload)
 * @see https://developer.github.com/v3/
 */
exports.gitHubApiRequest = function(accessToken, method, path, params, headers, done) {
    var dataObject = "", options = {
      headers: {"User-Agent": "GRebase", "Authorization": "token " + accessToken, "Content-Length": params ? JSON.stringify(params).length : 0},
      hostname: 'api.github.com',
      port: 443,
      path: path,
      method: method
    };

    if (headers) {
        for (var i in headers) {
            if (headers.hasOwnProperty(i)) {
                options.headers[i] = headers[i];
            }
        }
    }

    var r = https.request(options, function(res) {
        res.on('data', function (chunk) {
            dataObject += chunk.toString();
        });

        res.on('end', function() {
            try {
                dataObject = dataObject !== "" ? JSON.parse(dataObject) : null;
            } catch(e) {
                console.error(true, [method, path, params]);
                console.error(true, [dataObject]);
                console.error(true, [e]);
            }

            done(null, dataObject, res);
        });
    });

    r.on('error', function(error) {
        console.error(true, [error]);
        done(error, null, null);
    });

    if (params) {
        r.write(JSON.stringify(params));
    }

    r.end();
}

/**
 * @method getAllBranch return a list of repo's branches
 * @param accessToken user's access token get by oauth
 * @param owner repo's owner
 * @param repo repository
 * @param done(branches_list)
 * @see https://developer.github.com/v3/repos/#list-branches
 */
exports.getAllBranch = function(accessToken, owner, repo, done) {
    exports.gitHubApiRequest(accessToken, "GET", "/repos/" + owner + "/" + repo + "/branches", null, null, done);
}

/**
 * @method getBranch return a branch objet
 * @param accessToken user's access token get by oauth
 * @param owner repo's owner
 * @param repo repository
 * @param branch branch to get
 * @param done(branch_object)
 * @see https://developer.github.com/v3/repos/#get-branch
 */
exports.getBranch = function(accessToken, owner, repo, branch, done) {
    exports.gitHubApiRequest(accessToken, "GET", "/repos/" + owner + "/" + repo + "/branches/" + branch, null, null, done);
}

/**
 * @method getCommit return a specific commit object
 * @param accessToken user's access token get by oauth
 * @param owner repo's owner
 * @param repo repository
 * @param sha commit's sha1
 * @param done(commit_object)
 * @see https://developer.github.com/v3/repos/commits/#get-a-single-commit
 */
exports.getCommit = function(accessToken, owner, repo, sha, done) {
    exports.gitHubApiRequest(accessToken, "GET", "/repos/" + owner + "/" + repo + "/commits/" + sha, null, null, done);
}

/**
 * @method getUser return the user authenticated info objet
 * @param userToken user's access token get by oauth
 * @param done(user_authenticated_info_object)
 * @see https://developer.github.com/v3/users/#get-the-authenticated-user
 */
exports.getUser = function(userToken, done) {
    exports.gitHubApiRequest(userToken, "GET", "/user", null, null, done);
}

/**
 * @method getRepos return the user authenticated info objet
 * @param userToken user's access token get by oauth
 * @param type can be all, owner, public, private, member
 * @param done(user_authenticated_repos_object)
 * @see https://developer.github.com/v3/repos/#list-your-repositories
 */
exports.getRepos = function(userToken, type, done) {
    exports.gitHubApiRequest(userToken, "GET", "/user/repos?sort=created&type=" + type, null, null, done);
}

/**
 * @method doesIssueExist check if issue already exist on repo
 * @param accessToken user's access token get by oauth
 * @param owner repo's owner
 * @param repo repository
 * @param title issue's title
 * @param done(issue_object)
 * @see https://developer.github.com/v3/issues/#list-issues-for-a-repository
 */
exports.doesIssueExist = function(accessToken, owner, repo, title, done) {
    var issueFound = null;
    exports.gitHubApiRequest(accessToken, "GET", "/repos/" + owner + "/" + repo + "/issues", null, null, function(error, data, res) {
        if (!error && data && data.length) {
            data.forEach(function(issue, index) {
                if (issue.title === title) {
                    issueFound = issue;
                }
            });
            done(error, issueFound);
        } else {
            done(error, null);
        }
    });
}

/**
 * @method createIssueOnRepo create an issue on repo if not exist
 * @param accessToken user's access token get by oauth
 * @param owner repo's owner
 * @param repo repository
 * @param title issue's title
 * @param body issue's body
 * @see https://developer.github.com/v3/issues/#create-an-issue
 */
exports.createIssueOnRepo = function(accessToken, owner, repo, title, body) {
    exports.doesIssueExist(accessToken, owner, repo, title, function(error, issue) {
        if (!error && !issue) {
            exports.gitHubApiRequest(accessToken, "POST", "/repos/" + owner + "/" + repo + "/issues", {title: title, body: body}, null, function() {});
        }
    });
}

/**
 * @method closeIssueOnRepo close issue on repo if issue exist
 * @param accessToken user's access token get by oauth
 * @param owner repo's owner
 * @param repo repository
 * @param title issue's title
 * @see https://developer.github.com/v3/issues/#edit-an-issue
 */
exports.closeIssueOnRepo = function(accessToken, owner, repo, title) {
    exports.doesIssueExist(accessToken, owner, repo, title, function(error, issue) {
        if (!error && issue) {
            exports.gitHubApiRequest(accessToken, "PATCH", "/repos/" + owner + "/" + repo + "/issues/" + issue.number, {state: "closed"}, null, function() {});
        }
    });
}

/**
 * @private loopPollForRepoEvent recursive poll to listen repo event
 * @param accessToken user's access token get by oauth
 * @param owner repo's owner
 * @param repo repository
 * @see https://developer.github.com/v3/activity/events/#list-repository-events
 */
var loopPollForRepoEvent = function(accessToken, owner, repo) {
    var etag = null;
    var lastEventId = null;

    var pollRequest = function() {
        exports.gitHubApiRequest(accessToken, "GET", "/repos/" + owner + "/" + repo + "/events", null, etag, function(error, events, response) {
            if (!error) {
                var h = response.headers;
                var time =  parseInt(h["x-poll-interval"], 10);
                var ntag = h.etag;

                if (h.status === "200 OK") {
                    var newEventId = events[0].id;
                    if (etag) {
                        while (events[0].id !== lastEventId) {
                            if (eventHandlers[repo][events[0].type]) {
                                eventHandlers[repo][events[0].type].forEach(function(callback, index) {
                                    callback(events[0], events[0].type);
                                });
                            }
                            events.shift()
                        }
                    }
                    lastEventId = newEventId;
                }

                if (ntag) {
                    etag = {"If-None-Match": ntag};
                }

                setTimeout(pollRequest, time * 1000);
            }
        });
    }

    pollRequest();
}

/**
 * @method addEventOnRepo listen for a specific GitHub Api event on a repo
 * @param accessToken user's access token get by oauth
 * @param owner repo's owner
 * @param repo repository
 * @param eventName GitHub event (githubapi.EVENTS)
 * @param handler(object_event)
 * @see https://developer.github.com/v3/activity/events/#list-repository-events
 */
exports.addEventOnRepo = function(accessToken, owner, repo, eventName, handler) {
    if (!eventHandlers[repo]) {
        eventHandlers[repo] = {};
    }
    if (!eventHandlers[repo][eventName]) {
        eventHandlers[repo][eventName] = [];
    }

    eventHandlers[repo][eventName].push(handler);

    if (!pollOngoing[repo]) {
        pollOngoing[repo] = true;
        loopPollForRepoEvent(accessToken, owner, repo);
    }
}

/**
 * @private sendResponseForOAuth
 * @param req
 * @param res
 * @param done(github_access_token)
 * FIXME see to merge this function with exports.gitHubApiRequest
 */
var sendResponseForOAuth = function(req, res, done) {
    var access_token, dataObject, options = {
        hostname: "github.com",
        port: 443,
        path: "/login/oauth/access_token",
        method: "POST"
    };
    var host = atob(req.query.state);

    var gitResponse = https.request(options, function(resG) {
        resG.on("data", function (chunk) {
            dataObject = querystring.parse(chunk.toString());
            if (dataObject.access_token) {
                access_token = dataObject.access_token;
                done(req, res, access_token);
            }
        });
    });

    gitResponse.on("error", function(error) {
        console.error(true, ["sendResponseForOAuth error", error]);
        res.write(error);
        res.send();
    });

    gitResponse.write("client_id=" + conf[host].id + "&client_secret=" + conf[host].secret + "&code=" + req.query.code + "&state=" + req.query.state);
    gitResponse.end();
}

/**
 * @method oauth get oauth token from GitHubAPI
 * @param req
 * @param res
 * @param done(github_access_token)
 * @see https://developer.github.com/v3/oauth/
 */
exports.oauth = function(done, scope) {
    return function(req, res) {
        if (!conf[req.hostname]) {
            console.error("githubapi: (oauth) miss app infos, call init(domain, app_id, app_secret, app_redirect) before");
            res.send();
        } else if (!req.query.code) {
            res.redirect("https://github.com/login/oauth/authorize?redirect_uri=" + conf[req.hostname].redirect + req.path + "&scope=" + scope + "&client_id=" + conf[req.hostname].id + "&state=" + btoa(req.hostname));
        } else if (req.query.code) {
            sendResponseForOAuth(req, res, done);
        }
    }
}

/**
 * @method init init githubapi module with github app infos
 * @param app_id
 * @param app_secret
 * @param app_redirect
 * @see https://github.com/settings/applications
 */
exports.init = function(domain, app_id, app_secret, app_redirect) {
    if (arguments.length !== 4) {
        console.error("githubapi: (init) missing arguments");
    } else {
        conf[domain] = {
            id: app_id,
            secret: app_secret,
            redirect: app_redirect
        };
    }
}
