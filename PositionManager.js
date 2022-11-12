export default class PositionManager {
    position;
    interval;
    liqInterval;
    liqPrice = 0;
    constructor(_id, _tradingContract, _positionContract, _libraryContract, _icp) {
        this.id = _id;
        this.tradingContract = _tradingContract;
        this.positionContract = _positionContract;
        this.libraryContract = _libraryContract;
        this.icp = _icp;
        this.failCounter = 0;
        this.getPositionData();
        this.check();
    }

    async getPositionData() {
        this.positionContract.trades(this.id).then((trade) => {
            this.position = trade;
        })
            .catch(() => {
                    // Second attempt
                    this.positionContract.trades(this.id).then((trade) => {
                        this.position = trade;
                    })
                        // Print fail, should restart the bot manually?
                        .catch(() => {
                            console.log("FAILED TO GET POSITION ID " + (this.id).toString());
                        });
            });
    }

    async clearLoop() {
        clearInterval(this.interval);
        clearInterval(this.liqInterval);
    }

    async check() {
        this.interval = setInterval(async () => {
            let cPrice;
            try {
                cPrice = parseInt(await this.icp.getPairPrice(parseInt(this.position.asset.toString())));
            } catch {
                return;
            }
            let allData = await this.processData();
            if (allData.priceData[0][4]) return; // If market is closed, return
            if (parseInt(this.position.orderType) === 0) {
                let liqPrice = this.liqPrice;
                if (this.position.direction) {
                    if (cPrice <= parseInt(this.position.slPrice) && parseInt(this.position.slPrice) !== 0) {
                        try {
                            console.log("ATTEMPT to execute long SL");
                            await this.tradingContract.limitClose(this.id, false, allData.priceData, allData.sigs, {gasPrice: allData.gasPrice});
                            console.log("Successfully executed long SL");
                        } catch(err) {
                            //console.log(err);
                            console.log("Failed to execute long SL ID " + this.id);
                        }
                    }
                    if (cPrice <= liqPrice && liqPrice !== 0) {
                        try {
                            console.log("ATTEMPT to liquidate long");
                            await this.tradingContract.liquidatePosition(this.id, allData.priceData, allData.sigs, {gasPrice: allData.gasPrice});
                            console.log("Successfully liquidated long");
                        } catch(err) {
                            //console.log(err);
                            console.log("Failed to liquidate long ID " + this.id);
                        }
                    }
                    if (cPrice >= parseInt(this.position.tpPrice) && parseInt(this.position.tpPrice) !== 0) {
                        try {
                            console.log("ATTEMPT to execute long TP");
                            await this.tradingContract.limitClose(this.id, true, allData.priceData, allData.sigs, {gasPrice: allData.gasPrice});
                            console.log("Successfully executed long TP");
                        } catch(err) {
                            //console.log(err);
                            console.log("Failed to execute long TP ID " + this.id);
                        }
                    }
                } else {
                    if (cPrice >= parseInt(this.position.slPrice) && parseInt(this.position.slPrice) !== 0) {
                        try {
                            console.log("ATTEMPT to execute short SL");
                            await this.tradingContract.limitClose(this.id, false, allData.priceData, allData.sigs, {gasPrice: allData.gasPrice});
                            console.log("Successfully executed short SL");
                        } catch(err) {
                            //console.log(err);
                            console.log("Failed to execute short SL ID " + this.id);
                        }
                    }
                    if (cPrice >= liqPrice && liqPrice !== 0) {
                        try {
                            console.log("ATTEMPT to liquidate short");
                            await this.tradingContract.liquidatePosition(this.id, allData.priceData, allData.sigs, {gasPrice: allData.gasPrice});
                            console.log("Successfully liquidated short");
                        } catch(err) {
                            //console.log(err);
                            console.log("Failed to liquidate short ID " + this.id);
                        }
                    }
                    if (cPrice <= parseInt(this.position.tpPrice) && parseInt(this.position.tpPrice) !== 0) {
                        try {
                            console.log("ATTEMPT to execute short TP");
                            await this.tradingContract.limitClose(this.id, true, allData.priceData, allData.sigs, {gasPrice: allData.gasPrice});
                            console.log("Successfully executed short TP");
                        } catch(err) {
                            //console.log(err);
                            console.log("Failed to execute short TP ID " + this.id);
                        }
                    }
                }
            } else if (parseInt(this.position.orderType) === 1) {
                if (this.position.direction) {
                    if (cPrice <= parseInt(this.position.price)) {
                        let allData = await this.processData();
                        try {
                            console.log("ATTEMPT to execute long limit order");
                            await this.tradingContract.executeLimitOrder(this.id, allData.priceData, allData.sigs, {gasPrice: allData.gasPrice});
                            console.log("Successfully executed long limit order");
                        } catch(err) {
                            //console.log(err);
                            console.log("Failed to execute long limit order ID " + this.id);
                        }
                    }
                } else {
                    if ((cPrice >= parseInt(this.position.price))) {
                        try {
                            console.log("ATTEMPT to execute short limit order");
                            await this.tradingContract.executeLimitOrder(this.id, allData.priceData, allData.sigs, {gasPrice: allData.gasPrice});
                            console.log("Successfully executed short limit order");
                        } catch(err) {
                            //console.log(err);
                            console.log("Failed to execute short limit order ID " + this.id);
                        }
                    }
                }
            } else if (parseInt(this.position.orderType) === 2) {
                if (this.position.direction) {
                    if (cPrice >= parseInt(this.position.price)) {
                        try {
                            console.log("ATTEMPT to execute long stop order");
                            await this.tradingContract.executeLimitOrder(this.id, allData.priceData, allData.sigs, {gasPrice: allData.gasPrice});
                            console.log("Successfully executed long stop order");
                        } catch(err) {
                            //console.log(err);
                            console.log("Failed to execute long stop order ID " + this.id);
                        }
                    }
                } else {
                    if ((cPrice <= parseInt(this.position.price))) {
                        try {
                            console.log("ATTEMPT to execute short stop order");
                            await this.tradingContract.executeLimitOrder(this.id, allData.priceData, allData.sigs, {gasPrice: allData.gasPrice});
                            console.log("Successfully executed short stop order");
                        } catch(err) {
                            //console.log(err);
                            console.log("Failed to execute short stop order ID " + this.id);
                        }
                    }
                }
            }
        }, 5000);
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

    async processData() {
        let data = await this.icp.getPairPriceData(parseInt(this.position.asset));
        let priceData = [];
        let sigs = [];
        if (data === undefined) {
            return {
                priceData: [[0, 0, 0, 0, true]]
            };
        }
        for (let i=0; i<data.length; i++) {
            priceData.push(
                [
                    data[i].provider,
                    data[i].asset,
                    data[i].price,
                    parseInt(data[i].timestamp),
                    data[i].is_closed
                ]
            );
            sigs.push(data[i].signature);
        }
        let gasPrice = Math.round((await this.tradingContract.provider.getGasPrice()).toNumber() * 2);
        return {
            priceData: priceData,
            sigs: sigs,
            gasPrice: gasPrice
        };
    }
}