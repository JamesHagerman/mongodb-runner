# MongoDB Runner

Mongo Runner is a VSCode plugin helps developers to connect to their MongoDB instance to do some basic operations such as: `simple query`, `tree topology`, `index`, `server statistics` etc.

## Features

Mongo Runner provides general operations about using MongoDB. It can connect to Mongo Single Instance, Mongo Replicaset and Mongo Shard Cluster.

For example below is a sceenshot of Mongo Shard Cluster Topology:

![MongoDB Shard Cluster Topology](https://raw.githubusercontent.com/zhaoyi0113/mongodb-runner/master/images/shard-ss.png)

## Requirements

NA

## Extension Settings

Setup MongoDB Connection in your workspace setting.

```json
"mongoRunner": {
        "connections": [
            {
                "url": "mongodb://localhost:27017/test"
            },
            {
                "url": "mongodb://localhost:27018/test"
            }
        ]
    }
```

In order to secure user's password, we don't support put password in the configuration file as plain text. Instead, when you specify the user name in the configuration file, `MongoDB Runner` will prompt you to input the password.

### SSL Connection

For SSl connection, please use `options` configuration. You can also put all other mongo connection options there.

```json
"mongoRunner": {
        "connection": [{
            "url": "mongodb://localhost:27017",
            "user": "username",
            "options": {
                "ssl": true
            }
        }]
    }
```

### Private key connection setting

```json
"mongoRunner": {
        "connection": [{
            "url": "mongodb://localhost:27017",
            "user": "username",
            "options": {
                "sslCert": "/Users/Document/mongodb.pem",
                "sslKey": "/Users/Document/mongodb-cert.key",
                "ssl": true
            }
        }]
    }
```

## Query

### Simple Query

User below format for querying `ObjectId`:

```json
{ "_id": "ObjectId(5ba2bfcf6d2a0312c7ec12c6)" }
```

## Known Issues

Please submit any issues you found or any suggestions on github issues.

## Support MongoDB Runner
While MongoDB Runner is generously offered to everyone free of charge, if you find it useful, please consider supporting it.

[**Donate via PayPal**](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=W75BXQ3XP6VUL&item_name=MongoDB+Runner&currency_code=USD&source=url)

## Release Notes

### 0.0.1

Initial release.

### 0.0.5

Update plugin icon.
Support all mongodb connection options.
Update replicatset tree icon.

### 0.0.6

Enable private key connection
Enable setting password in the configuration

### 0.0.7

Fix configuration schema warning errors

### 0.0.8

Add support for query ObjectID

### 0.0.9

Add refresh button

### 0.0.10 - 0.0.12

Support manually input database password
Order menu items

### 0.0.17

Support loading mutiple MongoDB connections