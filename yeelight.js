'use strict';

const Color = require("color");
const colorTemp = require("color-temp");
const EventEmitter = require("events");
const net = require("net");

const SOCKET_TIMEOUT = 5000;
const REQUEST_TIMEOUT = 5000;

//specs: http://www.yeelight.com/download/Yeelight_Inter-Operation_Spec.pdf

class Yeelight extends EventEmitter
{
    constructor(ssdpMessage)
    {
        super();

        //socket
        this.connected = false;
        this.socket = null;

        //messages object
        this.messageId = 1;
        this.messages = {};

        //on/off state
        this.power = false;

        this.id = "";
        this.name = "";

        this.host = "";
        this.port = "";
        this.mac = ""; //existance of this value not guaranteed (if the light is not in the same net)

        //type ("unknown","white","color")
        this.type = "unknown";

        this.firmware = "";
        this.support = "";

        //color values
        this.bright = 0;
        this.rgb = {r: 0, g: 0, b: 0};
        this.hsb = {h: 0, s: 0, b: 0};

        //init
        if (ssdpMessage)
        {
            this.updateBySSDPMessage(ssdpMessage);

            //connect
            this.connect();
        }
    }

    getState()
    {
        let state =
        {
            type: this.type,
            power: this.power,
            bright: this.bright,
            rgb: this.rgb,
            hsb: this.hsb
        };

        return state;
    }

    init(host,port,mac)
    {
        this.mac = mac;
        this.host = host;
        this.port = port;

        //connect and get initial data
        this.connect();
        this.updateState().then(() => {}).catch((error =>
        {
            console.log(error);
        }));
    }

    updateBySSDPMessage(ssdpMessage)
    {
        this.id = ssdpMessage.ID;
        this.name = ssdpMessage.NAME || "";

        this.model = ssdpMessage.MODEL;
        this.firmware = ssdpMessage.FW_VER;
        this.support = ssdpMessage.SUPPORT;

        //get hostname and port
        let location = ssdpMessage.LOCATION;
        const regex = /\/\/(.*):(.*)/g;
        let matches = regex.exec(location);

        if (matches && matches.length >= 3)
        {
            this.host = matches[1];
            this.port = parseInt(matches[2]);
        }

        //detect type
        if (this.support)
        {
            let supported = this.support.split(" ");
            if (supported.indexOf("set_rgb") != -1 || supported.indexOf("set_hsv") != -1 || supported.indexOf("set_ct_abx") != -1)
                this.type = "color";
        }

        this.updatePower(ssdpMessage.POWER);

        this.updateColorbySSDPMessage(ssdpMessage);
    }

    updateColorbySSDPMessage(ssdpMessage)
    {
        //1 means color mode, 2 means color temperature mode, 3 means HSV mode.
        let colorMode = parseInt(ssdpMessage.COLOR_MODE);

        //value from rgb
        if (colorMode == 1)
            this.updateByRGB(ssdpMessage.RGB,ssdpMessage.BRIGHT);
        //value from color temperature
        else if (colorMode == 2)
            this.updateCT(ssdpMessage.CT,ssdpMessage.BRIGHT);
        //value from HSV
        else if (colorMode == 3)
            this.updateHSV(ssdpMessage.HUE,ssdpMessage.SAT,ssdpMessage.BRIGHT);
    }

    updateByRGB(rgb,bright)
    {
        //rgb values: 0 to 16777215
        let color = Color(parseInt(rgb));
        let hsv = color.hsv();

        this.rgb.r = color.color[0];
        this.rgb.g = color.color[1];
        this.rgb.b = color.color[2];

        if (typeof bright !== 'undefined' && bright != "")
            this.bright = parseInt(bright);

        this.hsb.h = hsv.color[0];
        this.hsb.s = hsv.color[1];
        this.hsb.b = this.bright;

        //console.log("updateByRGB => new rgb: ",this.rgb);
        this.emit('stateUpdate',this);
    }

    updateCT(ct, bright)
    {
        //ct values: 1700 to 6500
        let rgb = colorTemp.temp2rgb(parseInt(ct));
        let hsv = Color.rgb(rgb).hsv();

        this.rgb.r = rgb[0];
        this.rgb.g = rgb[1];
        this.rgb.b = rgb[2];

        if (typeof bright !== 'undefined' && bright != "")
            this.bright = parseInt(bright);

        this.hsb.h = hsv.color[0];
        this.hsb.s = hsv.color[1];
        this.hsb.b = this.bright;

        //console.log("updateCT => new rgb: ",this.rgb);
        this.emit('stateUpdate',this);
    }

