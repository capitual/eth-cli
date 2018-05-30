#!/usr/bin/env node --harmony

'use strict'

const mainLib = require('../lib')
const pkg = require('../package.json')

const cmdline = require('node-cmdline-parser')
const pwdPrompt = require('password-prompt')
const readline = require('readline')
const fs = require('fs')
const commandLineUsage = require('command-line-usage')
const updateCheck = require('update-check')

init()

function output(str) {
	if (cmdline.keyexists('json')) {
		console.log(JSON.stringify(str))
	} else {
		console.log(str)
	}
}

async function init() {

	try {

		let wallet = new mainLib(cmdline.get('provider', false))
		await wallet.init(cmdline.get('datadir', false))

		await wallet_startup(wallet)

		if (cmdline.get('password')) {
			await wallet.unlock(cmdline.get('password'))
		}

		// parsing
		if (cmdline.keyexists('help')) {
			return show_help()
		}

		else if(cmdline.keyexists('getaddress')) {
			let addresses = wallet.addresses
			if(addresses.length) {
				output(addresses[addresses.length-1])
			} else {
				output(await wallet.getNewAddress())
			}
		}

		else if (cmdline.keyexists('getnewaddress')) {
			output(await wallet.getNewAddress(parseInt(cmdline.get('getnewaddress', 1))))
		}

		else if (cmdline.keyexists('listaddress') || cmdline.keyexists('listaddresses')) {
			output(wallet.addresses)
		}

		else if (cmdline.get('privatekeytoaddress')) {
			output(wallet.privKeyToAddress(cmdline.get('privatekeytoaddress')))
		}

		else if (cmdline.get('dumpprivkey')) {
			output(wallet.dumpPrivKey(cmdline.get('dumpprivkey')))
		}

		else if (cmdline.keyexists('dumpwallet')) {
			let addresses = wallet.addresses,
				privkeys = []
			for(let addr of addresses) {
				privkeys.push(wallet.dumpPrivKey(addr))
			}
			output(privkeys)
		}

		else if (cmdline.keyexists('getseed') || cmdline.keyexists('dumpseed')) {
			output(wallet.seed)
		}

		else if (cmdline.keyexists('getreceivedbyaddress')) {
			output(await wallet.getBalance(cmdline.get('getreceivedbyaddress'), cmdline.get('minconf', 0)))
		}

		else if (cmdline.keyexists('getbalance')) {
			if (!wallet.addresses.length)
				await wallet.getNewAddress()
			
			output(await wallet.balance)
		}

		else if(cmdline.keyexists('getgasprice')) {
			output(await wallet.gasPrice)
		}

		else if(cmdline.keyexists('getblocknumber') || cmdline.keyexists('getblockcount')) {
			output(await wallet.blockNumber)
		}

		else if(cmdline.get('getblock')) {
			output(await wallet.getBlock(cmdline.get('getblock')))
		}

		else if (cmdline.get('gettransaction') || cmdline.get('gettx')) {
			output(await wallet.getTransaction(cmdline.get('gettransaction', cmdline.get('gettx'))))
		}

		else if (cmdline.get('sendtoaddress')) {
			let amount = cmdline.get('amount', false)
			let from = cmdline.get('from', wallet.addresses[0])
			let to = cmdline.get('sendtoaddress', false)
			let gasprice = cmdline.get('gasprice', undefined)
			let gaslimit = cmdline.get('gaslimit', undefined)

			// if amount contains dot, we assume it is in ether
			if (amount.includes("."))
				amount = parseFloat(amount)*1e18

			if (!to || amount === false)
				throw new Error("Required parameters: to and amount")

			output(await wallet.sendToAddress(from, to, amount, gasprice, gaslimit))
		}

		else if (cmdline.get('createrawtransaction')) {
			let amount = cmdline.get('amount', false)
			let from = cmdline.get('from', wallet.addresses[0])
			let to = cmdline.get('createrawtransaction', false)
			let gasprice = cmdline.get('gasprice', undefined)
			let gaslimit = cmdline.get('gaslimit', undefined)

			// if amount contains dot, we assume it is in ether
			if (amount.includes("."))
				amount = parseFloat(amount)*1e18

			if (!to || amount === false)
				throw new Error("Required parameters: to and amount")

			output(await wallet.createRawTx(from, to, amount, gasprice, gaslimit))
		}

		else if (cmdline.get('sendrawtransaction') || cmdline.get('sendrawtx')) {
			output(await wallet.sendRawTx(cmdline.get('sendrawtransaction', cmdline.get('sendrawtx'))))
		}

		else if (cmdline.get('signrawtransaction') || cmdline.get('signrawtx')) {
			let from = cmdline.get('from', wallet.addresses[0])
			output(wallet.signTx(cmdline.get('signrawtransaction', cmdline.get('signrawtx')), from))
		}

		else if (cmdline.get('backupwallet')) {
			let filename = cmdline.get('backupwallet')
			if (fs.existsSync(filename)) {
				throw new Error("File already exists")
			}
			let fd = fs.openSync(filename, 'w')
			fs.writeSync(fd, wallet.rawKeystore)
			fs.closeSync(fd)
		}

		else {
			show_help()
		}
	} catch(e) {
		console.log("[ERR] "+e.message)
	}

}

async function wallet_startup(wallet) {
	// check if seed was generated
	if (!(await wallet.hasKeystore)) {
		try {
			return await generate_keystore(wallet)
		} catch(e) {
			return process.exit(0)
		}
	}
}

