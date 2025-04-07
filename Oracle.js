import {io} from "socket.io-client";
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

        let prices = {};
        let allData = {};

        for(let i=0; i<this.pairs.length; i++) {
            let pairData = this.data[this.pairs[i]];

            prices[this.pairs[i]] = pairData?.price;

            allData[this.pairs[i]] = [
                pairData?.provider,
                pairData?.is_closed,
                pairData?.asset,
                pairData?.price,
                pairData?.spread,
                pairData?.timestamp,
                pairData?.signature
            ];
        }

        return {
            prices: prices,
            data: allData
        };
    }
}