    updateHSV(hue,sat,val)
    {
        if (typeof val !== 'undefined' && val != "")
            this.bright = parseInt(val);

        this.hsb.h = parseInt(hue);
        this.hsb.s = parseInt(sat);
        this.hsb.b = this.bright;

        let rgb = Color.hsv([this.hsb.h,this.hsb.s,this.hsb.b]).rgb();

        this.rgb.r = rgb.color[0];
        this.rgb.g = rgb.color[1];
        this.rgb.b = rgb.color[2];

        //console.log("updateByRGB => new rgb: ",this.rgb);
        this.emit('stateUpdate',this);
    }

    updateBright(bright)
    {
        this.bright = parseInt(bright);
        this.hsb.b = this.bright;

        //console.log("updateBright => new rgb: ",this.rgb);
        this.emit('stateUpdate',this);
    }

    updatePower(power)
    {
        this.power = (power && (""+power).toLowerCase() != "off" && (""+power).toLowerCase() != "false" && power != "0");

        this.emit('stateUpdate',this);
    }

    connect()
    {
        if (this.socket)
            this.disconnect();

        this.emit('connect');

        //create socket
        this.socket = new net.Socket();

        //data response
        this.socket.on('data', this.parseResponse.bind(this));

        this.socket.on('end', (data) =>
        {
            this.parseResponse.bind(data);

            this.emit('disconnected');
            this.disconnect();
        });

        this.socket.connect(this.port, this.host, () =>
        {
            this.emit('connected');
            this.connected = true;
        });

        this.socket.on('close', (data) =>
        {
            this.emit('disconnected');
            this.disconnect();
        });

        this.socket.on('error', (err) =>
        {
            this.emit('failed',{reason: "socket error", response:err});

            //close event will be called afterwards
        });
    }

    disconnect()
    {
        if (this.socket)
        {
            //disconnect
            try {this.destroy(); } catch(e) {}
        }

        this.emit('disconnect');

        this.socket = null;
        this.connected = false;
    }

    isConnected()
    {
        return (this.socket && this.connected);
    }

    parseResponse(res)
    {
        let responses = res.toString('utf8');

        //console.log(" ==== res =====");
        //console.log(responses);

        //sometimes there are multiple messages in one message
        let splits = responses.split("\r\n");

        splits.forEach((response) =>
        {
            //skip empty
            if (!response || response == "")
                return;

            //parse json
            let json = null;
            try { json = JSON.parse(response); } catch(e)
            {
                console.error(e);
                console.log(response);
                this.emit('failed',{reason: "response is not parsable", response:response});
            }

            if (json)
            {
                let id = json.id;
                let method = json.method;
                let params = json.params;
                let result = json.result;

                // ******************** notofication message ********************
                if (method == "props")
                {
                    if ("power" in params)
                        this.updatePower(params.power);

                    if ("rgb" in params)
                        this.updateByRGB(params.rgb);

                    if ("bright" in params)
                        this.updateBright(params.bright);

                    if ("ct" in params)
                        this.updateCT(params.ct);

                    if ("hue" in params && "sat" in params)
                        this.updateHSV(params.hue,params.sat);

                    if("name" in params)
                        this.name = params.name;

                    this.emit('update',{response:json});
                }

                // ******************** get_prop result ********************
                if (result && id  && this.messages[id] && this.messages[id].method == "get_prop")
                {
                    let params = this.messages[id].params;
                    let values = result;

                    if (params.length == values.length)
                    {
                        //generate object out of params and result-values
                        let obj = {};
                        for(let i=0;i<params.length;++i)
                        {
                            let key = params[i];
                            let value = values[i];

                            obj[key] = value;
                        }

                        //detect type (if Yeelight instance was created by host and port only - without ssdp)
                        //if the result of rgb is "" --> this means that rgb value is not supported (otherweise it will be "0" -> "16777215")
                        if (obj.rgb == "")
                            this.type = "white";
                        else
                            this.type = "color";

                        if ("power" in obj)
                            this.updatePower(obj.power);

                        if ("color_mode" in obj)
                        {
                            if (obj.color_mode == 1 && "rgb" in obj)
                                this.updateByRGB(obj.rgb,obj.bright);
                            else if (obj.color_mode == 2 && "ct" in obj)
                                this.updateCT(obj.ct,obj.bright);
                            else if (obj.color_mode == 3 && "hue" in obj && "sat" in obj)
                                this.updateHSV(obj.hue,obj.sat,obj.bright);

                            this.colorMode = obj.color_mode;
                        }
                        else
                        {
                            if ("bright" in obj)
                                this.updateBright(obj.bright);
                        }
                    }
                    else
                    {
                        this.emit('failed',{reason: "error on parsing get_prop result --> params length != values length", response:response});
                        console.error("error on parsing get_prop result --> params length != values length");
                        console.log(params);
                        console.log(values);
                    }
                }

                // ******************** command response ********************
                if (id && this.messages[id])
                {
                    let msg = this.messages[id];

                    clearTimeout(msg.timeout);

                    this.emit('success',{id:msg.id,method:msg.method,params:msg.params,response:json});

                    let resolve = msg.resolve;

                    delete this.messages[id];

                    //resolve on the end
                    resolve(this);
                }
            }
        });
    }