async function generate_keystore(wallet) {
	console.log("Your wallet has not been generated yet.")

	let pwd

	if(cmdline.get('password'))
		pwd = cmdline.get('password')
	else {
		do {
			pwd = await pwdPrompt("Please choose a password to encrypt your seed (Ctrl + C to exit): ", { method: 'hide'})
		} while(!pwd)
	}

	if (cmdline.get('seed')) {
		let seed = cmdline.get('seed')
		if (wallet.isSeedValid(seed)) {
			await wallet.createKeystore(pwd, seed)
			console.log("[OK] You can now start using your wallet.")
			process.exit(0)
		} else {
			console.log("Invalid seed. Please choose a new one.")
		}
	} else {
		let seed = wallet.generateSeed()

		console.log("Please write down the following words and keep it safe. Do not share with to anyone and do not lose it. This is your seed.")
		console.log("Anyone who knows your seed is able to spend your funds. Also, if you lose it, your funds are lost permanently.")
		console.log("\n\t"+seed+"\n")
		console.log("After writting down your seed, press Enter to continue...")

		require('child_process').spawnSync("read _ ", {shell: true, stdio: [0, 1, 2]});

		console.clear()
		console.log("Please write down your seed:")
		let checkseed = await pwdPrompt("")
		if (checkseed.toLowerCase().trim() == seed) {
			await wallet.createKeystore(pwd, seed)
			console.log("[OK] You can now start using your wallet.")
			process.exit(0)
		} else {
			console.log("Invalid seed. Please run the software again to generate a new seed.")
		}
	}
}

async function show_help() {
	let sections = []

	let update = null;
 
	try {
	    update = await checkForUpdate(pkg);
	} catch (err) {
	    // fail silently
	}

	let superContent = ['{italic Version '+pkg.version+'}',
			'{bold Website:} https://jesobreira.github.io/eth-cli']

	if (update) {
		superContent.push('🔔  {bold Update Available!} Run: npm i '+pkg.name+' -g')
	}

	sections.push({
		header: 'ethereum-cli',
		content: superContent
	})

	
	sections.push({
		header: 'Available commands',
		optionList: [
			{
				name: 'getaddress 🔑 ',
				description: 'Show your wallet\'s main address'
			},
			{
				name: 'getnewaddress 🔑 ',
				description: 'Generates a new address and shows it'
			},
			{
				name: 'listaddresses 🔑 ',
				description: 'Lists all your generated addresses'
			},
			{
				name: 'privatekeytoaddress',
				typeLabel: '{underline privateKey}',
				description: 'Converts a private key to address'
			},
			{
				name: 'dumpprivkey 🔑 ',
				typeLabel: '{underline wallet}',
				description: 'Shows the private key of one of your wallet addresses'
			},
			{
				name: 'dumpwallet 🔑 ',
				description: 'Lists every private key of your wallet addresses'
			},
			{
				name: 'dumpseed 🔑 ',
				description: 'Shows your seed (mnemonic phrase)'
			},
			{
				name: 'getreceivedbyaddress',
				typeLabel: '{underline address} [--minconf {underline minimumConfirmations = 0}]',
				description: 'Get an address\' balance'
			},
			{
				name: 'getbalance 🔑 ',
				description: 'Get your account\'s balance (all wallets summed up)'
			},
			{
				name: 'getgasprice',
				description: 'Get current gas price'
			},
			{
				name: 'getblockcount',
				description: 'Get current block\'s number'
			},
			{
				name: 'getblock',
				typeLabel: '{underline blockNumberOrHash}',
				description: 'Get a block\'s data'
			},
			{
				name: 'gettransaction',
				typeLabel: '{underline txid}',
				description: 'Get a transaction\'s data'
			},
			{
				name: 'backupwallet 🔑 ',
				typeLabel: '{underline file}',
				description: 'Backups your wallet onto {underline file}'
			},
			{
				name: 'createrawtransaction 🔑 ',
				typeLabel: '{underline to} --from {underline from} --amount {underline amount} [--gasprice {underline gasprice}] [--gaslimit {underline gaslimit}]',
				description: 'Returns an hex-encoded raw transaction'
			},
			{
				name: 'signrawtransaction 🔑 ',
				typeLabel: '{underline hexRawTransaction} --from {underline from}',
				description: 'Returns the hex-encoded raw transaction, signed by {underline from}'
			},
			{
				name: 'sendrawtransaction',
				typeLabel: '{underline hexRawSignedTransaction}',
				description: 'Pushes a raw transaction to the network'
			},
			{
				name: 'sendtoaddress 🔑 ',
				typeLabel: '{underline to} --from {underline from} --amount {underline amount} [--gasprice {underline gasprice}] [--gaslimit {underline gaslimit}]',
				description: 'Sends a transaction and returns its transaction ID'
			}
		] 
	})

	sections.push({
		header: 'Global options',
		optionList: [
			{
				name: 'password',
				typeLabel: '{underline password}',
				description: 'Unlocks your wallet with your password. {bold Required for every command marked with 🔑}'
			},
			{
				name: 'provider',
				typeLabel: '{underline provider}',
				description: '(Optional) Use "ropsten" for MyEtherApi.com\'s Ropsten testnet, or a HTTP web3 provider URL. Default is MyEtherAPI.com mainnet provider.'
			},
			{
				name: 'datadir',
				typeLabel: '{underline folder}',
				description: '(Optional) Set folder used as wallet storage. Default is ~/.ethereum-cl'
			}
		]
	})

	sections.push({
		header: 'First-run options',
		optionList: [
			{
				name: 'seed',
				typeLabel: '{underline seed}',
				description: '(Optional) Set a custom seed (useful for importing/restoring wallets). If not supplied, one will be generated.'
			},
			{
				name: 'password',
				typeLabel: '{underline password}',
				description: '(Optional) Pre-set a password. If not supplied, it will be requested.'
			}
		]
	})

	console.log(commandLineUsage(sections))
}