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
    process.env.__OW_API_HOST = 'openwhisk.ng.bluemix.net';
    process.env.__OW_API_KEY = '9840f914-cedf-4796-a249-433d4fc340e9:RH4TvE2Pm6U6DfTlsLBz6GPmKqPVOwjCpYF5KN5gp7d3189AojRV2Vj0YBJxmSrp';

    const action = fs.readFileSync('build/action.zip');

    let ow = openwhisk();
    return ow.packages.create({
        name: 'bluegreentests_latest',
        overwrite: true
    }).then(() => ow.packages.create({
        name: 'bluegreentests_v1',
        overwrite: true
    })).then(() => ow.packages.create({
        name: 'bluegreentests',
        overwrite: true
    })).then(() => ow.actions.create({
        name: '/_/bluegreentests_latest/action1',
        action: 'function main(args) { return { statusCode: 200, body: "hello" }; }',
        overwrite: true
    })).then(() => ow.actions.create({
        name: '/_/bluegreentests_v1/action1',
        action: 'function main(args) { return { statusCode: 200, body: "hello2" }; }',
        overwrite: true
    })).then(() => ow.actions.create({
        name: '/_/bluegreentests/action1',
        action,
        overwrite: true
    })).then(() => ow.actions.create({
        name: '/_/bluegreentests/action_doesnotexist',
        action,
        overwrite: true
    })).then(() => ow.actions.create({
        name: '/_/bluegreentests/action2',
        action,
        params: {
            bluegreen: {
                routes: [{
                    action: "/$ns/$package/$action",
                    redirect: "/$ns/$package_v1/action1"
                }]
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
        actionName: '/_/bluegreentests/action_doesnotexist',
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
        actionName: '/_/bluegreentests/action1',
        params: {
            __ow_method: 'get',
            __ow_path: '/'
        },
        blocking: true
    }).then(result => {
        result = result.response.result;

        t.is(result.statusCode, 200);
        t.is(result.body, 'hello');
    });

});

test('should call v1 action', t => {
    t.plan(2);

    let ow = openwhisk();
    return ow.actions.invoke({
        actionName: '/_/bluegreentests/action2',
        params: {
            __ow_method: 'get',
            __ow_path: '/'
        },
        blocking: true
    }).then(result => {
        result = result.response.result;

        t.is(result.statusCode, 200);
        t.is(result.body, 'hello2');
    });

});

