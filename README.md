node-ethereum-wallet (ethereum-cli)
===================================

An Ethereum wallet for Node, browsers and command-line.

Powered by [web3.js](https://github.com/ethereum/web3.js) and [eth-lightwallet](https://github.com/ConsenSys/eth-lightwallet).

This project is **NOT affiliated with Ethereum**.

Installing
----------

Globally (for command line usage):

```
npm i node-ethereum-wallet -g
```

As a local module (for JS library usage):

```
npm i node-ethereum-wallet
```

Command-line Help
-----------------

The `ethereum-cli` command will be available on your shell. The following arguments are available (the table below is available by running `ethereum-cli` with no arguments or `ethereum-cli --help`):

Command                   | Arguments                                                                            | Description
--------------------------|--------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------
--getaddress 🔑           |                                                                                      | Show your wallet's main address
--getnewaddress 🔑        |                                                                                      | Generates a new address and shows it
--listaddresses 🔑        |                                                                                      | Lists all your generated addresses
--privatekeytoaddress     | _privateKey_                                                                         | Converts a private key to address
--dumpprivkey 🔑          | _wallet_                                                                             | Shows the private key of one of your wallet addresses
--dumpwallet 🔑           |                                                                                      | Lists every private key of your wallet addresses
--dumpseed 🔑             |                                                                                      | Shows your seed (mnemonic phrase)
--getreceivedbyaddress    | _address_ [--minconf _minimumConfirmations = 0_]                                     | Get an address' balance
--getbalance 🔑           |                                                                                      | Get your account's balance (all wallets summed up)
--getgasprice             |                                                                                      | Get current gas price
--getblockcount           |                                                                                      | Get current block's number
--getblock                | _blockNumberOrHash_                                                                  | Get a block's data
--gettransaction          | _txid_                                                                               | Get a transaction's data
--decoderawtransaction    | _hex_                                                                                | Decodes a raw transaction
--backupwallet 🔑         | _file_                                                                               | Backups your wallet onto file
--createrawtransaction 🔑 | _to_ --amount _amount_ [--from _from_] [--gasprice _gasprice_] [--gaslimit _gaslimit_] | Returns an hex-encoded raw transaction
--signrawtransaction 🔑   | _hexRawTransaction_ --from _from_                                                    | Returns the hex-encoded raw transaction, signed by from
--sendrawtransaction      | _hexRawSignedTransaction_                                                            | Pushes a raw transaction to the network
--sendtoaddress 🔑        | _to_ --amount _amount_ [--from _from_] [--gasprice _gasprice_] [--gaslimit _gaslimit_] | Sends a transaction and returns its transaction ID. Amount will be interpreted as wei if no comma is found, or ether if comma is found (i.e. 1.0 = 1 ether; 1 = 1 wei)
--erc20					  | _contractAddr_ [--abi _abiOrFile_]                                                    | Specify an ERC-20 contract to use (see below)

### ERC-20 commands

Command            | Arguments                                                                                 | Description
-------------------|-------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------
--erc20            | _contractAddr_ [--abi _abiOrFile_]                                                        | Specify an ERC-20 contract to use (see below)
--gettokendata     | --erc20 _contractAddr_ [--abi _abiOrFile_]                                                | Get token data (name, symbol etc.) from contract, if available
--getbalance       | _address_ --erc20 _contractAddr_ [--abi _abiOrFile_]                                      | Get any wallet's balance. If address is not specified, it will return the sum of the balance of all your generated wallets
--sendtoaddress 🔑 | _address_ --erc20 _contractAddr_ [--abi _abiOrFile_] --amount _amount_ [--from _fromaddr] | Sends an amount of ERC-20 token to an address


### Global options

 * `--password <password>`   Unlocks your wallet with your password. **Required for every command marked
                        with 🔑**
 * `--provider <provider>`   (Optional) Use "ropsten" for MyEtherApi.com's Ropsten testnet, or a HTTP web3
                        provider URL. Default is MyEtherAPI.com mainnet provider.
 * `--testnet`               Alias for `--provider testnet`
 * `--datadir <folder>`      (Optional) Set folder used as wallet storage. Default is ~/.ethereum-cli.


### First-run options

 * `--seed <seed>`           (Optional) Set a custom seed (useful for importing/restoring wallets). If not
                        supplied, one will be generated.
 * `--password <password>`   (Optional) Pre-set a password. If not supplied, it will be requested.

Examples
--------

### Example 1: sending ether

```bash
$ ethereum-cli --getaddress
0xsample

$ ethereum-cli --getbalance
5000

$ ethereum-cli --sendtoaddress 0xtarget --from 0xsample --amount 3000
0xtransactionID
```

### Example 2: sending ERC-20 tokens

```bash
$ ethereum-cli --erc20 0xcontract --abi ./contractabi.json --getbalance
5000

$ ethereum-cli --erc20 0xcontract --abi ./contractabi.json --sendtoaddress 0xtarget --amount 3000 
0xtransactionID
```

Library Help
------------

This project also exposes a Javascript class, which you can use in your NodeJS or browser projects. It can be included on NodeJS using require:

```javascript
const EthereumWallet = require('node-ethereum-wallet')
```

On browsers, you can include it using `<script>`, and the global class `EthereumWallet` will be available.

```html
<script src="./node_modules/node-ethereum-wallet/lib/index.js"></script>
```
### Initializing

You must instantiate the class and initialize it.

```javascript
let myWallet = new EthereumWallet() // using MyEtherAPI.com web3 HTTP provider
```

The class constructor may receive an optional argument, setting a web3 server to connect to. By default, MyEtherAPI.com provider is used, however it has great limitations as it is intended for testing purposes only. **It is highly recommended to set your own web3 provider.** You may want to set up a [web3 provider on AWS using Docker](https://github.com/MyEtherWallet/docker-geth-lb) (note that it will cost you real money), or signup and use [Infura](https://infura.io) services.

```javascript
let myWallet = new EthereumWallet('https://mainnet.infura.io/<your infura key>') // using Infura provider

let myWallet = new EthereumWallet('https://localhost:8456') // using your local provider
```

You can modify the provider at any time using `myWallet.setProvider(<provider>)`.

In order to initialize the wallet, call:

```javascript
await myWallet.init()
```

It may receive an optional argument which is a folder where to keep the wallet data. By default, it is "~/.ethereum-cli". You can change it so:

```javascript
await myWallet.init("/path/to/data/dir")
```

In order to check if your provider is still syncing, just check the boolean getter `myWallet.isSyncing`.

### Creating wallet

If your wallet hasn't been created yet, it's needed to create it.

It's easy to check if your wallet has been created. Just check for the existence of a keystore.

```javascript
if (await myWallet.hasKeystore) {
	// wallet exists
} else {
	// wallet does not exist
}
```

In order to create a wallet, you need a seed. Generate one so:

```javascript
let seed = myWallet.generateSeed()
```

Save the seed safely, then create the keystore:

```javascript
let password = 'your-wallet-password' // choose one
await myWallet.createKeystore(password, seed)
```

### Unlocking your wallet

If you are going to perform any action that requires password (i.e. sending funds, signing transactions, generating wallets), unlock your wallet so:

```javascript
await myWallet.unlock('your-wallet-password')
```

In order to check if your wallet is unlocked, just check if `myWallet.isUnlocked` is true.

### Generating addresses

It is needed to generate an address. To do so, just call:

```javascript
let address = await myWallet.getNewAddress()
```

It will return the new address as a string.

In order to generate multiple addresses, specify the amount of addresses to generate:

```javascript
let addresses = await myWallet.getNewAddress(5)
```

It will return an array with the addresses.

If needed, you can get an address' private key with:

```javascript
let privKey = myWallet.dumpPrivKey('address')
```

Or even convert a private key back to address:

```javascript
let walletAddress = myWallet.privKeyToAddress(privKey)
```

An array of ever generated addresses is always available at:

```javascript
let myAddresses = myWallet.addresses
```

### Getting your balance

Your balance summed up (from all your wallets) can be obtained, in weis, through:

```javascript
let balance = await myWallet.balance
```

Whereas the balance of an specified address is found with:

```javascript
let balance = await myWallet.getBalance('address')
```

It can receive an optional argument, with the number of confirmations needed for a balance to be summed up (default is 1).

```javascript
let balanceWith3Confs = await myWallet.getBalance('address', 3)
```

### Blocks and Transactions

You can get the current block number with:

```javascript
let blockCount = await myWallet.blockNumber
```

Information about a block is got with:

```javascript
let blockInfo = await myWallet.getBlock(block_id_or_hash)
```

Information about a specified transaction is available by:

```javascript
let txInfo = await myWallet.getTransaction('txid')
```

### Gas

You can get the current gas price (median of the latest blocks).

```javascript
let gasPrice = await myWallet.gasPrice
```

And estimate the gas needed for a transaction:

```javascript
let gasLimit = await myWallet.estimateGas({
	value: 'tx amount',
	to: 'target wallet',
	gasPrice: await myWallet.gasPrice,
	nonce: myWallet.getNonce(fromWallet),
	data: 'optional'
})
```

### Transaction

Sending Ether is as easy as:

```javascript
let from_wallet = 'from_wallet' // your origin wallet or myWallet.addresses[0]
let to_wallet = 'destination'
let amount = 1*10e18 // in Wei (1*10^18 Wei = 1 Ether)

try {
	let txid = await myWallet.sendToAddress(from_wallet, to_wallet, amount)
} catch(e) {
	console.log("Could not send Ether. Reason: "+e.message)
}
```

The `.sendToAddress` method can also receive two additional arguments, `gasPrice` and `gasLimit` respectively, which, by default, are automaticaly calculated. If you want to skip `gasPrice` but set `gasLimit`, then set `gasPrice` as `undefined`.

#### Raw Transactions

You can create a hex-encoded raw transaction, instead of sending it directly. The usage of this method is the very same as `.sendToAddress()` and it returns your hex-encoded transaction as string.

```javascript
let hexTx = await myWallet.createRawTx(from_wallet, to_wallet, amount)
```

Before sending your raw transaction, it is needed to sign it:

```javascript
let signedHexTx = myWallet.signTx(hexTx, from)
```

Finally, push it:

```javascript
try {
	let txid = await myWallet.sendRawTx(signedHexTx)
} catch(e) {
	console.log("Could not push tx. Reason: "+e.message)
}
```

### Backup & Restore

You can get back your seed with:

```javascript
let seed = myWallet.seed
```

It is not possible to recover your password (therefore, do not lose it). You can only get your seed after unlocking (`myWallet.unlock(password)`) your wallet with your password.

In order to restore your wallet, set the seed with `createKeystore`. You can specify a new password if you want.

```javascript
let password = 'your-wallet-password' // choose one or use the previous one
await myWallet.createKeystore(password, 'your seed')
```

ERC-20 library
--------------

In order to use a ERC-20 library, it's needed to instance the main class (see above).

```javascript
let myWallet = new EthereumWallet()
await myWallet.init()
```

### Contract instance

You can have multiple contracts instance. Each contract interface is generated through a constructor.

```javascript
let contract = myWallet.Erc20(contractAddress, contractAbi)
```

The contract address must be a string. The contract ABI can be either a string containing the location of a file containing the contract ABI or the ABI object itself. If not provided or `null`, a standard ABI will be used.

### Getting token information

The lib also provides async getters that returns the token information.

**Warning**: storing token information on the contract is not covered by ERC-20 standards. Therefore, this feature may fail in several contracts. We recommend using try/catch or gathering these information from the ABI.

```javascript
let contractName = await contract.name // "FakeCoin"
let contractSymbol = await contract.symbol // "FAKE"
let contractDecimals = await contract.decimals // 18
let contractTotalSupply = await contract.totalSupply // 2100000000000000000000000
```

**Note**: sequentially using await is bad practice ("async/await hell"). [Read more.](https://medium.freecodecamp.org/avoiding-the-async-await-hell-c77a0fb71c4c)

### Getting an address's balance

```javascript
let balance = await contract.balanceOf(address, minconf) // 1000000000000000000
```

The first argument must be a string. The second argument is optional (if not provided, it will be zero).

### Sending tokens

```javascript
let txid = await contract.transfer(to, amount, {
	from: '0xfrom',
	gasPrice: 'optional',
	gasLimit: 'optional'
	})
```

Setting gasPrice and gasLimit are optional. If not provided, it will be estimated.

Amount is given on the lowest unit. For a token with 18 decimals, 1 token = 1e18 (1000000000000000000).

This function throws/rejects on error. Since it is async, you can either use try/catch or Promise.catch().

Todo
----

- [ ] ERC20 tokens support (60% done)
- [ ] Smart contracts support
