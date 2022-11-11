# Tigris order execution bot

## You need:

- Git: [https://git-scm.com/downloads/](https://git-scm.com/downloads/)
- Node package manager: [https://www.npmjs.com/](https://www.npmjs.com/)
- Fresh wallet with ETH / MATIC for gas

## Instructions:

1. Clone the repo
    #### `git clone https://github.com/Tigris-Trade/jsbot.git`

2. Install dependencies
    #### `npm install`

3. Create .env file and fill it out as shown in .env.example
   - `WALLET` is the bots public address
   - `PRIVATE_KEY` is the bots private key
   - `RPC_URL` is the network's RPC URL, Alchemy recommended
   - `PUBLIC_RPC_URL` is the network's public RPC URL, can also use Alchemy
   - `CANISTER` is the IC canister ID used by Tigris
   - `TRADING` is the trading contract address
   - `POSITION` is the positions contract address
   - `LIBRARY` is the trading contract's utility library
   - `PAIRS` is the number of pairs
   - Check the [docs](https://docs.tigris.trade/) for specific info


4. Run the bot
    #### `npm start`

## Other Info:
- You need to run an instance of the bot for every network
- First bot to execute an order gets the reward
- Rewards are in tigTokens, such as tigUSD
- Bots are rewarded with 0.01% of the trade's position size
- Anyone can run a bot