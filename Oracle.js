import { io } from "socket.io-client";

export default class Oracle {

    constructor(_numberOfAssets) {
        const socket = io.connect("wss://eu1.tigrisoracle.net", { transports: ['websocket'] });

        socket.on('connect', () => {
            console.log('Connected to Tigris Oracle');
        });

        socket.on('data', (d) => {
            this.data = d;
        });

        socket.on('error', (err) => {
            console.log(err);
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

            prices.push(data?.price);

            const priceData = [
                data?.provider,
                data?.is_closed,
                data?.asset,
                data?.price,
                data?.spread,
                data?.timestamp,
                data?.signature
            ];

            allData.push(priceData);
        }

        return {
            prices: prices,
            data: allData // [ [], [], [] ]
        };
    }
}