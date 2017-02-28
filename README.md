# homebridge-dyson

[![Greenkeeper badge](https://badges.greenkeeper.io/simonrice/homebridge-dyson-nu.svg)](https://greenkeeper.io/)
HomeBridge interface to Dyson Link smart purifiers.

This HomeBridge plugin is experimental and not affiliated with, or endorsed by Dyson.

## Configuration

Connection to the Dyson Link smart accessory requires a username and password, both of which you can derive from your front sticker or user manual.

The username is your device serial ID - you can derive this from your product SSID by removing `DYSON-` from the start and `-475` from the end.  It is also shown on the Dyson Link app.

The password is a base-64 encoded SHA-512 hash of the password shown on your front sticker or user manual.  [You can use this online tool to help derive your encoded hash.](http://hash.online-convert.com/sha512-generator)

## Example HomeBridge config.json entry

```
"accessories": [
  {
    "accessory": "dyson-coollink",
    "name": "Purifier Cool Tower",
    "ip": "10.0.1.x",
    "username": "...",
    "password": "..."
  }
],
```
