# homebridge-dyson
HomeBridge interface to Dyson Link smart purifiers.

This HomeBridge plugin is experimental and not affiliated with, or endorsed by Dyson.

## Configuration

Connection to the Dyson Link smart accesory requires a username and password. While the username is the one provided on the sticker affixed to the device, the password is uniquely generated during the initial setup phase and will need to be dumped and extracted from the network traffic between the Dyson Link app and the device.

## HomeBridge config.json entry

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
