/*
 * Copyright 2017 IBM Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* Export as Express.js middleware */
module.exports.middleware = handleRequest;

/* Export as OpenWhisk action */
module.exports.action = handleAction;

const openwhisk = require('openwhisk');

const defaultConfig = {
    routes: [{
        action: "/$ns/$package/$action",
        redirect: "/$ns/$package_latest/$action"
    }]
};

/*
 Receives HTTP request augmented with bluegreen deployment configuration

 @param {Object}   req.action_params.bluegreen
 @param {Object}   req.action_params.bluegreen
 @param {Object[]} req.action_params.bluegreen.routes
 @param {string}   req.action_params.bluegreen.routes[].action
 @param {string}   req.action_params.bluegreen.routes[].redirect
 @param {Object[]} [req.action_params.bluegreen.routes[].match_headers]
 */
function handleRequest(req, res, next) {
    console.log(req.app.action_params);
    handleAction(req.app.action_params || {})
        .then((r) => {
            r = r.response.result;

            let sc = r.statusCode || 200;
            res.writeHead(sc, r.headers);
            if (r.body)
                res.write(r.body);
            res.end();
        })
        .catch(e => {
            // delegate to error-handling middleware.
            console.log(e);
            next(e);
        });
}


/*
 Invoke action based on bluegreen configuration

 @param {Object}   params - Original request parameters
 @param {Object}   params.bluegreen
 @param {Object[]} params.bluegreen.routes
 @param {string}   params.bluegreen.routes[].action
 @param {string}   params.bluegreen.routes[].redirect
 @param {Object[]} [params.bluegreen.routes[].match_headers]
 */
function handleAction(params) {
    let config = params.bluegreen || defaultConfig;
    delete params.bluegreen;

    let routes = config.routes;
    for (let i in routes) {
        let targetActionName = resolve(routes[i], process.env.__OW_ACTION_NAME);
        let ow = openwhisk();
        return ow.actions.invoke({
            actionName: targetActionName,
            params,
            blocking: true
        });
    }
}

function resolve(route, actionName) {
    let pattern = route.action;
    let named = toJSPattern(pattern);

    let match = actionName.match(new RegExp(named.pattern)); // not null
    let splits = route.redirect.split(/(\$[a-zA-Z0-9]+)/);
    let result = '';
    for (let i in splits) {
        let string = splits[i];
        if (string.startsWith('$')) {
            let index = named.groups[string];
            if (index === undefined) {
                throw `Error: ${string} has not been defined.`;
            }
            let substitute = match[index + 1];
            result += substitute;

        } else {
            result += string;
        }
    }
    return result;
}


/* Helper function converting a simplified named pattern into a JS pattern and a map */
function toJSPattern(pattern) {
    let splits = pattern.split(/(\$[a-zA-Z0-9]+)/);
    let count = 0;
    let named = {
        pattern: '^',
        groups: {}
    };
    for (let i in splits) {
        let string = splits[i];
        if (string.startsWith('$')) {  // '$' cannot be part of an action name, so we're good.
            if (named.groups[string]) {
                // duplicated!
                throw `Error: ${string} occurs at least twice`;
            }

            named.groups[string] = count++;
            named.pattern += '([\\w]|[\\w][\\w@ .\\-]*[\\w@.\\-]+)';
        } else {
            named.pattern += string;
        }
    }
    named.pattern += '$';
    return named;
}
