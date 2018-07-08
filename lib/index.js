'use strict'

const Web3 = require('web3')
const cmdline = require('node-cmdline-parser')
const lightwallet = require('eth-lightwallet')
const txDecoder = require('ethereum-tx-decoder')
const SignerProvider = require('ethjs-provider-signer')
const nodePersist = require('node-persist')
const asyncjs = require('async')

const pkg = require('../package.json')

class EthereumWallet {
	constructor(provider = false) {
		this.provider = provider
		return this
	}

	async init(storage_method = false) {
		if (!storage_method) {
			this.storage = nodePersist.create({ dir: require('os').homedir() + '/.'+pkg.name })
			await this.storage.init()
		} else {
			if (typeof storage_method === 'string') {
				if (storage_method === 'testnet')
					this.storage = nodePersist.create({ dir: require('os').homedir() + '/.'+pkg.name+'/testnet' })
				else
					this.storage = nodePersist.create({dir: storage_method})

				await this.storage.init()
			} else {
				this.storage = storage_method
			}
		}

		if(await this.hasKeystore) {
			this.setProvider(this.provider)
		}
	}

	unlock(password) {
		let _this = this
		return new Promise((resolve, reject) => {
			_this.keystore.keyFromPassword(password, (err, pwDerivedKey) => {
				if(err) return reject(err)

				if (_this.keystore.isDerivedKeyCorrect(pwDerivedKey)) {
					_this._password = pwDerivedKey
					resolve(true)
				} else {
					resolve(false)
				}
			})
		})
	}

	get isUnlocked() {
		return this._password !== undefined
	}

	get password() {
		if (this._password) {
			return this._password
		} else {
			throw new Error("Password not provided or invalid")
		}
	}

	async setProvider(provider = false) {
		let the_provider

		if(typeof provider === 'string') {
			if (provider === 'ropsten')
				provider = 'https://api.myetherapi.com/rop'

			the_provider = new SignerProvider(provider, {
		      signTransaction: this.keystore.signTransaction.bind(this.keystore),
		      accounts: (cb) => cb(null, this.keystore.getAddresses().map((a) => '0x' + a))
		    })
		}

		else if(provider === false) {
			the_provider = new SignerProvider('https://api.myetherapi.com/eth', {
		      signTransaction: this.keystore.signTransaction.bind(this.keystore),
		      accounts: (cb) => cb(null, this.keystore.getAddresses().map((a) => '0x' + a))
		    })
		}

		else if(provider instanceof Web3.providers.HttpProvider || provider instanceof SignerProvider) {
			the_provider = provider
		}

		this._web3 = new Web3(the_provider)

		return this
	}

	get hasKeystore() {
		return new Promise((resolve, reject) => {
			this.storage.getItem('keystore').then((read_ks) => {
				if (read_ks !== undefined) {
					this.keystore = lightwallet.keystore.deserialize(read_ks)
					resolve(true)
				} else {
					resolve(false)
				}
			})
		})
	}

	get rawKeystore() {
		return this.keystore.serialize()
	}

	get seed() {
		return this.keystore.getSeed(this.password)
	}

	get isSyncing() {
		return new Promise((res, rej) => {
			this._web3.eth.isSyncing((error, sync) => {
				if (err)
					rej(err)
				else
					res(sync)
			})
		})
	}

	generateSeed() {
		return lightwallet.keystore.generateRandomSeed()
	}

	isSeedValid(seed) {
		return lightwallet.keystore.isSeedValid(seed)
	}

	createKeystore(password, seedPhrase) {
		let _this = this
		return new Promise((resolve, reject) => {
			lightwallet.keystore.createVault({password, seedPhrase, hdPathString: "m/44'/60'/0'/0"}, function(error, ks) {
				if (error) reject(error)

				_this.keystore = ks
				_this.setProvider()
				_this.unlock(password)

				// save keystore
				_this.storage.setItem('keystore', _this.keystore.serialize()).then(() => resolve())
			})
		})
	}

	async saveKeystore() {
		await this.storage.setItem('keystore', this.keystore.serialize())
	}

