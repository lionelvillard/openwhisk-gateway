Simple action gateway for Apache OpenWhisk.


## Features


Currently implemented:

* Policy-based routing
  * match action name: reroute action when name matches a pattern 
  * match header: reroute action based on HTTP header 
  * canary (TDB)

Plan feature:
* Authentication
 
## Quick start

Install the gateway

```bash
$ ./build.sh
$ wsk action create gateway build/action.zip \
      --kind node:js -P <config.json>
```

Define an action name to be used by other services and connect to gateway

```bash
$ wsk action create <actionName>_fwd actions/forward_action_name.js
$ wsk action create <actionName> --sequence <actionName>_fwd,gateway
```


## Configuration

### Policy-based routing

#### Match action name routing

```json
{
  "gateway": {
    "routes": [{
      "match_name": "/$ns/$package/$action",
      "target": "/$ns/$package_v1/action"
    }]
  }
}
```

#### Match header routing

(not yet implemented)

```json
{
  "gateway": {
    "routes": [{
      "match_name": "/$ns/$package/$action",
      "target": "/$ns/$package_v1/action",
      "match_header": [{
        "name": "X-testing",
        "value": "true"
      }]
    }]
  }
}
```
