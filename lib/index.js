'use strict'

const Web3 = require('web3')
const cmdline = require('node-cmdline-parser')
const lightwallet = require('eth-lightwallet')
const txDecoder = require('ethereum-tx-decoder')
const SignerProvider = require('ethjs-provider-signer')
const nodePersist = require('node-persist')
const asyncjs = require('async')
const _ = require('underscore')
const Util = require('ethereumjs-util')
const Erc20 = require('./erc20')

const pkg = require('../package')

class EthereumWallet {
	constructor(provider = false) {
		this.provider = provider
		return this
	}

	get libVersion() {
		return pkg.version
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
					_this._rawpwd = password
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

		this.keystore.passwordProvider = cb => cb(null, this._rawpwd)

		if(typeof provider === 'string') {
			if (provider === 'ropsten' || provider === 'testnet')
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

		else if(provider instanceof Web3.providers.HttpProvider || provider instanceof Web3.providers.WebsocketProvider || provider instanceof SignerProvider  || typeof provider === 'object') {
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
			this._web3.eth.isSyncing((err, sync) => {
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
				_this.setProvider(_this.provider)
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

	getWalletBalance(minconf = 0) {
		let _this = this
		return new Promise(async (resolve, reject) => {
			let blocknumber = await _this.blockNumber
			asyncjs.map(this.addresses, (addr, cb) => this._web3.eth.getBalance(addr, blocknumber-minconf, cb), function(err, balances) {
				resolve(String(balances.reduce((acc, val) => Number(acc)+Number(val))))
			})
		})
	}

	get balance() {
		return this.getWalletBalance()
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
					resolve(parseInt(data))
			})
		})
	}

	get web3() {
		return this._web3
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

	getNonce(addr, includePending = false) {
		let _this = this
		return new Promise((resolve, reject) => {
			if (includePending) {
				_this._web3.eth.getTransactionCount(addr, 'pending', (err, data) => {
					if(err)
						reject(err)
					else
						resolve(data)
				})
			} else {
				_this._web3.eth.getTransactionCount(addr, (err, data) => {
					if(err)
						reject(err)
					else
						resolve(data)
				})
			}
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

	async createRawTx(from, to, value, gasPrice = undefined, gasLimit = undefined, gas = undefined) {
		let nonce = await this.getNonce(from)
		to = to.substr(2).toLowerCase()
		
		if (!gasPrice) gasPrice = await this.gasPrice
		if (!gas) gas = await this.estimateGas({value, to, gasPrice, nonce})
		
		return lightwallet.txutils.valueTx({ value, to, gasPrice, nonce, gasLimit, gas })
	}

	signTx(rawtx, from) {
		return '0x'+lightwallet.signing.signTx(this.keystore, this.password, rawtx, from)
	}

	signTransaction(rawtx, from) {
		const privKey = Buffer.from(this.keystore.exportPrivateKey(from, this.password), 'hex')
		return rawtx.sign(privKey)
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

	async sendToAddress(from, to, value, gasPrice = undefined, gasLimit = undefined, gas = undefined) {
		let rawtx = await this.createRawTx(from, to, value, gasPrice, gasLimit, gas)
		let signed_rawtx = this.signTx(rawtx, from)
		return this.sendRawTx(signed_rawtx)
	}

	get Erc20() {
		let ret = Erc20
		ret.prototype.parent = this
		return ret
	}
}

if (typeof module)
	module.exports = EthereumWallet
