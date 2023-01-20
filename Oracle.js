import { io } from "socket.io-client";

export default class Oracle {

    constructor(_numberOfAssets) {
        const socket = io.connect("wss://spread-oracle-ymtyv.ondigitalocean.app", { transports: ['websocket'] });

        socket.on('connect', () => {
            console.log('Connected to Tigris Trade Oracle');
        });

        socket.on('data', (d) => {
            this.data = d;
        });

        this.numberOfAssets = _numberOfAssets;
    }

    async getPrices() {
        if(!this.data) return false;

        let adata = this.data;
        let prices = [];
        let allData = [];

        for(let i=0; i<this.numberOfAssets; i++) {
            let data = await adata[i];

            if(i == 9 || !data) {
                prices.push(0);
                allData.push({"price": 0, "sig": ""});
                continue;
            }

            prices.push(data.price);

            let priceData = [
                data.provider,
                data.asset,
                data.price,
                data.spread,
                data.timestamp,
                data.is_closed
            ];

            allData.push({price: priceData, sig: data.signature});
        }

        return {
            prices: prices,
            data: allData // [{price: [], sig: "0xsig"}, {price: [], sig: "0xsig"}, {price: [], sig: "0xsig"}]
        };
    }
}