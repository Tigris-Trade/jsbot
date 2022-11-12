import * as dotenv from 'dotenv';
import ethers from 'ethers';
import ICP from './ICP.js';
import fs from "fs";
import PositionManager from "./PositionManager.js";

dotenv.config();

class App {
    positionManagers;
    constructor() {
        this.numberOfAssets = process.env.PAIRS;
        this.icp = new ICP(this.numberOfAssets, process.env.CANISTER); // For IC
        this.signer = new ethers.Wallet(process.env.PRIVATE_KEY, new ethers.providers.JsonRpcProvider(process.env.RPC_URL));
        this.signerPublic = new ethers.Wallet(process.env.PRIVATE_KEY, new ethers.providers.JsonRpcProvider(process.env.PUBLIC_RPC_URL));
        let tradingABI = JSON.parse(fs.readFileSync('./abis/TradingContractABI.json', 'utf-8'));
        let positionABI = JSON.parse(fs.readFileSync('./abis/PositionsContractABI.json', 'utf-8'));
        let libraryABI = JSON.parse(fs.readFileSync('./abis/LibraryABI.json', 'utf-8'));
        let wss = new ethers.providers.WebSocketProvider(process.env.WSS);
        this.tradingContract = new ethers.Contract(process.env.TRADING, tradingABI, this.signer);
        this.tradingEvents = new ethers.Contract(process.env.TRADING, tradingABI, wss);
        this.libraryContract = new ethers.Contract(process.env.LIBRARY, libraryABI, this.signerPublic);
        this.positionContract = new ethers.Contract(process.env.POSITION, positionABI, this.signer);
        this.positionManagers = {};
        this.start().then();
    }

    async start() {
        // Get all positions and create a position manager for each one
        let openPositionsBigInt = await this.positionContract.openPositions();
        let openPositions = [];
        for (let i=0; i<openPositionsBigInt.length; i++) {
            openPositions.push(parseInt(openPositionsBigInt[i].toString()));
        }
        for (let i=0; i<this.numberOfAssets; i++) {
            let limitOrdersBigInt = [];
            limitOrdersBigInt = await this.positionContract.limitOrders(i);
            for (let j=0; j<limitOrdersBigInt.length; j++) {
                openPositions.push(parseInt(limitOrdersBigInt[j].toString()));
            }
        }
        console.log(openPositions);
        for (let i=0; i<openPositions.length; i++) {
            this.positionManagers[openPositions[i]] = new PositionManager(openPositions[i], this.tradingContract, this.positionContract, this.libraryContract, this.icp);
        }

        await this.events();
    }

    async events() {

        this.tradingEvents.on("PositionOpened", async (tuple, orderType, price, id) => {
            let type = parseInt(orderType.toString());
            let _id = parseInt(id.toString());
            if (type === 0) {
                console.log("Market order ID " + _id + " opened");
            } else if (type === 1) {
                console.log("Limit order ID " + _id + " created");
            } else if (type === 2) {
                console.log("Stop order ID " + _id + " created");
            }
            this.positionManagers[_id] = new PositionManager(_id, this.tradingContract, this.positionContract, this.libraryContract, this.icp);
            console.log(Object.keys(this.positionManagers));
        });

        this.tradingEvents.on("PositionClosed", async (id, price, percent) => {
            let _id = parseInt(id.toString());
            let _percent = parseInt(percent.toString());
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
                } catch {
                    console.log("Failed to update position data");
                }
                console.log(Object.keys(this.positionManagers));
            }
        });

        this.tradingEvents.on("PositionLiquidated", async (id) => {
            let _id = parseInt(id.toString());
            console.log("Position ID " + _id + " liquidated");
            try {
                this.positionManagers[_id].clearLoop().then(() => {
                    delete this.positionManagers[_id];
                    console.log(Object.keys(this.positionManagers));
                });
            } catch {delete this.positionManagers[_id];}
        });

        this.tradingEvents.on("LimitCancelled", async (id) => {
            let _id = parseInt(id.toString());
            console.log("Order ID " + _id + " cancelled");
            try {
                this.positionManagers[_id].clearLoop().then(() => {
                    delete this.positionManagers[_id];
                    console.log(Object.keys(this.positionManagers));
                });
            } catch {delete this.positionManagers[_id];}
        });

        this.tradingEvents.on("LimitOrderExecuted", async (asset, dir, oPrice, lev, margin, id) => {
            let _id = parseInt(id.toString());
            console.log("Limit order ID " + _id + " executed");
            try {
                await this.positionManagers[_id].getPositionData();
            } catch {
                console.log("Failed to update position data");
            }
            console.log(Object.keys(this.positionManagers));
        });

        this.tradingEvents.on("AddToPosition", async (id) => {
            let _id = parseInt(id.toString());
            console.log("Cross margin on position ID " + _id);
            try {
                await this.positionManagers[_id].getPositionData();
            } catch {
                console.log("Failed to update position data");
            }
            console.log(Object.keys(this.positionManagers));
        });

        this.tradingEvents.on("MarginModified", async (id) => {
            let _id = parseInt(id.toString());
            console.log("Position ID " + _id + " margin modified");
            try {
                await this.positionManagers[_id].getPositionData();
            } catch {
                console.log("Failed to update position data");
            }
            console.log(Object.keys(this.positionManagers));
        });

        this.tradingEvents.on("UpdateTPSL", async (id) => {
            let _id = parseInt(id.toString());
            console.log("Position " + _id + " TP/SL modified");
            try {
                await this.positionManagers[_id].getPositionData();
            } catch {
                console.log("Failed to update position data");
            }
            console.log(Object.keys(this.positionManagers));
        });

        this.tradingEvents.on("error", async () => {
           console.log("EVENT ERROR");
        });
    }
}

async function main() {
    new App();
}

main().catch((error) => {
    console.error(error);
});