	async getNewAddress(amount = 1) {
		if(isNaN(amount)) amount = 1
		this.keystore.generateNewAddress(this.password, amount)
		await this.saveKeystore()
		let addresses = this.keystore.getAddresses()
		let list = addresses.slice(addresses.length-amount)
		if(amount===1)
			return list[0]
		else
			return list
	}

	get addresses() {
		return this.keystore.getAddresses()
	}

	privKeyToAddress(privKey) {
		return '0x'+lightwallet.keystore._computeAddressFromPrivKey(privKey)
	}

	dumpPrivKey(address) {
		return this.keystore.exportPrivateKey(address, this.password)
	}

	// web3

	getBalance(address, minconf = 0) {
		let _this = this
		return new Promise((resolve, reject) => {
			_this.blockNumber.then((blocknumber) => {
				this._web3.eth.getBalance(address, blocknumber-minconf, (err, bal) => {
					err ? reject(err) : resolve(bal)
				})
			})
		})
	}

	get balance() {
		return new Promise((resolve, reject) => {
			asyncjs.map(this.addresses, this._web3.eth.getBalance, function(err, balances) {
				resolve(String(balances.reduce((acc, val) => Number(acc)+Number(val))))
			})
		})
	}

	getTransaction(txid) {
		let _this = this
		return new Promise((resolve, reject) => {
			_this._web3.eth.getTransaction(txid, (err, data) => {
				if(err)
					reject(err)
				else
					resolve(data)
			})
		})
	}

	decodeRawTx(rawtx) {
		let decoded = txDecoder.decodeTx(rawtx)
		decoded.gasPrice = decoded.gasPrice.toString()
		decoded.gasLimit = decoded.gasLimit.toString()
		decoded.value = decoded.value.toString()
		return decoded
	}

	get gasPrice() {
		let _this = this
		return new Promise((resolve, reject) => {
			_this._web3.eth.getGasPrice((err, data) => {
				if(err)
					reject(err)
				else
					resolve(data)
			})
		})
	}

	get blockNumber() {
		let _this = this
		return new Promise((resolve, reject) => {
			_this._web3.eth.getBlockNumber((err, data) => {
				if(err)
					reject(err)
				else
					resolve(data)
			})
		})
	}

	getBlock(block) {
		let _this = this
		return new Promise((resolve, reject) => {
			_this._web3.eth.getBlock(block, (err, data) => {
				if(err)
					reject(err)
				else
					resolve(data)
			})
		})
	}

	getNonce(addr) {
		let _this = this
		return new Promise((resolve, reject) => {
			_this._web3.eth.getTransactionCount(addr, (err, data) => {
				if(err)
					reject(err)
				else
					resolve(data)
			})
		})
	}

	estimateGas(txOptions) {
		let _this = this
		return new Promise((resolve, reject) => {
			_this._web3.eth.estimateGas(txOptions, (err, data) => {
				if(err)
					reject(err)
				else
					resolve(data)
			})
		})
	}

	async createRawTx(from, to, value, gasPrice = undefined, gasLimit = undefined) {
		let nonce = await this.getNonce(from)
		
		if (!gasPrice) gasPrice = await this.gasPrice
		if (!gasLimit) gasLimit = await this.estimateGas({value, to, gasPrice, nonce})
			
		return lightwallet.txutils.valueTx({value, to, gasPrice: '0x'+gasPrice.toString(16), nonce, gasLimit: '0x'+gasLimit.toString(16)})
	}

	signTx(rawtx, from) {
		return '0x'+lightwallet.signing.signTx(this.keystore, this.password, rawtx, from)
	}

	pushTx(rawtx) {
		return sendRawTx(rawtx)
	}

	sendRawTx(rawtx) {
		let _this = this
		return new Promise((resolve, reject) => {
			_this._web3.eth.sendSignedTransaction(rawtx, (err, hash) => {
				if(err)
					reject(err)
				else
					resolve(hash)
			})
		})
	}

	async sendToAddress(from, to, value, gasPrice = undefined, gasLimit = undefined) {
		let rawtx = await this.createRawTx(from, to, '0x'+parseInt(value).toString(16), gasPrice, gasLimit)
		let signed_rawtx = this.signTx(rawtx, from)
		return this.sendRawTx(signed_rawtx)
	}
}

if (typeof module)
	module.exports = EthereumWallet