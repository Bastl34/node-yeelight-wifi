'use strict';

const Lookup = require("../index").Lookup;
const Yeelight = require("../index").Yeelight;

let look = new Lookup();
look.findByPortscanning();

look.on("detected",(light) =>
{
    console.log("new yeelight detected: host="+light.host);

    light.on("stateUpdate",(light) =>
    {
        console.log(light.getState());
    });

    light.setPower('off');
});

setInterval(() =>
{

},1000);