import {parse} from "dotenv";

export default class PositionManager {
    position;
    interval;
    liqInterval;
    liqPrice = 0;
    constructor(_id, _tradingContract, _positionContract, _libraryContract, _oracle) {
        this.id = _id;
        this.tradingContract = _tradingContract;
        this.positionContract = _positionContract;
        this.libraryContract = _libraryContract;
        this.oracle = _oracle;
        this.failCounter = 0;
        this.getPositionData().then(() => {
            this.check();
        });
    }

    async getPositionData() {
        setTimeout(() => {
            this.positionContract.trades(this.id).then((trade) => {
                this.position = trade;
            })
                .catch(() => {
                        // Second attempt
                        this.positionContract.trades(this.id).then((trade) => {
                            this.position = trade;
                        })
                            // Print fail, should restart the bot manually?
                            .catch((err) => {
                                console.log("FAILED TO GET POSITION ID " + (this.id).toString(), err);
                            });
                });
        }, 10000);
    }

    async clearLoop() {
        clearInterval(this.interval);
        clearInterval(this.liqInterval);
    }

    check() {
        this.interval = setInterval(async () => {
            if (!this.position) return;
            let cPrice;
            try {
                cPrice = parseInt((await this.oracle.getPrices()).prices[parseInt(this.position.asset.toString())]);
            } catch(err) {
                console.log(err);
                return;
            }
            let allData = await this.processData(parseInt(this.position.asset.toString()));
            if (allData.priceData[1]) return; // If market is closed, return
            if (parseInt(this.position.orderType) === 0) {
                let liqPrice = this.liqPrice;
                if (this.position.direction) {
                    if (cPrice <= parseInt(this.position.slPrice) && parseInt(this.position.slPrice) !== 0) {
                        try {
                            console.log("ATTEMPT to execute long SL");
                            const gasPrice = Math.round((await this.tradingContract.provider.getGasPrice()).toNumber() * 2);
                            await this.tradingContract.limitClose(this.id, false, allData.priceData, allData.sig, {gasPrice: gasPrice});
                            console.log("Successfully executed long SL");
                        } catch(err) {
                            console.log(err.reason);
                            console.log("Failed to execute long SL ID " + this.id);
                        }
                    }
                    if (cPrice <= liqPrice && liqPrice !== 0) {
                        try {
                            console.log("ATTEMPT to liquidate long");
                            const gasPrice = Math.round((await this.tradingContract.provider.getGasPrice()).toNumber() * 2);
                            await this.tradingContract.liquidatePosition(this.id, allData.priceData, allData.sig, {gasPrice: gasPrice});
                            console.log("Successfully liquidated long");
                        } catch(err) {
                            console.log(err.reason);
                            console.log("Failed to liquidate long ID " + this.id);
                        }
                    }
                    if (cPrice >= parseInt(this.position.tpPrice) && parseInt(this.position.tpPrice) !== 0) {
                        try {
                            console.log("ATTEMPT to execute long TP");
                            const gasPrice = Math.round((await this.tradingContract.provider.getGasPrice()).toNumber() * 2);
                            await this.tradingContract.limitClose(this.id, true, allData.priceData, allData.sig, {gasPrice: gasPrice});
                            console.log("Successfully executed long TP");
                        } catch(err) {
                            console.log(err.reason);
                            console.log("Failed to execute long TP ID " + this.id);
                        }
                    }
                } else {
                    if (cPrice >= parseInt(this.position.slPrice) && parseInt(this.position.slPrice) !== 0) {
                        try {
                            console.log("ATTEMPT to execute short SL");
                            const gasPrice = Math.round((await this.tradingContract.provider.getGasPrice()).toNumber() * 2);
                            await this.tradingContract.limitClose(this.id, false, allData.priceData, allData.sig, {gasPrice: gasPrice});
                            console.log("Successfully executed short SL");
                        } catch(err) {
                            console.log(err.reason);
                            console.log("Failed to execute short SL ID " + this.id);
                        }
                    }
                    if (cPrice >= liqPrice && liqPrice !== 0) {
                        try {
                            console.log("ATTEMPT to liquidate short");
                            const gasPrice = Math.round((await this.tradingContract.provider.getGasPrice()).toNumber() * 2);
                            await this.tradingContract.liquidatePosition(this.id, allData.priceData, allData.sig, {gasPrice: gasPrice});
                            console.log("Successfully liquidated short");
                        } catch(err) {
                            console.log(err.reason);
                            console.log("Failed to liquidate short ID " + this.id);
                        }
                    }
                    if (cPrice <= parseInt(this.position.tpPrice) && parseInt(this.position.tpPrice) !== 0) {
                        try {
                            console.log("ATTEMPT to execute short TP");
                            const gasPrice = Math.round((await this.tradingContract.provider.getGasPrice()).toNumber() * 2);
                            await this.tradingContract.limitClose(this.id, true, allData.priceData, allData.sig, {gasPrice: gasPrice});
                            console.log("Successfully executed short TP");
                        } catch(err) {
                            console.log(err.reason);
                            console.log("Failed to execute short TP ID " + this.id);
                        }
                    }
                }
            } else if (parseInt(this.position.orderType) === 1) {
                const spread = parseFloat(allData[4]);
                if (this.position.direction) {
                    if (cPrice + cPrice * spread / 1e10 <= parseInt(this.position.price)) {
                        console.log(cPrice);
                        console.log(parseInt(this.position.price));
                        try {
                            console.log("ATTEMPT to execute long limit order");
                            const gasPrice = Math.round((await this.tradingContract.provider.getGasPrice()).toNumber() * 2);
                            await this.tradingContract.executeLimitOrder(this.id, allData.priceData, allData.sig, {gasPrice: gasPrice});
                            console.log("Successfully executed long limit order");
                        } catch(err) {
                            console.log(err.reason);
                            console.log("Failed to execute long limit order ID " + this.id);
                        }
                    }
                } else {
                    if (cPrice - cPrice * spread / 1e10 >= parseInt(this.position.price)) {
                        try {
                            console.log("ATTEMPT to execute short limit order");
                            const gasPrice = Math.round((await this.tradingContract.provider.getGasPrice()).toNumber() * 2);
                            await this.tradingContract.executeLimitOrder(this.id, allData.priceData, allData.sig, {gasPrice: gasPrice});
                            console.log("Successfully executed short limit order");
                        } catch(err) {
                            // console.log(err.reason);
                            console.log("Failed to execute short limit order ID " + this.id);
                        }
                    }
                }
            } else if (parseInt(this.position.orderType) === 2) {
                const spread = parseFloat(allData.priceData[4]);
                if (this.position.direction) {
                    if (cPrice + cPrice * spread / 1e10 >= parseInt(this.position.price)) {
                        try {
                            console.log("ATTEMPT to execute long stop order");
                            const gasPrice = Math.round((await this.tradingContract.provider.getGasPrice()).toNumber() * 2);
                            await this.tradingContract.executeLimitOrder(this.id, allData.priceData, allData.sig, {gasPrice: gasPrice});
                            console.log("Successfully executed long stop order");
                        } catch(err) {
                            console.log(err.reason);
                            console.log("Failed to execute long stop order ID " + this.id);
                        }
                    }
                } else {
                    if ((cPrice - cPrice * spread / 1e10 <= parseInt(this.position.price))) {
                        try {
                            console.log("ATTEMPT to execute short stop order");
                            const gasPrice = Math.round((await this.tradingContract.provider.getGasPrice()).toNumber() * 2);
                            await this.tradingContract.executeLimitOrder(this.id, allData.priceData, allData.sig, {gasPrice: gasPrice});
                            console.log("Successfully executed short stop order");
                        } catch(err) {
                            console.log(err.reason);
                            console.log("Failed to execute short stop order ID " + this.id);
                        }
                    }
                }
            }
        }, 2000);
        this.liqInterval = setInterval(async () => {
                this.libraryContract.getLiqPrice(this.positionContract.address, this.id, 9e9).then((l) => {
                    this.liqPrice = parseInt(l);
                    this.failCounter = 0;
                }).catch(() => {
                    console.log("Failed to get LIQ price ID " + this.id);
                    this.liqPrice = 0;
                    this.failCounter += 1;
                    if (this.failCounter > 3) {
                        console.log("Determined position ID " + this.id + " is closed");
                        this.clearLoop();
                    }
                });
        }, 20000);
    }

    async processData(_asset) {
        try {
            let data = (await this.oracle.getPrices()).data[_asset];
            if (data === undefined) {
                return {
                    priceData: [0, 0, 0, 0, true]
                };
            }
            return {
                priceData: data.price,
                sig: data.sig
            };
        } catch {
            return {
                priceData: [0, 0, 0, 0, true]
            };
        }
    }
}