'use strict';

const ssdp = require("node-ssdp");
const EventEmitter = require("events");
const portscanner = require("portscanner");
const os = require('os');
const arp = require('node-arp');

const Yeelight = require("./yeelight")

const SEARCH_INTERVAL = 2000;
const LOOKUP_INTERVAL = 60*1000;
const PORT_SCAN_TIMEOUT = 10000;

const YEELIGHT_SSDP_PORT = 1982;
const YEELIGHT_PORT = 55443;

//specs: http://www.yeelight.com/download/Yeelight_Inter-Operation_Spec.pdf

class Lookup extends EventEmitter
{
    constructor()
    {
        super();

        this.lights = [];
        this.ssdp = null;
        this.interval = null;

        this.init();
    }

    init()
    {
        //start lookup
        this.lookup();

        //start lookup interval
        this.interval = setInterval(() =>
        {
            this.lookup();
        },LOOKUP_INTERVAL)
    }

    lookup()
    {
        if (this.ssdp)
            this.ssdp.stop();

        this.ssdp = new ssdp.Client({ ssdpPort: YEELIGHT_SSDP_PORT });

        this.ssdp.on('response', (data) =>
        {
            let light = this.lights.find(light => light.id === data.ID);

            if (!light)
            {
                light = new Yeelight(data);
                this.lights.push(light);

                //get mac (but it could be that there is no mac because of different (routed) net)
                arp.getMAC(light.host, (err, mac) =>
                {
                    light.mac = (!err) ? mac : "";
                    this.emit('detected', light);
                });
            }
            else
                light.updateBySSDPMessage(data);
        });

        this.ssdp.search('wifi_bulb');
    }

    /*
    searchSSDP(maxRetries)
    {
        let amount = 0;
        let interval = null;

        let lightsAtStartup = this.lights.length;

        interval = setInterval(() =>
        {
            if (amount > maxRetries || (lightsAtStartup != this.lights.length && this.lights.length > 0))
            {
                interval = clearInterval(interval);
                return;
            }

            this.lookup();
            //console.log("searching ("+amount+")...");

            ++amount;
        },SEARCH_INTERVAL);
    }
    */

    findByPortscanning()
    {
        let interfaces = os.networkInterfaces();

        //first: get all ip'S of all network interfaces
        let ipAddresses = [];

        for (let devName in interfaces)
        {
            let iface = interfaces[devName];
            iface.forEach((alias) =>
            {
                if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal)
                    ipAddresses.push(alias.address);
            });
        }

        //remove the last number
        for (let i in ipAddresses)
        {
            let ip = ipAddresses[i];
            ip = ip.substr(0,ip.lastIndexOf(".")+1);

            ipAddresses[i] = ip;
        }

        //filter doubles
        ipAddresses = ipAddresses.filter((item, i, self) =>
        {
                return self.lastIndexOf(item) == i;
        });

        //loop over all Ip'S and check for opend ports (tinkerforge ports)
        let checkAmount = ipAddresses.length * 254;
        let checks = 0;

        return new Promise((resolve,reject) =>
        {
            for(let i in ipAddresses)
            {
                for(let t=1;t<255;++t)
                {
                    let ip = ipAddresses[i] + t;
                    portscanner.checkPortStatus(YEELIGHT_PORT, {host :ip, timeout: PORT_SCAN_TIMEOUT}, (error, status) =>
                    {
                        ++checks;

                        if (status == "open")
                        {
                            //get mac (but it could be that there is no mac because of different (routed) net)
                            arp.getMAC(ip, (err, mac) =>
                            {
                                //check if already added
                                let light = null;
                                if (!err)
                                    light = this.lights.find(light => light.mac === mac);
                                else
                                    light = this.lights.find(light => light.host === ip);

                                if (!light)
                                {
                                    light = new Yeelight();
                                    light.init(ip,YEELIGHT_PORT,(!err) ? mac : "");
                                    this.lights.push(light);
                                    this.emit('detected', light);
                                }
                            });
                        }

                        //on done -> end
                        if (checks == checkAmount)
                            resolve();
                    });
                }
            }
        });
    }

    getLights()
    {
        return this.lights;
    }
}

module.exports = Lookup;
