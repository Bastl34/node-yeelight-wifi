'use strict';

const Lookup = require("../index").Lookup;
const Yeelight = require("../index").Yeelight;

let look = new Lookup();

look.on("detected",(light) =>
{
    console.log("new yeelight detected: host="+light.host);
});


setTimeout(() =>
{
    let lights = look.getLights();

    if (lights.length == 0)
    {
        console.log("no yeelight found");
        return;
    }

    let light = lights[0];

    // ******************* state updates *******************
    light.on("connected",() =>
    {
        console.log("connected");
    });

    light.on("disconnected",() =>
    {
        console.log("disconnected");
    });

    light.on("stateUpdate",(light) =>
    {
        console.log(light.rgb);
    });

    light.on("failed",(error) =>
    {
        console.log(error);
    });


    // ******************* setter *******************
    light.setRGB([255,255,0]).then(() =>
    {
        console.log("setRGB promise resolved");
    }).catch((error =>
    {
        console.log("promise rejected");
        console.log(error);
    }));

    light.updateState().then(() =>
    {
        console.log("updateState promise resolved");
    }).catch((error =>
    {
        console.log("promise rejected");
        console.log(error);
    }));

    //light.setBright(10);
    //light.setHSV([298,100,100],1000);
    //light.setPower('on');
    //light.setCT(5000);



    setInterval(() =>
    {
        light.updateState().then(() =>
        {
            console.log("updateState promise resolved");
        }).catch((error =>
        {
            console.log("promise rejected");
            console.log(error);
        }));
    },10000)

},1500);