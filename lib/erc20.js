const fs = require('fs')
const asyncjs = require('async')
const Erc20js = require('erc20-contract-js')

class Erc20 {
	constructor(contractAddress, contractAbi = null) {
		if (fs.existsSync(contractAbi)) contractAbi = JSON.parse(fs.readFileSync(contractAbi).toString())
		this.contract = new Erc20js(this.parent.web3, contractAddress, contractAbi)
	}

	get web3() {
		return this.parent.web3
	}

	get name() {
		return this.contract.name().call()
	}

	get symbol() {
		return this.contract.symbol().call()
	}

	get totalSupply() {
		return this.contract.totalSupply().call()
	}

	get decimals() {
		return this.contract.decimals().call()
	}

	get balance() {
		return new Promise((resolve, reject) => {
			asyncjs.map(this.parent.addresses, addr => this.contract.balanceOf(addr).call(), function(err, balances) {
				resolve(String(balances.reduce((acc, val) => Number(acc)+Number(val))))
			})
		})
	}

	balanceOf(address) {
		return this.contract.balanceOf(address).call()
	}

	allowance(walletAddr, spenderAddr) {
		return this.contract.allowance(walletAddr, spenderAddr).call()
	}

	async transfer(toAddr, value, txOpts) {
		// get these async
		let checkGasPrice = this.parent.gasPrice
		let checkNonce = this.parent.getNonce(txOpts.from, 'pending')

		txOpts.nonce = await checkNonce
		if (!txOpts.gasPrice) txOpts.gasPrice = await checkGasPrice
		if (!txOpts.gasLimit) txOpts.gasLimit = await this.contract.getInstance().methods.transfer(toAddr, value).estimateGas(txOpts)
			
		let tx = await this.contract.transfer(toAddr, value).send(txOpts)
		return tx.transactionHash
	}

	async transferFrom(fromAddr, toAddr, value, txOpts) {
		throw new Error("Not implemented yet")
	}

	async approve(spenderAddr, value, txOpts) {
		throw new Error("Not implemented yet")
	}
}

if (typeof module)
	module.exports = Erc20