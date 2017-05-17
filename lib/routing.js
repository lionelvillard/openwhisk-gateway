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


/*
 Receives HTTP request
 */
function handleRequest(req, res, next) {
    console.log(req.app.action_params);
    let nextaction = handleAction(req.app.action_params);

    if (nextaction === false)
        next();
    else {
        nextaction
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
}


/*
 Invoke action based on routing configuration

 @param {Object}     params - Original request parameters
 @param {Object[]}   params.gateway.routes
 @param {string}     params.gateway.routes[].match_name
 @param {string}     params.gateway.routes[].target
 @param {Object[]}   [params.gateway.routes[].match_headers]
 */
function handleAction(params) {
    let gateway = params.gateway;
    if (!gateway || !gateway.routes)
        return false;

    let routes = gateway.routes;
    let actionName = params.gateway_action_name || process.env.__OW_ACTION_NAME;
    delete params.gateway;

    for (let i in routes) {
        let route = routes[i];
        let pattern = route.match_name;
        let jspattern = toJSPattern(pattern);
        let match = actionName.match(new RegExp(jspattern.pattern));
        if (match) {
            // Redirect...
            let targetActionName = resolve(jspattern, match, route);
            let ow = openwhisk();
            return ow.actions.invoke({
                actionName: targetActionName,
                params,
                blocking: true
            });
        }
    }

    // None of the route matched.
    return Promise.reject('Bad gateway');
}

function resolve(jspattern, match, route) {
    let splits = route.target.split(/(\$[a-zA-Z0-9]+)/);
    let result = '';
    for (let i in splits) {
        let string = splits[i];
        if (string.startsWith('$')) {
            let index = jspattern.groups[string];
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
    let jspattern = {
        pattern: '^',
        groups: {}
    };
    for (let i in splits) {
        let string = splits[i];
        if (string.startsWith('$')) {  // '$' cannot be part of an action name, so we're good.
            if (jspattern.groups[string]) {
                // duplicated!
                throw `Error: ${string} occurs at least twice`;
            }

            jspattern.groups[string] = count++;
            jspattern.pattern += '([\\w]|[\\w][\\w@ .\\-]*[\\w@.\\-]+)';
        } else {
            jspattern.pattern += string;
        }
    }
    jspattern.pattern += '$';
    return jspattern;
}
