// const io = require("socket.io")(3000);
const { Server } = require("socket.io")
const { createServer } = require("http")
const { default: axios } = require("axios")
const { createClient } = require("redis")
const redis = createClient({ db: 3 })

redis.on("error", (err) => console.error("Redis Client Error", err))
;(async () => {
    await redis.connect()
})()

const httpServer = createServer((req, res) => {
    // console.log("req", req, res)
    res.end("hello")
})
const io = new Server(httpServer, {
    /* options */
})

io.on("connection", (socket) => {
    console.log("on connection")

    socket.on("init", async (data, callback) => {
        console.log("on init", data)
        let gasprice = JSON.parse(await redis.get("gasprice"))
        let coinprice = JSON.parse(await redis.get("coinprice"))
        console.log(coinprice)
        callback({
            gasprice: gasprice,
            coinprice: coinprice,
        })
    })
})

let fetchGasData = () => {
    axios
        .get("https://api.blocknative.com/gasprices/blockprices")
        .then(async (res) => {
            let data = {}
            console.log(res.data)
            let price = res.data["blockPrices"][0]
            let baseFee = price.baseFeePerGas
            data.safe = baseFee.toFixed(1)
            data.low = (baseFee + price.estimatedPrices[0].maxPriorityFeePerGas).toFixed(1)
            data.suggest = price.estimatedPrices[0].maxFeePerGas.toFixed(1)

            await redis.set("gasprice", JSON.stringify(data))
            io.emit("gasprice", data)
            console.log("fetchGasData", data)
        })
        .catch((error) => {
            console.error(error)
        })
}

let fetchCoinPrice = () => {
    axios
        .get("https://api.coingecko.com/api/v3/coins/markets", {
            params: {
                vs_currency: "usd",
                order: "market_cap_desc",
                per_page: 100,
                page: 1,
                sparkline: false,
            },
        })
        .then(async (res) => {
            let data = {}
            for (let item of res.data) {
                data[item["id"]] = item
            }
            await redis.set("coinprice", JSON.stringify(data))
            io.emit("coinprice", data)
            console.log("fetchCoinPrice")
        })
        .catch((error) => {
            console.error(error)
        })
}
setInterval(fetchGasData, 5000)
setInterval(fetchCoinPrice, 60000)
fetchCoinPrice()

console.log("end")

httpServer.listen(3000)
