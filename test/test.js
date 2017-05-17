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
const test = require('ava');
const express = require('express');
const openwhisk = require('openwhisk');
const fs = require('fs');


test.before(t => {
    if (!process.env.__OW_API_HOST || !process.env.__OW_API_KEY)
        throw "Missing __OW_API_HOST and/or __OW_API_KEY in the environment"

    const action = fs.readFileSync('build/action.zip');
    const fwaction = fs.readFileSync('actions/forward_action_name.js').toString();

    const seqaction = {
        exec: {
            kind: 'sequence',
            components: ['/_/routingtests/forward_action_name', '/_/routingtests/gateway']
        }
    };

    let ow = openwhisk();

    // Create packages
    return ow.packages.create({
        name: 'routingtests_latest',
        overwrite: true
    })
        .then(() => ow.packages.create({
            name: 'routingtests_v1',
            overwrite: true
        }))
        .then(() => ow.packages.create({
            name: 'routingtests',
            overwrite: true
        }))

        // create shared gateway actions

        .then(() => ow.actions.create({
            name: 'routingtests/gateway',
            action,
            params: {
                gateway: {
                    routes: [
                        {
                            match_name: "/$ns/$package/action2",
                            target: "/$ns/$package_v1/action2"
                        },
                        {
                            match_name: "/$ns/$package/$action",
                            target: "/$ns/$package_latest/$action"
                        }]
                }
            },
            overwrite: true
        }))

        // Create real actions

        .then(() => ow.actions.create({
            name: 'routingtests_latest/action1',
            action: 'function main(args) { return { statusCode: 200, body: "latest hello" }; }',
            overwrite: true
        }))
        .then(() => ow.actions.create({
            name: 'routingtests_v1/action2',
            action: 'function main(args) { return { statusCode: 200, body: "hello from action2" }; }',
            overwrite: true

        }))

        // Connect exposed action to gateway

        .then(() => ow.actions.create({
            name: 'routingtests/action_doesnotexist_fwd',
            action: fwaction,
            overwrite: true
        }))
        .then(() => ow.actions.create({
            name: 'routingtests/action_doesnotexist',
            action: {
                exec: {
                    kind: 'sequence',
                    components: ['/_/routingtests/action_doesnotexist_fwd', '/_/routingtests/gateway']
                }
            },
            overwrite: true
        }))

        .then(() => ow.actions.create({
            name: 'routingtests/action1_fwd',
            action: fwaction,
            overwrite: true
        }))
        .then(() => ow.actions.create({
            name: 'routingtests/action1',
            action: {
                exec: {
                    kind: 'sequence',
                    components: ['/_/routingtests/action1_fwd', '/_/routingtests/gateway']
                }
            },
            overwrite: true
        }))

        .then(() => ow.actions.create({
            name: 'routingtests/action2_fwd',
            action: fwaction,
            overwrite: true
        }))
        .then(() => ow.actions.create({
            name: 'routingtests/action2',
            action: {
                exec: {
                    kind: 'sequence',
                    components: ['/_/routingtests/action2_fwd', '/_/routingtests/gateway']
                }
            },
            overwrite: true
        }));
});

test.after.always(t => {

});


test('should call non-existent latest action', t => {
    t.plan(1);

    let ow = openwhisk();
    return ow.actions.invoke({
        actionName: '/_/routingtests/action_doesnotexist',
        params: {
            __ow_method: 'get',
            __ow_path: '/'
        },
        blocking: true
    }).then(result => {
        result = result.response.result;
        t.is(result.statusCode, 500);
    });
});

test('should call latest action', t => {
    t.plan(2);

    let ow = openwhisk();
    return ow.actions.invoke({
        actionName: '/_/routingtests/action1',
        params: {
            __ow_method: 'get',
            __ow_path: '/'
        },
        blocking: true
    }).then(result => {
        result = result.response.result;

        t.is(result.statusCode, 200);
        t.is(result.body, 'latest hello');
    });

});

test('should call v1 action', t => {
    t.plan(2);

    let ow = openwhisk();
    return ow.actions.invoke({
        actionName: '/_/routingtests/action2',
        params: {
            __ow_method: 'get',
            __ow_path: '/'
        },
        blocking: true
    }).then(result => {
        result = result.response.result;

        t.is(result.statusCode, 200);
        t.is(result.body, 'hello from action2');
    });

});

