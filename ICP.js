import pkgAgent from "@dfinity/agent";
import fetch from "node-fetch";

const { HttpAgent, Actor } = pkgAgent;

export default class ICP {

    numberOfAssets;
    actor;
    assetPrices;
    assetData;
    interval;

    constructor(_numberOfAssets, canisterId) {
        this.numberOfAssets = _numberOfAssets;
        const host = "https://ic0.app";
        const agent = new HttpAgent({ fetch, host });
        this.idlFactory = ({ IDL }) => {
            const PriceData = IDL.Record({
                signature: IDL.Text,
                provider: IDL.Text,
                asset: IDL.Nat32,
                timestamp: IDL.Text,
                is_closed: IDL.Bool,
                price: IDL.Text,
            });
            return IDL.Service({
                get_data: IDL.Func([IDL.Nat32], [IDL.Vec(PriceData)], ["query"]),
            });
        };
        this.actor = Actor.createActor(this.idlFactory, {
            agent,
            canisterId,
        });
        this.assetPrices = new Array(_numberOfAssets);
        this.assetData = new Array(_numberOfAssets);
        this.createInterval();
    }

    async createInterval() {
        await this.getPrices();
        this.interval = setInterval(() => {
                this.getPrices();
                },8000);
    }

    async getPrices() {
        let icData;
        try {
            icData = await this.getICPPrices();
        } catch(err) {
            console.log(err);
            return;
        }

        for(let i=0; i<this.numberOfAssets; i++) {
            let oraclePrices = [];
            let data = await icData[i];
            for(let j=0; j<data.length; j++) {
                oraclePrices.push(data[j].price);
            }
            this.assetPrices[i] = await this.median(oraclePrices);
            this.assetData[i] = data;
        }
    }

     async getICPPrices() {
         let data = [];

         for(let i=0; i<this.numberOfAssets; i++) {
             data.push(this.actor.get_data(i));
         }

         await Promise.all(data).catch(() =>
             console.log("Failed to get ICP data")
         );
         return data;
    }

    async getPairPrice(pair) {
        return this.assetPrices[pair];
    }

    async getPairPriceData(pair) {
        return this.assetData[pair];
    }

    async median(values){
        if(values.length ===0) throw new Error("No inputs");

        values.sort(function(a,b){
            return a-b;
        });

        let half = Math.floor(values.length / 2);

        if (values.length % 2)
            return values[half];

        return (values[half - 1] + values[half]) / 2.0;
    }
}