    sendCommand(method,params)
    {
        //connect if not connected
        if (!this.isConnected())
            this.connect();

        //check message
        let supportedMethods = [];
        if (this.support)
            supportedMethods = this.support.split(" ");

        let id = this.messageId;
        ++this.messageId;

        //check if method is allowed - its also allowed if there is no support set (if light is added via hostname and port and not via ssdp)
        if ((this.support == "" || supportedMethods.indexOf(method) != -1) && params && params.length > 0)
        {
            let paramsStr = JSON.stringify(params);

            let str = '{"id":'+id+',"method":"'+method+'","params":'+paramsStr+'}'+'\r\n';

            return new Promise((resolve, reject) =>
            {
                let timeout = setTimeout(() =>
                {
                    let msg = this.messages[id];
                    this.emit('timeout',{id:msg.id,method:msg.method,params:msg.params});

                    delete this.messages[id];
                    reject("id: "+id + " timeout");

                },REQUEST_TIMEOUT);

                //append message
                this.messages[id] = {id:id,method:method,params:params,timeout:timeout,resolve:resolve,reject:reject};

                this.socket.write(str);
            });
        }
        else
            return Promise.reject("method is not supported or empty params are set");
    }

    updateState()
    {
        return this.sendCommand("get_prop",["power","color_mode","ct","rgb","hue","sat","bright"]);
    }

    setRGB(rgb,duration)
    {
        let number = Color.rgb(rgb).rgbNumber();

        //update local state
        this.updateByRGB(number);

        //"rgb_value", "effect", "duration"
        let params =
        [
            number,
            (duration) ? "smooth" : "sudden",
            (duration) ? duration : 0
        ];

        return this.sendCommand("set_rgb",params);
    }

    setBright(bright,duration)
    {
        //update local state
        this.updateBright(bright);

        //"brightness", "effect", "duration"
        let params =
        [
            bright,
            (duration) ? "smooth" : "sudden",
            (duration) ? duration : 0
        ];

        return this.sendCommand("set_bright",params);
    }

    setHSV(hsv,duration)
    {
        let color = Color.hsv(hsv);

        let hue = color.hue();
        let sat = color.saturationv();
        let bright = color.value();

        //update local state
        this.updateHSV(hue,sat,bright);

        //"hue", "sat", "effect", "duration"
        let params =
        [
            hue,
            sat,
            (duration) ? "smooth" : "sudden",
            (duration) ? duration : 0
        ];

        let proms = [];

        proms.push(this.sendCommand("set_hsv",params));

        //set bright/value
        proms.push(this.setBright(bright,duration));

        return Promise.all(proms);
    }

    //ct: 1700 ~ 6500
    setCT(ct,duration)
    {
        //update local state
        this.updateCT(ct);

        //"ct_value", "effect", "duration"
        let params =
        [
            ct,
            (duration) ? "smooth" : "sudden",
            (duration) ? duration : 0
        ];

        return this.sendCommand("set_ct_abx",params);
    }

    setPower(power,duration)
    {
        //update local state
        this.updatePower(power);

        //"power", "effect", "duration"
        let params =
        [
            this.power ? 'on' : 'off',
            (duration) ? "smooth" : "sudden",
            (duration) ? duration : 0
        ];

        return this.sendCommand("set_power",params);
    }
}

module.exports = Yeelight;