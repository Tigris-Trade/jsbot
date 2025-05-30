import * as dotenv from 'dotenv';
import ethers from 'ethers';
import { io } from "socket.io-client";
import Oracle from './Oracle.js';
import fs from "fs";
import PositionManager from "./PositionManager.js";

dotenv.config();

class App {
    positionManagers;
    constructor() {
        console.log(process.env.PRIVATE_KEY);
        this.pairs = [];
        this.signer = new ethers.Wallet(process.env.PRIVATE_KEY, new ethers.providers.StaticJsonRpcProvider(process.env.RPC_URL));
        this.signerPublic = new ethers.Wallet(process.env.PRIVATE_KEY, new ethers.providers.StaticJsonRpcProvider(process.env.PUBLIC_RPC_URL));
        this.tradingABI = JSON.parse(fs.readFileSync('./abis/TradingContractABI.json', 'utf-8'));
        let positionABI = JSON.parse(fs.readFileSync('./abis/PositionsContractABI.json', 'utf-8'));
        let libraryABI = JSON.parse(fs.readFileSync('./abis/LibraryABI.json', 'utf-8'));
        this.tradingContract = new ethers.Contract(process.env.TRADING, this.tradingABI, this.signer);
        this.tradingEvents = io.connect(process.env.EVENT_SOCKET_URL, {transports: ['websocket']});
        this.libraryContract = new ethers.Contract(process.env.LIBRARY, libraryABI, this.signerPublic);
        this.positionContract = new ethers.Contract(process.env.POSITION, positionABI, this.signer);
        this.positionManagers = {};
        this.start().then();
    }

    async start() {
        let response = await fetch("https://pairs.tigris.trade/api/trading-pairs-ui");
        let data = await response.json();
        this.pairs = Object.keys(data);
        this.oracle = new Oracle(this.pairs);
        // Get all positions and create a position manager for each one
        let openPositionsBigInt = await this.positionContract.openPositions();
        let openPositions = [];
        for (let i=0; i<openPositionsBigInt.length; i++) {
            openPositions.push(parseInt(openPositionsBigInt[i].toString()));
        }
        for (let i=0; i<this.pairs.length; i++) {
            let limitOrdersBigInt = [];
            limitOrdersBigInt = await this.positionContract.limitOrders(this.pairs[i]);
            for (let j=0; j<limitOrdersBigInt.length; j++) {
                openPositions.push(parseInt(limitOrdersBigInt[j].toString()));
            }
        }
        console.log(openPositions);
        for (let i=0; i<openPositions.length; i++) {
            this.positionManagers[openPositions[i]] = new PositionManager(openPositions[i], this.tradingContract, this.positionContract, this.libraryContract, this.oracle);
            // Prevents nonce collision if multiple orders are executable at the same time
            await this.sleep(0.2);
        }

        await this.events();
    }

    async events() {

        this.tradingEvents.on("PositionOpened", async (event) => {
            if (parseInt(event.chainId) !== parseInt(process.env.CHAIN_ID)) return;
            let type = parseInt(event.orderType.toString());
            let _id = parseInt(event.id.toString());
            if (type === 0) {
                console.log("Market order ID " + _id + " opened");
            } else if (type === 1) {
                console.log("Limit order ID " + _id + " created");
            } else if (type === 2) {
                console.log("Stop order ID " + _id + " created");
            }
            this.positionManagers[_id] = new PositionManager(_id, this.tradingContract, this.positionContract, this.libraryContract, this.oracle);
            console.log(Object.keys(this.positionManagers));
        });

        this.tradingEvents.on("PositionClosed", async (event) => {
            if (parseInt(event.chainId) !== parseInt(process.env.CHAIN_ID)) return;
            let _id = parseInt(event.id.toString());
            let _percent = parseInt(event.percent.toString());
            if (_percent === 10000000000) {
                console.log("Position ID " + _id + " closed");
                try {
                    this.positionManagers[_id].clearLoop().then(() => {
                        delete this.positionManagers[_id];
                        console.log(Object.keys(this.positionManagers));
                    });
                } catch {delete this.positionManagers[_id];}
            } else {
                console.log("Position ID " + _id + " partially closed");
                try {
                    await this.positionManagers[_id].getPositionData();
                } catch(e) {
                    console.log("Failed to update position data");
                    console.log(e);
                }
                console.log(Object.keys(this.positionManagers));
            }
        });

        this.tradingEvents.on("PositionLiquidated", async (event) => {
            if (parseInt(event.chainId) !== parseInt(process.env.CHAIN_ID)) return;
            let _id = parseInt(event.id.toString());
            console.log("Position ID " + _id + " liquidated");
            try {
                this.positionManagers[_id].clearLoop().then(() => {
                    delete this.positionManagers[_id];
                    console.log(Object.keys(this.positionManagers));
                });
            } catch {delete this.positionManagers[_id];}
        });

        this.tradingEvents.on("LimitCancelled", async (event) => {
            if (parseInt(event.chainId) !== parseInt(process.env.CHAIN_ID)) return;
            let _id = parseInt(event.id.toString());
            console.log("Order ID " + _id + " cancelled");
            try {
                this.positionManagers[_id].clearLoop().then(() => {
                    delete this.positionManagers[_id];
                    console.log(Object.keys(this.positionManagers));
                });
            } catch {delete this.positionManagers[_id];}
        });

        this.tradingEvents.on("LimitOrderExecuted", async (event) => {
            if (parseInt(event.chainId) !== parseInt(process.env.CHAIN_ID)) return;
            let _id = parseInt(event.id.toString());
            console.log("Limit order ID " + _id + " executed");
            try {
                await this.positionManagers[_id].getPositionData();
            } catch(e) {
                console.log("Failed to update position data");
                console.log(e);
            }
            console.log(Object.keys(this.positionManagers));
        });

        this.tradingEvents.on("AddToPosition", async (event) => {
            if (parseInt(event.chainId) !== parseInt(process.env.CHAIN_ID)) return;
            let _id = parseInt(event.id.toString());
            console.log("Cross margin on position ID " + _id);
            try {
                await this.positionManagers[_id].getPositionData();
            } catch(e) {
                console.log("Failed to update position data");
                console.log(e);
            }
            console.log(Object.keys(this.positionManagers));
        });

        this.tradingEvents.on("MarginModified", async (event) => {
            if (parseInt(event.chainId) !== parseInt(process.env.CHAIN_ID)) return;
            let _id = parseInt(event.id.toString());
            console.log("Position ID " + _id + " margin modified");
            try {
                await this.positionManagers[_id].getPositionData();
            } catch(e) {
                console.log("Failed to update position data");
                console.log(e);
            }
            console.log(Object.keys(this.positionManagers));
        });

        this.tradingEvents.on("UpdateTPSL", async (event) => {
            if (parseInt(event.chainId) !== parseInt(process.env.CHAIN_ID)) return;
            let _id = parseInt(event.id.toString());
            console.log("Position " + _id + " TP/SL modified");
            try {
                await this.positionManagers[_id].getPositionData();
            } catch(e) {
                console.log("Failed to update position data");
                console.log(e);
            }
            console.log(Object.keys(this.positionManagers));
        });

        this.tradingEvents.on("error", async () => {
           console.log("EVENT ERROR");
        });
    }

    async sleep(seconds) {
        let e = new Date().getTime() + (seconds * 1000);
        while (new Date().getTime() <= e) {}
    }
}

async function main() {
    new App();
}

main().catch((error) => {
    console.error(error);
});