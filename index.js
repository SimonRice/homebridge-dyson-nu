var Service, Characteristic;
const mqtt = require('mqtt');
const EventEmitter = require('events');
module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-dyson", "dyson-coollink", CoolLink);
    homebridge.registerAccessory("homebridge-dyson", "dyson-hotcoollink", HotCoolLink);
}
function CoolLink(log, config) {
    this.log = log;
    this.name = config['name'];
    this.ip = config['ip'];
    this.username = config["username"];
    this.password = config["password"];
    this.initConnection();
    this.initCommonSensors();
    this.initSpecificSensors();
}
CoolLink.prototype.initConnection = function() {
    this.url = 'mqtt://' + this.ip;
    this.options = {
        keepalive: 10,
        clientId: 'homebridge-dyson_' + Math.random().toString(16),
        protocolId: 'MQTT',
        protocolVersion: 4,
        clean: true,
        reconnectPeriod: 1000,
        connectTimeout: 30 * 1000,
        username: this.username,
        password: this.password,
        rejectUnauthorized: false
    };
    this.json_emitter = new EventEmitter();
    var that = this;
    this.mqtt_client = mqtt.connect(this.url, this.options);
    this.mqtt_client.on('connect', function() {
        that.mqtt_client.subscribe(that.getCurrentStatusTopic());
    })
    this.mqtt_client.on('message', function(topic, message) {
        json = JSON.parse(message);
        if (json !== null) {
            if (json.msg === "ENVIRONMENTAL-CURRENT-SENSOR-DATA") {
                that.json_emitter.emit('sensor', json);
            }
            if (json.msg === "CURRENT-STATE") {
                that.json_emitter.emit('state', json);
            }
        }
    });
}
CoolLink.prototype.initCommonSensors = function() {
    // Temperature sensor
    this.temperature_sensor = new Service.TemperatureSensor(this.name);
    this.temperature_sensor
        .getCharacteristic(Characteristic.CurrentTemperature)
        .setProps({minValue: -50, maxValue: 100})
        .on('get', this.getTemperature.bind(this));
    // Humidity sensor
    this.humidity_sensor = new Service.HumiditySensor(this.name);
    this.humidity_sensor
        .getCharacteristic(Characteristic.CurrentRelativeHumidity)
        .setProps({minValue: 0, maxValue: 100})
        .on('get', this.getRelativeHumidity.bind(this));
    // Air Quality sensor
    this.air_quality_sensor = new Service.AirQualitySensor(this.name);
    this.air_quality_sensor
        .getCharacteristic(Characteristic.AirQuality)
        .on('get', this.getAirQuality.bind(this));
    // Fan
    this.fan = new Service.Fan(this.name);
    this.fan
        .getCharacteristic(Characteristic.On)
        .on('get', this.isFanOn.bind(this))
        .on('set', this.setFan.bind(this));
    this.fan
        .getCharacteristic(Characteristic.On)
        .eventEnabled = true;
    this.fan
        .getCharacteristic(Characteristic.RotationSpeed)
        .on('get', this.getFanRotationSpeed.bind(this))
        .on('set', this.setFanRotationSpeed.bind(this));
    // Rotation switch
    this.rotation_switch = new Service.Switch("Rotation - " + this.name, "Rotation");
    this.rotation_switch
        .getCharacteristic(Characteristic.On)
        .on('get', this.isRotationOn.bind(this))
        .on('set', this.setRotation.bind(this));
}
CoolLink.prototype.initSpecificSensors = function() {
    // Auto switch
    this.auto_switch = new Service.Switch("Auto - " + this.name, "Auto");
    this.auto_switch
        .getCharacteristic(Characteristic.On)
        .on('get', this.isAutoOn.bind(this))
        .on('set', this.setAuto.bind(this));
    this.auto_switch
        .getCharacteristic(Characteristic.On)
        .eventEnabled = true;
}
CoolLink.prototype.getServices = function() {
    return [
        this.temperature_sensor,
        this.humidity_sensor,
        this.air_quality_sensor,
        this.fan,
        this.auto_switch,
        this.rotation_switch,
    ];
}
CoolLink.prototype.getMQTTPrefix = function() {
    return "475";
}
CoolLink.prototype.getCurrentStatusTopic = function() {
    return this.getMQTTPrefix() + '/' + this.username + '/status/current';
}
CoolLink.prototype.getCommandTopic = function() {
    return this.getMQTTPrefix() + '/' + this.username + '/command';
}
CoolLink.prototype.requestCurrentState = function() {
    if ((this.json_emitter.listenerCount('state') + this.json_emitter.listenerCount('sensor')) == 1) {
        this.mqtt_client.publish(
            this.getCommandTopic(),
            '{"msg":"REQUEST-CURRENT-STATE"}'
        );
    }
}
CoolLink.prototype.getTemperature = function(callback) {
    var that = this;
    this.json_emitter.once('sensor', (json) => {
        var temperature = parseFloat(json.data.tact) / 10 - 273.15;
        that.log("Temperature:", temperature.toFixed(2));
        callback(null, temperature);
    });
    this.requestCurrentState();
}
CoolLink.prototype.getRelativeHumidity = function(callback) {
    var that = this;
    this.json_emitter.once('sensor', (json) => {
        var relative_humidity = parseInt(json.data.hact);
        that.log("Humidity:", relative_humidity, "%");
        callback(null, relative_humidity);
    });
    this.requestCurrentState();
}
CoolLink.prototype.getAirQuality = function(callback) {
    var that = this;
    this.json_emitter.once('sensor', (json) => {
        var air_quality = Math.min(Math.max(Math.floor((parseInt(json.data.pact) + parseInt(json.data.vact)) / 2), 1), 5);
        that.log("Air Quality:", air_quality);
        callback(null, air_quality);
    });
    this.requestCurrentState();
}
CoolLink.prototype.isFanOn = function(callback) {
    var that = this;
    this.json_emitter.once('state', (json) => {
        var fmod = json['product-state']['fmod'];
        var on = (fmod === "FAN")
        that.log("Fan:", on);
        callback(null, on);
    });
    this.requestCurrentState();
}
CoolLink.prototype.setFan = function(value, callback) {
    var that = this;
    var now = new Date();
    var fmod = value ? "FAN" : "OFF";
    var message = '{"msg":"STATE-SET","time":"' + now.toISOString() + '","data":{"fmod":"' + fmod + '"}}';
    this.mqtt_client.publish(
        this.getCommandTopic(),
        message
    );
    this.auto_switch.getCharacteristic(Characteristic.On).updateValue(false);
    this.isFanOn(callback);
}
CoolLink.prototype.getFanRotationSpeed = function(callback) {
    var that = this;
    this.json_emitter.once('state', (json) => {
        var fnsp = parseInt(json['product-state']['fnsp']);
        var rotation_speed = fnsp * 10;
        that.log("Fan Speed:", rotation_speed, '%');
        callback(null, rotation_speed);
    });
    this.requestCurrentState();
}
CoolLink.prototype.setFanRotationSpeed = function(value, callback) {
    var that = this;
    var now = new Date();
    var fnsp = Math.round(value / 10);
    var message = '{"msg":"STATE-SET","time":"' + now.toISOString() + '","data":{"fnsp":"' + fnsp + '"}}'
    this.mqtt_client.publish(
        this.getCommandTopic(),
        message
    );
    this.getFanRotationSpeed(callback);
}
CoolLink.prototype.isAutoOn = function(callback) {
    var that = this;
    this.json_emitter.once('state', (json) => {
        var fmod = json['product-state']['fmod'];
        var on = (fmod === "AUTO")
        that.log("Auto:", on);
        callback(null, on);
    });
    this.requestCurrentState();
}
CoolLink.prototype.setAuto = function(value, callback) {
    var that = this;
    var now = new Date();
    var fmod = value ? "AUTO" : "OFF";
    var message = '{"msg":"STATE-SET","time":"' + now.toISOString() + '","data":{"fmod":"' + fmod + '"}}';
    this.mqtt_client.publish(
        this.getCommandTopic(),
        message
    );
    this.fan.getCharacteristic(Characteristic.On).updateValue(false);
    this.isAutoOn(callback);
}
CoolLink.prototype.isRotationOn = function(callback) {
    var that = this;
    this.json_emitter.once('state', (json) => {
        var oson = json['product-state']['oson'];
        var on = (oson === "ON")
        that.log("Rotation:", on);
        callback(null, on);
    });
    this.requestCurrentState();
}
CoolLink.prototype.setRotation = function(value, callback) {
    var that = this;
    var now = new Date();
    var oson = value ? "ON" : "OFF";
    var message = '{"msg":"STATE-SET","time":"' + now.toISOString() + '","data":{"oson":"' + oson + '"}}';
    this.mqtt_client.publish(
        this.getCommandTopic(),
        message
    );
    this.isRotationOn(callback);
}
function HotCoolLink(log, config) {
    CoolLink.call(this, log, config);
}
HotCoolLink.prototype = Object.create(CoolLink.prototype);
HotCoolLink.prototype.constructor = HotCoolLink;
HotCoolLink.prototype.getMQTTPrefix = function() {
    return "455";
}
