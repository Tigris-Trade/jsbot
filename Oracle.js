import { io } from "socket.io-client";
import * as dotenv from 'dotenv';

dotenv.config();

export default class Oracle {

    constructor(pairs) {
        const socket = io.connect(process.env.ORACLE_URL, { transports: ['websocket'] });

        socket.on('connect', () => {
            console.log('Connected to Tigris Oracle');
        });

        socket.on('data', (d) => {
            this.data = d;
        });

        socket.on('error', (err) => {
            console.log(err);
        });

        this.pairs = pairs;
    }

    async getPrices() {
        if(!this.data) return false;

        let adata = this.data;
        let prices = {};
        let allData = {};

        for(let i=0; i<this.pairs.length; i++) {
            let data = await adata[this.pairs[i]];

            prices[this.pairs[i]] = data?.price;

            const priceData = [
                data?.provider,
                data?.is_closed,
                data?.asset,
                data?.price,
                data?.spread,
                data?.timestamp,
                data?.signature
            ];

            allData[this.pairs[i]] = priceData;
        }

        return {
            prices: prices,
            data: allData
        };
    }
}