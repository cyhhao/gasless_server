const io = require("socket.io")(3000);
const { default: axios } = require('axios')
const { createClient } = require('redis');
const redis = createClient({ db: 3 });

redis.on('error', (err) => console.error('Redis Client Error', err));

(async () => {
    await redis.connect();
})()

io.on("connection", socket => {
    console.log("on connection")

    socket.on("init", async (data, callback) => {
        console.log("on init", data);
        let gasprice = JSON.parse(await redis.get('gasprice'));
        let coinprice = JSON.parse(await redis.get('coinprice'));
        callback({
            "gasprice": gasprice,
            "coinprice": coinprice
        })
    });


    // handle the event sent with socket.emit()
    // socket.on("salutations", (elem1, elem2, elem3) => {
    //     console.log(elem1, elem2, elem3);
    // });
});


let fetchGasData = () => {
    axios.get("https://blocknative-api.herokuapp.com/data")
        .then(async (res) => {
            let data = {}
            data.suggest = res.data.estimatedPrices[0].price
            data.low = res.data.estimatedPrices[4].price
            data.safe = res.data.baseFeePerGas.toFixed(1)
            // console.log(JSON.stringify(data))
            await redis.set('gasprice', JSON.stringify(data));
            io.emit("gasprice", data)
        }).catch((error) => {
            console.error(error);
        });
}

let fetchCoinPrice = () => {
    axios.get("https://api.coingecko.com/api/v3/coins/markets", {
        params: {
            vs_currency: "usd",
            order: "market_cap_desc",
            per_page: 100,
            page: 1,
            sparkline: false
        }
    }).then(async (res) => {
        let data = {}
        for (let item of res.data) {
            data[item["id"]] = item
        }
        // console.log("fetchCoinPrice", JSON.stringify(data))
        await redis.set('coinprice', JSON.stringify(data));
        io.emit("coinprice", data)
    }).catch((error) => {
        console.error(error);
    });
}
setInterval(fetchGasData, 5000)
setInterval(fetchCoinPrice, 60000)
fetchCoinPrice()

console.log("end")